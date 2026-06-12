"""Shared conversion layer for live / manual / replay answers.

ALL three answer paths (auto-classified live, manually-routed live, and
offline precomputed replay) funnel a raw dispatcher-shaped dict through the
SAME converter, ``build_answer_response``, so the response shape is
byte-identical regardless of source. The converter reuses the existing
``akn_rlm/api/answer.py`` building blocks (``_to_citation``,
``_summarise_step``, ``_format_references``, ``_HANDLER_LABELS_AR``) rather
than reimplementing citation/trajectory/reference formatting — it is, in
effect, ``answer_query``'s tail factored out so the manual-routing and replay
paths cannot drift from the auto path.

Also hosts the static ``GET /api/pipeline/config`` control catalog and the
replay adapter that maps a precomputed predictions.jsonl record onto the live
``raw`` shape.
"""
from __future__ import annotations

import json
from typing import Any

from akn_rlm.api.answer import (
    AnswerResponse,
    TrajectoryStep,
    _HANDLER_LABELS_AR,
    _format_references,
    _summarise_step,
    _to_citation,
)

from ..models.answer import (
    QUERY_TYPES,
    AnswerOptions,
    PipelineModelOption,
    PipelineOption,
)
from ..settings import Settings, settings

#: Dispatcher abstain reasons that signal an *infrastructure* failure (LLM /
#: transport / build) rather than a genuine domain abstention. ``run`` swallows
#: handler exceptions into these envelopes instead of raising, so we inspect
#: the result to decide whether to surface a 503. Genuine ``unanswerable``
#: handler abstentions carry a different reason and stay a 200.
DISPATCH_FAILURE_REASONS: frozenset[str] = frozenset({
    "dispatch_build_error",
    "dispatch_pipeline_error",
    "dispatch_bad_answer_shape",
    "empty_query",
})


def is_dispatch_failure(raw: dict[str, Any]) -> bool:
    """True when a dispatcher result is an infra-failure envelope (→ 503)."""
    telemetry = raw.get("_telemetry") or {}
    if telemetry.get("error"):
        return True
    return raw.get("abstention_reason") in DISPATCH_FAILURE_REASONS


def build_answer_response(
    query: str,
    raw: dict[str, Any],
    latency_s: float,
) -> AnswerResponse:
    """Convert a dispatcher ``run`` dict into an ``AnswerResponse``.

    Mirrors ``akn_rlm.api.answer.answer_query``'s post-``run`` tail exactly,
    reusing its helpers. Unlike ``answer_query`` it accepts the raw dict and a
    pre-measured latency so the manual-routing and replay paths reuse it
    verbatim. ``am_faithfulness_score`` is read from ``raw`` when present
    (replay carries the precomputed score; a live ``raw`` has no such key, so
    this stays ``None`` exactly as ``answer_query`` produced).
    """
    telemetry = raw.get("_telemetry", {}) or {}
    citations_raw = raw.get("citations", []) or []
    trajectory_raw = raw.get("trajectory", []) or []

    citations = [_to_citation(c) for c in citations_raw]
    trajectory = [_summarise_step(s) for s in trajectory_raw]
    if not trajectory:
        handler = telemetry.get("dispatched_handler", "?")
        handler_ar = _HANDLER_LABELS_AR.get(handler, handler)
        n_cits = len(citations)
        trajectory.append(TrajectoryStep(
            step="handler_summary",
            depth=0,
            summary=f"المعالج: {handler_ar} — تم إصدار {n_cits} استشهاد",
            detail={
                "handler": handler,
                "n_citations": n_cits,
                "sub_call_count": telemetry.get("sub_call_count", 0),
            },
        ))
    references = _format_references(citations)

    am_score = raw.get("am_faithfulness_score")
    return AnswerResponse(
        query=query,
        query_type_predicted=str(telemetry.get("dispatched_query_type", "?")),
        handler_used=str(telemetry.get("dispatched_handler", "?")),
        answer_text=str(raw.get("answer_text", "") or ""),
        citations=citations,
        references=references,
        trajectory=trajectory,
        abstained=bool(raw.get("abstention", False)),
        abstention_reason=(str(raw["abstention_reason"])
                           if raw.get("abstention_reason") else None),
        latency_s=float(latency_s),
        sub_call_count=int(telemetry.get("sub_call_count", 0) or 0),
        am_faithfulness_score=(float(am_score) if am_score is not None else None),
        recursion_depth_max=int(telemetry.get(
            "recursion_depth_max", raw.get("depth_max_reached", 1)
        ) or 1),
        corrective_retry_fired=bool(
            (telemetry.get("corrective_retry") or {}).get("fired", False)
        ),
    )


# ---------------------------------------------------------------------------
# Replay adapter — precomputed predictions.jsonl record → live `raw` shape
# ---------------------------------------------------------------------------

_REPLAY_SCORE_KEYS: tuple[str, ...] = (
    "hcr",
    "jir",
    "answer_faithfulness",
    "citation_groundedness",
    "am_faithfulness_score",
)


def record_to_raw(record: dict[str, Any]) -> dict[str, Any]:
    """Map a precomputed prediction record onto the dispatcher ``run`` shape.

    Predictions use ``predicted_citations`` / ``predicted_abstain`` and carry
    telemetry flat at the top level, so we normalise them into the live
    ``raw`` keys ``build_answer_response`` expects.
    """
    trajectory = record.get("trajectory") or []
    depths = [int(step.get("depth", 0) or 0) for step in trajectory]
    return {
        "answer_text": record.get("answer_text", "") or "",
        "citations": record.get("predicted_citations") or [],
        "trajectory": trajectory,
        "abstention": bool(record.get("predicted_abstain")),
        "abstention_reason": record.get("abstention_reason"),
        "depth_max_reached": (max(depths) if depths else 1),
        "am_faithfulness_score": record.get("am_faithfulness_score"),
        "_telemetry": {
            "dispatched_handler": record.get("dispatched_handler"),
            "dispatched_query_type": record.get("query_type"),
            "sub_call_count": record.get("sub_call_count", 0),
            "recursion_depth_max": (max(depths) if depths else 1),
            "corrective_retry": {"fired": bool(record.get("retry_count"))},
        },
    }


def replay_response(record: dict[str, Any]) -> tuple[AnswerResponse, dict[str, Any]]:
    """Return ``(AnswerResponse, scores)`` for a precomputed record.

    ``scores`` carries the precomputed metric scores (hcr/jir/faithfulness/
    groundedness/am) that the locked run measured — surfaced in the SSE
    ``answer`` event so the Main-page replay shows the real per-q scores.
    """
    raw = record_to_raw(record)
    resp = build_answer_response(
        str(record.get("query", "") or ""),
        raw,
        float(record.get("latency_s") or 0.0),
    )
    scores = {key: record.get(key) for key in _REPLAY_SCORE_KEYS}
    return resp, scores


# ---------------------------------------------------------------------------
# Pipeline config catalog (GET /api/pipeline/config)
# ---------------------------------------------------------------------------

_DEFAULT_MODEL_CATALOG: dict[str, list[PipelineModelOption]] = {
    # Live generator knob in the dispatched path: AnswerOptions.sub_model.
    "generator": [
        PipelineModelOption(
            id="Qwen3-30B-A3B-Thinking",
            label="Qwen3-30B-A3B-Thinking — locked sub-LM generator; overrides also route HyDE, gap probe, and router tie-breaker",
            default=True,
        ),
        PipelineModelOption(id="gpt-oss-120b", label="gpt-oss-120b — AI Grid"),
        PipelineModelOption(
            id="google/gemma-4-31B",
            label="google/gemma-4-31B — AI Grid",
        ),
    ],
    # Live classifier knob: make_llm_classifier_fn(model=...).
    "classifier": [
        PipelineModelOption(
            id="google/gemma-4-31B",
            label="google/gemma-4-31B — locked query classifier",
            default=True,
        ),
        PipelineModelOption(id="gpt-oss-120b", label="gpt-oss-120b — AI Grid"),
        PipelineModelOption(
            id="Qwen3-30B-A3B-Thinking",
            label="Qwen3-30B-A3B-Thinking — AI Grid",
        ),
    ],
    # Real optional dispatched-path knob already accepted by RLMDispatcher.
    "supervisor": [
        PipelineModelOption(
            id="gpt-oss-120b",
            label="gpt-oss-120b — locked citation supervisor",
            default=True,
        ),
        PipelineModelOption(
            id="Qwen3-30B-A3B-Thinking",
            label="Qwen3-30B-A3B-Thinking — AI Grid",
        ),
        PipelineModelOption(
            id="google/gemma-4-31B",
            label="google/gemma-4-31B — AI Grid",
        ),
    ],
    # Honest Table 3.6 context: fixed local components, not live answer knobs.
    "fixed": [
        PipelineModelOption(
            id="intfloat/multilingual-e5-small",
            label="Dense encoder (fixed FAISS index; no live answer knob)",
            default=True,
        ),
        PipelineModelOption(
            id="MoritzLaurer/mDeBERTa-v3-base-mnli-xnli",
            label="Faithfulness NLI gate (fixed local model; no live answer knob)",
            default=True,
        ),
    ],
}


def pipeline_model_catalog(config: Settings = settings) -> dict[str, list[PipelineModelOption]]:
    """Return the offline-safe, config-editable model catalog.

    ``MODEL_CATALOG_JSON`` may override the default with a JSON object shaped
    like ``{"classifier": [{"id": "...", "label": "...", "default": true}]}``.
    Invalid JSON falls back to the curated locked-demo catalog so
    ``/pipeline/config`` remains offline and robust.
    """
    raw = (config.MODEL_CATALOG_JSON or "").strip()
    if not raw:
        return _clone_model_catalog(_DEFAULT_MODEL_CATALOG)
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("catalog root must be an object")
        catalog: dict[str, list[PipelineModelOption]] = {}
        for role, items in payload.items():
            if not isinstance(role, str) or not isinstance(items, list):
                continue
            parsed = [PipelineModelOption.model_validate(item) for item in items]
            if parsed:
                catalog[role] = parsed
        return catalog or _clone_model_catalog(_DEFAULT_MODEL_CATALOG)
    except Exception:
        return _clone_model_catalog(_DEFAULT_MODEL_CATALOG)


def _clone_model_catalog(
    catalog: dict[str, list[PipelineModelOption]],
) -> dict[str, list[PipelineModelOption]]:
    return {
        role: [PipelineModelOption.model_validate(item.model_dump()) for item in items]
        for role, items in catalog.items()
    }


def pipeline_config_options() -> list[PipelineOption]:
    """The control catalog the frontend renders the panel from. Defaults here
    MUST match ``AnswerOptions`` defaults (the locked Phase E config)."""
    d = AnswerOptions()  # default instance == locked config
    return [
        PipelineOption(
            key="query_type", type="enum", default=d.query_type,
            allowed=[None, *QUERY_TYPES], advanced=False, requires_live=True,
            label="Classifier / manual route",
            help="null = the LLM classifier picks the query type; or force one of the 8 types.",
        ),
        PipelineOption(
            key="enable_recursion", type="bool", default=d.enable_recursion,
            advanced=False, requires_live=True, label="RLM recursion",
            help="Gap-driven depth-2/3 retrieval passes (Phase D).",
        ),
        PipelineOption(
            key="recursion_max_depth", type="int", default=d.recursion_max_depth,
            allowed=[1, 2, 3, 4, 5], advanced=False, requires_live=True,
            label="Max recursion depth",
            help="Deepest recursion pass the gap-probe may request.",
        ),
        PipelineOption(
            key="mh_ra_coverage_min", type="int", default=d.mh_ra_coverage_min,
            advanced=True, requires_live=True, label="MH/RA coverage_min",
            help="recursion_coverage_min override for multi_hop + rule_application (Phase E.1).",
        ),
        PipelineOption(
            key="enable_corrective_retry", type="bool",
            default=d.enable_corrective_retry, advanced=False, requires_live=True,
            label="Corrective retry",
            help="Regenerate once on faithfulness-gate failure (Phase D).",
        ),
        PipelineOption(
            key="enable_pervasive_adu", type="bool",
            default=d.enable_pervasive_adu, advanced=False, requires_live=True,
            label="Pervasive ADU",
            help="Toulmin argument mining on every cited article (Phase C).",
        ),
        PipelineOption(
            key="adu_extract_top_n", type="int", default=d.adu_extract_top_n,
            advanced=False, requires_live=True, label="ADU top-N",
            help="How many top citations get a Toulmin block.",
        ),
        PipelineOption(
            key="hyde", type="bool", default=d.hyde,
            advanced=False, requires_live=True, label="HyDE (E4)",
            help="Selective hypothetical-document dense retrieval (off for TF/CD). env AKN_E4_HYDE.",
        ),
        PipelineOption(
            key="ceiling_breakers", type="bool", default=d.ceiling_breakers,
            advanced=True, requires_live=True, label="Ceiling-breakers",
            help="NLI verifier + LLM doc-router tie-breaker + concept→amendment helper.",
        ),
        PipelineOption(
            key="use_kg", type="bool", default=d.use_kg,
            advanced=False, requires_live=True, label="Knowledge graph",
            help="When off, KG-backed TF/CD handlers abstain (kg_loader=None).",
        ),
        PipelineOption(
            key="citation_gate", type="bool", default=d.citation_gate,
            advanced=True, requires_live=True, label="Citation gate",
            help="env AKN_NO_CITATION_GATE (bypass when off). Consumed by the freeform RootController path.",
        ),
        PipelineOption(
            key="classifier_model", type="string", default=d.classifier_model,
            advanced=True, requires_live=True, label="Classifier model",
            help="Override the LLM query classifier model. None = locked google/gemma-4-31B.",
        ),
        PipelineOption(
            key="sub_model", type="string", default=d.sub_model,
            advanced=True, requires_live=True, label="Generator / sub-LM model",
            help="Override the sub-LM model id. Non-default overrides also drive HyDE, recursion gap probe, and router tie-breaker calls.",
        ),
        PipelineOption(
            key="supervisor_model", type="string", default=d.supervisor_model,
            advanced=True, requires_live=True, label="Supervisor model",
            help="Override the citation supervisor model. None = locked gpt-oss-120b.",
        ),
        PipelineOption(
            key="long_context_timeout_s", type="float",
            default=d.long_context_timeout_s, advanced=True, requires_live=True,
            label="Long-context timeout (s)",
            help="Wall-clock budget before the long_context summariser falls back to template.",
        ),
        PipelineOption(
            key="enhancers.e1", type="bool", default=d.enhancers.e1,
            advanced=True, requires_live=True, label="E1 concept→amendment",
            help="env AKN_E1_CONCEPT_AMENDMENT. Ablation enhancer (no measured Cite F1 lift).",
        ),
        PipelineOption(
            key="enhancers.e2", type="bool", default=d.enhancers.e2,
            advanced=True, requires_live=True, label="E2 reverse-NLI",
            help="env AKN_E2_NLI_REVERSE.",
        ),
        PipelineOption(
            key="enhancers.e3", type="bool", default=d.enhancers.e3,
            advanced=True, requires_live=True, label="E3 paraphrase",
            help="env AKN_E3_PARAPHRASE multi-query fusion.",
        ),
        PipelineOption(
            key="enhancers.e5", type="bool", default=d.enhancers.e5,
            advanced=True, requires_live=True, label="E5 KG topology",
            help="env AKN_E5_KG_TOPOLOGY disambiguator (MH).",
        ),
        PipelineOption(
            key="enhancers.e6", type="bool", default=d.enhancers.e6,
            advanced=True, requires_live=True, label="E6 concept-KG",
            help="env AKN_E6_CONCEPT_KG channel (MH/RA).",
        ),
        PipelineOption(
            key="enhancers.e7", type="bool", default=d.enhancers.e7,
            advanced=True, requires_live=True, label="E7 KG doc-router",
            help="env AKN_E7_KG_DOC_ROUTER channel (measured to explode router latency).",
        ),
    ]
