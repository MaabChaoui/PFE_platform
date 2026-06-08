"""S15 — LIVE_TF_CD routing + nearest-precomputed fallback (live free-form only).

These never touch the locked offline predictions/metrics. The redirect fires
BEFORE any dispatcher build, so the heavy 74 MB KG is never loaded.
"""
from __future__ import annotations

from unittest.mock import Mock

import akn_rlm.rlm.dispatcher as dispatcher_mod
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.answer import AnswerOptions
from app.services.pipeline import LiveReplayRedirect, PipelineService
from app.settings import Settings, settings


def _stubbed_service(config=settings) -> PipelineService:
    service = PipelineService(config)
    service._loaded = True
    service._registry = Mock(name="registry")
    service._bm25 = Mock(name="bm25")
    service._dense = Mock(name="dense")
    service._llm_pool = Mock(name="llm_pool")
    service._router = Mock(name="router")
    return service


def _patch_build_counter(monkeypatch) -> dict:
    captured = {"calls": 0, "run_query_type": None, "kwargs": None}

    class _Disp:
        def run(self, query, query_type=None):
            captured["run_query_type"] = query_type
            return {
                "answer_text": "ok",
                "citations": [{"doc_id": "d", "article_ref": "1"}],
                "trajectory": [],
                "_telemetry": {"dispatched_handler": "multi_hop"},
            }

    def fake_build(**kwargs):
        captured["calls"] += 1
        captured["kwargs"] = kwargs
        return _Disp()

    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", fake_build)
    return captured


class _FailingClassify:
    """Stand-in for an UNPARSEABLE LLM label: our classify (fallback_to_regex=
    False) raises, so _safe_classify returns None — the exact case the dispatcher
    would then regex-route to TF/CD and load the KG."""

    def __call__(self, query):
        from app.services.pipeline import PipelineLiveError

        raise PipelineLiveError("unparseable label")


# ── redirect fires for TF/CD and skips the dispatcher (no KG) ────────────────

def test_manual_tf_cd_redirects_without_building_dispatcher(monkeypatch) -> None:
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service()  # LIVE_TF_CD defaults to "replay"

    with pytest.raises(LiveReplayRedirect) as exc:
        service.answer("متى صدر القانون؟", AnswerOptions(query_type="temporal_factual"))

    assert exc.value.query_type == "temporal_factual"
    assert captured["calls"] == 0  # never built a dispatcher → KG never loaded


def test_auto_classified_cd_redirects(monkeypatch) -> None:
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service()
    monkeypatch.setattr(service, "classify", lambda q: ("conceptual_definitional", 0.95))

    with pytest.raises(LiveReplayRedirect) as exc:
        service.answer("ما هو تعريف العقد؟", AnswerOptions())

    assert exc.value.query_type == "conceptual_definitional"
    assert captured["calls"] == 0


# ── non-TF/CD proceeds, and the resolved type is passed through (no re-classify) ─

def test_non_tf_cd_runs_and_passes_resolved_type(monkeypatch) -> None:
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service()
    monkeypatch.setattr(service, "classify", lambda q: ("multi_hop", 0.95))

    result = service.answer("سؤال متعدد القفزات", AnswerOptions())
    assert result["handler_used"] == "multi_hop"
    assert captured["calls"] == 1
    # The pre-classified type is handed to run so the dispatcher doesn't re-classify.
    assert captured["run_query_type"] == "multi_hop"
    # Confidently routed → backstop does NOT fire → KG stays available.
    assert captured["kwargs"]["kg_loader"] is not None


# ── BACKSTOP: an UNDETECTED type under replay forces kg_loader=None so the ───
#    dispatcher's regex-fallback classifier can't load the 74 MB KG.

def test_undetected_type_forces_kg_off_backstop(monkeypatch) -> None:
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service()
    # Our classify can't pin the type (unparseable LLM label) → _safe_classify None.
    monkeypatch.setattr(service, "classify", _FailingClassify())

    # A query the dispatcher's REGEX fallback would route temporal_factual.
    result = service.answer("متى صدر القانون المدني؟", AnswerOptions())

    assert result["answer_text"] == "ok"
    assert captured["run_query_type"] is None  # dispatcher classifies internally
    # kg_loader forced None → an undetected TF/CD abstains, never loads the KG.
    assert captured["kwargs"]["kg_loader"] is None


def test_undetected_type_under_live_mode_keeps_kg(monkeypatch) -> None:
    # LIVE_TF_CD="live" disables BOTH the redirect and the backstop.
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service(Settings(LIVE_TF_CD="live"))
    monkeypatch.setattr(service, "classify", _FailingClassify())

    service.answer("متى صدر القانون المدني؟", AnswerOptions())
    assert captured["kwargs"]["kg_loader"] is not None  # real KG path allowed


# ── LIVE_TF_CD="live" disables the guard → TF/CD runs the real path ──────────

def test_live_mode_does_not_redirect_tf_cd(monkeypatch) -> None:
    captured = _patch_build_counter(monkeypatch)
    service = _stubbed_service(Settings(LIVE_TF_CD="live"))

    result = service.answer("متى؟", AnswerOptions(query_type="temporal_factual"))
    assert captured["calls"] == 1
    assert captured["run_query_type"] == "temporal_factual"
    assert result["answer_text"] == "ok"


# ── SSE integration: a live TF/CD route serves a precomputed replay + note ───

def _parse_sse(text: str) -> list[tuple[str, str]]:
    events: list[tuple[str, str]] = []
    event = None
    data_lines: list[str] = []
    for line in text.splitlines():
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_lines.append(line[len("data:"):].strip())
        elif line == "":
            if event is not None:
                events.append((event, "\n".join(data_lines)))
            event, data_lines = None, []
    if event is not None:
        events.append((event, "\n".join(data_lines)))
    return events


def test_live_stream_tf_cd_falls_back_to_replay_with_note() -> None:
    # Manual TF/CD route → redirect BEFORE any dispatcher/LLM → fully offline.
    with TestClient(app) as client:
        response = client.post(
            "/api/answer/stream",
            json={
                "mode": "live",
                "query": "متى صدر القانون المدني؟",
                "options": {"query_type": "temporal_factual"},
            },
        )
    assert response.status_code == 200
    events = _parse_sse(response.text)
    kinds = [e for e, _ in events]
    assert "answer" in kinds and "done" in kinds and "error" not in kinds

    import json as _json
    answer = _json.loads(next(d for e, d in events if e == "answer"))
    done = _json.loads(next(d for e, d in events if e == "done"))
    assert answer["fallback"]["reason"] == "tf_cd"
    assert answer["fallback"]["note"]  # an honest, non-empty banner note
    assert done["mode"] == "replay"
    assert done["fallback"]["example_question_id"]


def test_nearest_endpoint_returns_example() -> None:
    with TestClient(app) as client:
        payload = client.get(
            "/api/answer/nearest", params={"query_type": "exact_article"}
        ).json()
    assert payload["question_id"]
    assert payload["query_type"] == "exact_article"
