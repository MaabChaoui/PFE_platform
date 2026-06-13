from __future__ import annotations

import os
from unittest.mock import Mock

import akn_rlm.rlm.classifier as classifier_mod
import akn_rlm.rlm.dispatcher as dispatcher_mod
import pytest
from fastapi.testclient import TestClient

from akn_rlm.config import SUB_LLM_MODEL
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


def test_generator_override_cascades_to_auxiliary_models(monkeypatch) -> None:
    captured = _patch_build(monkeypatch)

    service = _stubbed_service()
    service.get_dispatcher(AnswerOptions(sub_model="google/gemma-4-31B"))
    kwargs = captured["kwargs"]
    assert kwargs["sub_model"] == "google/gemma-4-31B"
    assert kwargs["hyde_model"] == "google/gemma-4-31B"
    assert kwargs["recursion_probe_model"] == "google/gemma-4-31B"
    assert kwargs["router_tiebreak_model"] == "google/gemma-4-31B"

    service = _stubbed_service()
    service.get_dispatcher(AnswerOptions())
    kwargs = captured["kwargs"]
    assert "hyde_model" not in kwargs
    assert "recursion_probe_model" not in kwargs
    assert "router_tiebreak_model" not in kwargs

    service = _stubbed_service()
    service.get_dispatcher(AnswerOptions(sub_model=SUB_LLM_MODEL))
    kwargs = captured["kwargs"]
    assert kwargs["sub_model"] == SUB_LLM_MODEL
    assert "hyde_model" not in kwargs
    assert "recursion_probe_model" not in kwargs
    assert "router_tiebreak_model" not in kwargs


def test_demo_default_model_applies_to_all_roles_and_cascade(monkeypatch) -> None:
    # SFIX-2 (a): demo default + no overrides ⇒ gemma everywhere, incl. the
    # generator's auxiliary cascade (HyDE / gap probe / router tie-breaker).
    captured = _patch_build(monkeypatch)
    classifier_capture = _patch_classifier(monkeypatch)
    config = Settings(DEMO_DEFAULT_MODEL="google/gemma-4-31B")
    service = _stubbed_service(config)

    service.get_dispatcher(AnswerOptions())

    kwargs = captured["kwargs"]
    assert kwargs["sub_model"] == "google/gemma-4-31B"
    assert kwargs["supervisor_model"] == "google/gemma-4-31B"
    assert classifier_capture["model"] == "google/gemma-4-31B"
    assert kwargs["hyde_model"] == "google/gemma-4-31B"
    assert kwargs["recursion_probe_model"] == "google/gemma-4-31B"
    assert kwargs["router_tiebreak_model"] == "google/gemma-4-31B"


def test_explicit_locked_generator_suppresses_demo_cascade(monkeypatch) -> None:
    # SFIX-2 (b): explicitly selecting the locked Phase E generator must
    # reproduce the thesis pipeline exactly even when a demo default is set.
    captured = _patch_build(monkeypatch)
    config = Settings(DEMO_DEFAULT_MODEL="google/gemma-4-31B")
    service = _stubbed_service(config)

    service.get_dispatcher(AnswerOptions(sub_model=SUB_LLM_MODEL))

    kwargs = captured["kwargs"]
    assert kwargs["sub_model"] == SUB_LLM_MODEL
    assert "hyde_model" not in kwargs
    assert "recursion_probe_model" not in kwargs
    assert "router_tiebreak_model" not in kwargs


def test_options_key_normalizes_demo_default(monkeypatch) -> None:
    # SFIX-2 (c): "no override" and "explicit demo model" share one key (and
    # one memoized dispatcher); the locked generator stays a distinct combo.
    demo = "google/gemma-4-31B"
    no_override = _options_key(AnswerOptions(), demo_default_model=demo)
    explicit = _options_key(
        AnswerOptions(
            classifier_model=demo, sub_model=demo, supervisor_model=demo
        ),
        demo_default_model=demo,
    )
    assert no_override == explicit
    locked = _options_key(AnswerOptions(sub_model=SUB_LLM_MODEL), demo_default_model=demo)
    assert locked != no_override

    captured = _patch_build(monkeypatch)
    service = _stubbed_service(Settings(DEMO_DEFAULT_MODEL=demo))
    first = service.get_dispatcher(AnswerOptions())
    second = service.get_dispatcher(AnswerOptions(sub_model=demo))
    assert first is second
    assert captured["calls"] == 1


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


# ---------------------------------------------------------------------------
# SFIX-2 — HyDE observer → synthetic `hyde` trajectory step (live runs only)
# ---------------------------------------------------------------------------


def _patch_hyde_dispatcher(
    monkeypatch, *, fire_observer: bool, hyde_answer: str = "جواب افتراضي"
) -> None:
    """A fake dispatcher whose run fires the captured ``hyde_observer`` (or
    not) and returns a minimal valid raw result with a ``route`` step."""

    def fake_build(**kwargs):
        observer = kwargs.get("hyde_observer")

        class _Disp:
            def run(self, query, query_type=None):
                if fire_observer and observer is not None:
                    observer(query, hyde_answer)
                return {
                    "answer_text": "نص الجواب",
                    "citations": [],
                    "trajectory": [
                        {"step": "route", "depth": 0, "routed_doc_ids": ["doc"]},
                        {"step": "rank", "depth": 0},
                    ],
                    "abstention": False,
                    "abstention_reason": None,
                    "_telemetry": {
                        "dispatched_handler": "rule_application",
                        "dispatched_query_type": "rule_application",
                        "sub_call_count": 1,
                    },
                }

        return _Disp()

    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", fake_build)


def test_hyde_step_injected_after_route(monkeypatch) -> None:
    from akn_rlm.rlm.enhancers import DEFAULT_HYDE_MODEL

    _patch_hyde_dispatcher(monkeypatch, fire_observer=True)
    service = _stubbed_service()

    resp = service.answer("ما هي شروط الزواج؟", AnswerOptions())

    steps = [s["step"] for s in resp["trajectory"]]
    assert steps.index("hyde") == steps.index("route") + 1
    hyde = next(s for s in resp["trajectory"] if s["step"] == "hyde")
    assert hyde["depth"] == 0
    assert hyde["detail"] == {
        "hypothetical_answer": "جواب افتراضي",
        "model": DEFAULT_HYDE_MODEL,
        "channel": "dense_only",
        "degraded": False,
    }
    # The entry is consumed per query (a later run re-records via cache hit).
    assert service._hyde_runs == {}


def test_hyde_step_degraded_when_generation_failed(monkeypatch) -> None:
    _patch_hyde_dispatcher(monkeypatch, fire_observer=True, hyde_answer="")
    service = _stubbed_service()

    resp = service.answer("ما هي شروط الزواج؟", AnswerOptions())

    hyde = next(s for s in resp["trajectory"] if s["step"] == "hyde")
    assert hyde["detail"]["degraded"] is True
    assert hyde["detail"]["hypothetical_answer"] == ""


def test_no_hyde_step_without_observer_entry(monkeypatch) -> None:
    _patch_hyde_dispatcher(monkeypatch, fire_observer=False)
    service = _stubbed_service()

    resp = service.answer("ما هي شروط الزواج؟", AnswerOptions())

    assert all(s["step"] != "hyde" for s in resp["trajectory"])


def test_no_hyde_step_when_hyde_option_off(monkeypatch) -> None:
    _patch_hyde_dispatcher(monkeypatch, fire_observer=True)
    service = _stubbed_service()

    resp = service.answer("ما هي شروط الزواج؟", AnswerOptions(hyde=False))

    assert all(s["step"] != "hyde" for s in resp["trajectory"])


# ---------------------------------------------------------------------------
# SFIX-3 — KG retrieval enrichment of TF/CD trajectory steps + citation
# kg_hit → kg_source lift (live path only; stubbed raw dicts, no KG, no LLM)
# ---------------------------------------------------------------------------


def _patch_raw_dispatcher(monkeypatch, raw: dict) -> None:
    """build_dispatcher → a dispatcher whose run returns ``raw`` verbatim."""

    def fake_build(**_kwargs):
        class _Disp:
            def run(self, query, query_type=None):
                return raw

        return _Disp()

    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", fake_build)


def _tf_raw() -> dict:
    chains = [
        {
            "doc_id": f"84-1{i}", "article_ref": str(i), "picked": "2005-06-20",
            "source": "kg" if i % 2 else "fallback", "uri": f"http://akn/{i}",
            "chain_len": 2, "chain_dates": ["1984-06-09", "2005-06-20"],
            "internal_cursor": i,  # must be dropped by the reduction
        }
        for i in range(14)
    ]
    # Recursion re-verifies article 1: a duplicate fallback trace that must be
    # deduped (the existing richer source="kg" trace wins).
    chains.append({
        "doc_id": "84-11", "article_ref": "1", "picked": None,
        "source": "fallback", "uri": "http://akn/1", "chain_len": 0,
        "chain_dates": [],
    })
    kg_first = [{
        "depth": 1, "query": "q", "hybrid_count": 24, "kg_first_count": 6,
        "kg_first_hits": [["84-11", "53"]], "merged_pool_size": 27,
        "top_slice_size": 9, "kg_first_in_top_slice": 4,
        "kg_first_uri_resolved": 3, "kg_first_in_verified": 2,
    }]
    return {
        "answer_text": "نص الجواب",
        "citations": [{"doc_id": "84-11", "article_ref": "53", "confidence": 0.9,
                       "kg_source": "kg"}],
        "trajectory": [
            {"step": "extract_date", "depth": 0, "dates": [], "target": "2007-05-13"},
            {"step": "kg_chain", "depth": 1, "candidates": 9, "verified": 2},
        ],
        "abstention": False,
        "abstention_reason": None,
        "_telemetry": {
            "dispatched_handler": "temporal_factual",
            "dispatched_query_type": "temporal_factual",
            "sub_call_count": 1,
            "target_date": "2007-05-13",
            "amendment_chains": chains,
            "tf_kg_first_telemetry": kg_first,
        },
    }


def test_kg_chain_step_enriched_from_tf_telemetry(monkeypatch) -> None:
    _patch_raw_dispatcher(monkeypatch, _tf_raw())
    # LIVE_TF_CD="live": the default "replay" guard would redirect TF/CD before
    # the (stubbed) dispatcher runs. No KG is loaded — run() is a stub.
    service = _stubbed_service(Settings(LIVE_TF_CD="live"))

    resp = service.answer("متى عُدلت المادة؟", AnswerOptions(query_type="temporal_factual"))

    step = next(s for s in resp["trajectory"] if s["step"] == "kg_chain")
    detail = step["detail"]
    # Existing counts kept.
    assert detail["candidates"] == 9 and detail["verified"] == 2
    # Chains deduped per (doc_id, article_ref), capped at 12, reduced to the
    # UI keys (incl. the version timeline).
    assert len(detail["amendment_chains"]) == 12
    assert set(detail["amendment_chains"][0]) == {
        "doc_id", "article_ref", "picked", "source", "uri",
        "chain_len", "chain_dates",
    }
    assert detail["amendment_chains"][0]["chain_dates"] == [
        "1984-06-09", "2005-06-20",
    ]
    # The duplicate 84-11/1 trace collapsed into ONE entry; the richer
    # source="kg" trace won over the recursion-depth fallback duplicate.
    entries = [
        c for c in detail["amendment_chains"]
        if (c["doc_id"], c["article_ref"]) == ("84-11", "1")
    ]
    assert len(entries) == 1 and entries[0]["source"] == "kg"
    # Reference date forwarded for the timeline rendering.
    assert detail["kg_target_date"] == "2007-05-13"
    # Funnel telemetry passed through as-is.
    assert detail["kg_first"][0]["hybrid_count"] == 24
    assert detail["kg_first"][0]["kg_first_hits"] == [["84-11", "53"]]
    # TF's explicit kg_source survives untouched.
    assert resp["citations"][0]["kg_source"] == "kg"


def test_candidate_pool_step_enriched_from_cd_telemetry(monkeypatch) -> None:
    hits = [{"doc_id": "84-11", "article_ref": "4", "phrase_matches": 2.0,
             "span": "نص المادة"}]
    raw = {
        "answer_text": "نص",
        "citations": [
            {"doc_id": "84-11", "article_ref": "4", "confidence": 0.8, "kg_hit": True},
            {"doc_id": "84-11", "article_ref": "5", "confidence": 0.7, "kg_hit": True,
             "kg_source": "fallback"},
            {"doc_id": "84-11", "article_ref": "6", "confidence": 0.6, "kg_hit": False},
        ],
        "trajectory": [
            {"step": "candidate_pool", "depth": 1, "phrases": ["زواج"],
             "kg_hits": 3, "verified": 2},
        ],
        "abstention": False,
        "abstention_reason": None,
        "_telemetry": {
            "dispatched_handler": "conceptual_definitional",
            "dispatched_query_type": "conceptual_definitional",
            "sub_call_count": 1,
            "kg_used": True,
            "kg_hit_articles": hits,
        },
    }
    _patch_raw_dispatcher(monkeypatch, raw)
    service = _stubbed_service(Settings(LIVE_TF_CD="live"))

    resp = service.answer(
        "ما تعريف الزواج؟", AnswerOptions(query_type="conceptual_definitional")
    )

    step = next(s for s in resp["trajectory"] if s["step"] == "candidate_pool")
    assert step["detail"]["kg_hits"] == 3  # existing count kept
    assert step["detail"]["kg_used"] is True
    assert step["detail"]["kg_hit_articles"] == hits
    # kg_hit lifted into kg_source; explicit "fallback" preserved; False → none.
    by_ref = {c["article_ref"]: c for c in resp["citations"]}
    assert by_ref["4"]["kg_source"] == "kg"
    assert by_ref["5"]["kg_source"] == "fallback"
    assert by_ref["6"]["kg_source"] is None


def test_kg_enrichment_noop_without_telemetry(monkeypatch) -> None:
    raw = {
        "answer_text": "نص",
        "citations": [{"doc_id": "84-11", "article_ref": "7", "confidence": 0.5}],
        "trajectory": [
            {"step": "kg_chain", "depth": 1, "candidates": 3, "verified": 1},
            {"step": "candidate_pool", "depth": 1, "kg_hits": 0, "verified": 1},
        ],
        "abstention": False,
        "abstention_reason": None,
        "_telemetry": {
            "dispatched_handler": "temporal_factual",
            "dispatched_query_type": "temporal_factual",
            "sub_call_count": 0,
        },
    }
    _patch_raw_dispatcher(monkeypatch, raw)
    service = _stubbed_service(Settings(LIVE_TF_CD="live"))

    resp = service.answer("سؤال", AnswerOptions(query_type="temporal_factual"))

    kg_chain = next(s for s in resp["trajectory"] if s["step"] == "kg_chain")
    pool = next(s for s in resp["trajectory"] if s["step"] == "candidate_pool")
    assert "amendment_chains" not in kg_chain["detail"]
    assert "kg_first" not in kg_chain["detail"]
    assert "kg_used" not in pool["detail"]
    assert "kg_hit_articles" not in pool["detail"]
    assert resp["citations"][0]["kg_source"] is None


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
