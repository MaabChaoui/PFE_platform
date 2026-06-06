from __future__ import annotations

import os
from unittest.mock import Mock

import akn_rlm.rlm.classifier as classifier_mod
import akn_rlm.rlm.dispatcher as dispatcher_mod
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.answer import AnswerOptions, EnhancerFlags
from app.services.pipeline import PipelineLiveError, PipelineService, _options_key
from app.settings import Settings, settings

# Env keys PipelineService mutates at dispatcher-build time.
MANAGED_KEYS = [
    "AKN_E1_CONCEPT_AMENDMENT",
    "AKN_E2_NLI_REVERSE",
    "AKN_E3_PARAPHRASE",
    "AKN_E4_HYDE",
    "AKN_E5_KG_TOPOLOGY",
    "AKN_E6_CONCEPT_KG",
    "AKN_E7_KG_DOC_ROUTER",
    "AKN_ENHANCERS",
    "AKN_NO_CITATION_GATE",
]

MODEL_CHOICE_ENV_KEYS = [
    "ROOT_LLM_MODEL",
    "SUB_LLM_MODEL",
    "FALLBACK_MODEL",
]


def _stubbed_service(config=settings) -> PipelineService:
    """A PipelineService with every heavy singleton stubbed so get_dispatcher
    never loads BM25/Dense/LLM/registry (hermetic, no model download)."""
    service = PipelineService(config)
    service._loaded = True
    service._registry = Mock(name="registry")
    service._bm25 = Mock(name="bm25")
    service._dense = Mock(name="dense")
    service._llm_pool = Mock(name="llm_pool")
    service._router = Mock(name="router")
    return service


def _patch_build(monkeypatch) -> dict:
    """Patch build_dispatcher to capture kwargs + an os.environ snapshot taken
    INSIDE the call (PipelineService restores env in a finally, so a snapshot
    after the call would see the restored values, not the build-time ones)."""
    captured: dict = {"calls": 0}

    def fake_build(**kwargs):
        captured["calls"] += 1
        captured["kwargs"] = kwargs
        captured["env"] = {
            key: os.environ.get(key)
            for key in [*MANAGED_KEYS, *MODEL_CHOICE_ENV_KEYS]
        }
        return Mock(name="dispatcher")

    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", fake_build)
    return captured


def _patch_classifier(monkeypatch) -> dict:
    captured: dict = {}

    def fake_make_llm_classifier_fn(pool, *, model, max_tokens=32):
        captured["pool"] = pool
        captured["model"] = model
        captured["max_tokens"] = max_tokens

        def _fn(query: str) -> str:
            captured["query"] = query
            return "multi_hop"

        return _fn

    monkeypatch.setattr(
        classifier_mod, "make_llm_classifier_fn", fake_make_llm_classifier_fn
    )
    return captured


def test_default_options_reproduce_locked_config(monkeypatch) -> None:
    captured = _patch_build(monkeypatch)
    pre = {key: os.environ.get(key) for key in MANAGED_KEYS}
    pre_model_env = {key: os.environ.get(key) for key in MODEL_CHOICE_ENV_KEYS}
    service = _stubbed_service()

    defaults = AnswerOptions()
    assert defaults.classifier_model is None
    assert defaults.sub_model is None
    assert defaults.supervisor_model is None
    key = dict(_options_key(defaults))
    assert key["classifier_model"] is None
    assert key["sub_model"] is None
    assert key["supervisor_model"] is None
    assert "root_model" not in key

    service.get_dispatcher(defaults)

    kwargs = captured["kwargs"]
    assert kwargs["enable_recursion"] is True
    assert kwargs["recursion_max_depth"] == 3
    assert kwargs["enable_corrective_retry"] is True
    assert kwargs["enable_pervasive_adu"] is True
    assert kwargs["adu_extract_top_n"] == 5
    assert kwargs["enable_ceiling_breakers"] is False
    assert kwargs["long_context_timeout_s"] == 60.0
    assert kwargs["recursion_coverage_min_overrides"] == {
        "multi_hop": 4,
        "rule_application": 4,
    }
    # Locked config: HyDE on, gate on (env UNSET, not "0"), no enhancers.
    env = captured["env"]
    assert env["AKN_E4_HYDE"] == "1"
    assert env["AKN_NO_CITATION_GATE"] is None
    assert env["AKN_ENHANCERS"] == "0"
    for key in ("AKN_E1_CONCEPT_AMENDMENT", "AKN_E2_NLI_REVERSE",
                "AKN_E3_PARAPHRASE", "AKN_E5_KG_TOPOLOGY",
                "AKN_E6_CONCEPT_KG", "AKN_E7_KG_DOC_ROUTER"):
        assert env[key] == "0"
    # kg on → a kg_loader is supplied (TF/CD can resolve).
    assert kwargs["kg_loader"] is not None
    assert "sub_model" not in kwargs
    assert "supervisor_model" not in kwargs
    # Env fully restored after the build (finally block).
    assert {key: os.environ.get(key) for key in MANAGED_KEYS} == pre
    assert {key: os.environ.get(key) for key in MODEL_CHOICE_ENV_KEYS} == pre_model_env


def test_custom_options_map_to_kwargs_and_env(monkeypatch) -> None:
    captured = _patch_build(monkeypatch)
    classifier_capture = _patch_classifier(monkeypatch)
    pre_model_env = {key: os.environ.get(key) for key in MODEL_CHOICE_ENV_KEYS}
    service = _stubbed_service()

    options = AnswerOptions(
        hyde=False,
        citation_gate=False,
        ceiling_breakers=True,
        enable_recursion=False,
        mh_ra_coverage_min=6,
        adu_extract_top_n=8,
        classifier_model="gpt-oss-120b",
        sub_model="custom/model",
        supervisor_model="google/gemma-4-31B",
        use_kg=False,
        enhancers=EnhancerFlags(e2=True, e6=True),
    )
    service.get_dispatcher(options)

    kwargs = captured["kwargs"]
    assert kwargs["enable_recursion"] is False
    assert kwargs["enable_ceiling_breakers"] is True
    assert kwargs["adu_extract_top_n"] == 8
    assert kwargs["sub_model"] == "custom/model"
    assert kwargs["supervisor_model"] == "google/gemma-4-31B"
    assert classifier_capture["model"] == "gpt-oss-120b"
    assert kwargs["classifier_fn"]("probe") == "multi_hop"
    assert classifier_capture["query"] == "probe"
    assert kwargs["recursion_coverage_min_overrides"] == {
        "multi_hop": 6,
        "rule_application": 6,
    }
    assert kwargs["kg_loader"] is None  # use_kg=False → TF/CD abstain

    env = captured["env"]
    assert env["AKN_E4_HYDE"] == "0"
    assert env["AKN_NO_CITATION_GATE"] == "1"  # gate OFF → set "1"
    assert env["AKN_E2_NLI_REVERSE"] == "1"
    assert env["AKN_E6_CONCEPT_KG"] == "1"
    assert env["AKN_E1_CONCEPT_AMENDMENT"] == "0"
    assert {key: os.environ.get(key) for key in MODEL_CHOICE_ENV_KEYS} == pre_model_env


def test_model_override_flag_ignores_model_fields(monkeypatch) -> None:
    captured = _patch_build(monkeypatch)
    classifier_capture = _patch_classifier(monkeypatch)
    config = Settings(ALLOW_MODEL_OVERRIDE=False)
    service = _stubbed_service(config)

    options = AnswerOptions(
        classifier_model="gpt-oss-120b",
        sub_model="custom/model",
        supervisor_model="google/gemma-4-31B",
    )
    assert dict(_options_key(options, allow_model_override=False))["sub_model"] is None

    service.get_dispatcher(options)

    kwargs = captured["kwargs"]
    assert "sub_model" not in kwargs
    assert "supervisor_model" not in kwargs
    assert classifier_capture["model"] == "google/gemma-4-31B"


def test_live_model_failure_becomes_pipeline_live_error(monkeypatch) -> None:
    class FailingDispatcher:
        def run(self, query: str, query_type=None):
            raise ValueError("unsupported model id")

    monkeypatch.setattr(
        dispatcher_mod, "build_dispatcher", lambda **_kwargs: FailingDispatcher()
    )
    service = _stubbed_service()

    with pytest.raises(PipelineLiveError, match="live pipeline error"):
        service.answer("ما هي شروط الزواج؟", AnswerOptions(sub_model="bad/model"))


def test_memoization_and_reset(monkeypatch) -> None:
    captured = _patch_build(monkeypatch)
    service = _stubbed_service()

    first = service.get_dispatcher(AnswerOptions())
    second = service.get_dispatcher(AnswerOptions())
    assert first is second
    assert captured["calls"] == 1  # built once for the same options key

    # query_type is NOT part of the build key (manual routing is a run arg).
    same_combo = service.get_dispatcher(AnswerOptions(query_type="multi_hop"))
    assert same_combo is first
    assert captured["calls"] == 1

    # A different combo builds a second dispatcher.
    service.get_dispatcher(AnswerOptions(hyde=False))
    assert captured["calls"] == 2

    cleared = service.reset_dispatchers()
    assert cleared == 2
    service.get_dispatcher(AnswerOptions())
    assert captured["calls"] == 3  # cache cleared → rebuilt


def _parse_sse(text: str) -> list[tuple[str, str]]:
    """Parse an SSE wire body into a list of (event, data) pairs."""
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


def test_stream_replay_emits_steps_answer_done() -> None:
    # fixture-q1 has 2 precomputed trajectory steps → 2 `step` events.
    with TestClient(app) as client:
        response = client.post(
            "/api/answer/stream",
            json={"mode": "replay", "question_id": "fixture-q1"},
        )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    kinds = [event for event, _ in events]
    assert kinds.count("step") == 2
    assert kinds.count("answer") == 1
    assert kinds.count("done") == 1
    # step → answer → done ordering: all steps precede the answer.
    assert kinds.index("answer") > max(i for i, k in enumerate(kinds) if k == "step")
    assert kinds.index("done") == len(kinds) - 1

    import json as _json
    answer_payload = _json.loads(
        next(data for event, data in events if event == "answer")
    )
    assert answer_payload["query_type_predicted"]
    assert "scores" in answer_payload  # replay carries precomputed scores
    assert answer_payload["answer_text"] == "fixture answer"


def test_stream_replay_unknown_question_404() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/answer/stream",
            json={"mode": "replay", "question_id": "does-not-exist"},
        )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Live tests — skipped by default (`-m "not live"`); need a reachable LLM.
# They assert *graceful* behaviour (never a 500), so they pass whether the
# endpoint is up (200 answer) or down (clean 503), per the S4 brief.
# ---------------------------------------------------------------------------

LIVE_QUERY = "ما هي شروط الزواج في قانون الأسرة؟"


@pytest.mark.live
def test_live_classify_graceful() -> None:
    with TestClient(app) as client:
        response = client.post("/api/classify", json={"query": "متى صدر القانون المدني؟"})
    assert response.status_code in (200, 503)
    if response.status_code == 200:
        payload = response.json()
        from app.models.answer import QUERY_TYPES
        assert payload["query_type"] in QUERY_TYPES
        assert 0.0 <= payload["confidence"] <= 1.0
    else:
        assert response.json()["detail"]


@pytest.mark.live
def test_live_answer_graceful() -> None:
    with TestClient(app) as client:
        response = client.post("/api/answer", json={"query": LIVE_QUERY, "options": {}})
    assert response.status_code in (200, 503)  # never a 500
    if response.status_code == 200:
        payload = response.json()
        assert payload["query_type_predicted"]
        assert isinstance(payload["trajectory"], list)
    else:
        assert response.json()["detail"]


@pytest.mark.live
def test_live_stream_graceful() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/answer/stream",
            json={"mode": "live", "query": LIVE_QUERY, "options": {}},
        )
    assert response.status_code == 200
    events = [e for e, _ in _parse_sse(response.text)]
    # Either it completed (answer + done) or it errored — never empty/crash.
    assert "answer" in events or "error" in events
