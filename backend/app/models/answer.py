"""Pydantic models for the S4 live-answer / SSE / classify / config surface.

The control set mirrors ``akn_rlm/api/answer.py:_build_dispatcher`` — the
locked ``rlm_dispatched_full_phase_e_final`` config (Cite F1 = 0.3045). Every
``AnswerOptions`` default reproduces that config, so ``AnswerOptions()`` is the
deployable Phase E pipeline. See ``plan.md`` §5 (control map) for the
UI-control → real-backend-home mapping and ``plan.md`` §6 for the
``AnswerResponse`` contract this mirrors.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

# Canonical 8 ALB v3.0 query types (akn_rlm.rlm.classifier.VALID_QUERY_TYPES).
QUERY_TYPES: tuple[str, ...] = (
    "rule_application",
    "exact_article",
    "multi_hop",
    "unanswerable",
    "layman",
    "long_context",
    "conceptual_definitional",
    "temporal_factual",
)


# ---------------------------------------------------------------------------
# Request options
# ---------------------------------------------------------------------------


class EnhancerFlags(BaseModel):
    """Phase E ablation enhancers (advanced). E4/HyDE is NOT here — it has its
    own top-level ``hyde`` toggle. Each maps to a build-time env flag read by
    ``akn_rlm.rlm.enhancers._env_flag`` ({1,true,yes,on} = on; "0"/unset = off).
    All default OFF — the locked deployable config enables only E4 (HyDE)."""

    e1: bool = Field(False, description="E1 concept→amendment (AKN_E1_CONCEPT_AMENDMENT)")
    e2: bool = Field(False, description="E2 reverse-NLI verifier (AKN_E2_NLI_REVERSE)")
    e3: bool = Field(False, description="E3 paraphrase multi-query (AKN_E3_PARAPHRASE)")
    e5: bool = Field(False, description="E5 KG topology disambiguator (AKN_E5_KG_TOPOLOGY)")
    e6: bool = Field(False, description="E6 concept-KG channel (AKN_E6_CONCEPT_KG)")
    e7: bool = Field(False, description="E7 KG doc-router channel (AKN_E7_KG_DOC_ROUTER)")


class AnswerOptions(BaseModel):
    """Live-pipeline controls. Defaults == the locked Phase E config."""

    # null = classify (dispatcher.run(query, query_type=None)); else manual route.
    query_type: Optional[str] = Field(
        None, description="null = classifier picks; else force one of the 8 types"
    )
    # Phase D — gap-driven recursion + corrective retry.
    enable_recursion: bool = True
    recursion_max_depth: int = Field(3, ge=1, le=5)
    mh_ra_coverage_min: int = Field(
        4, ge=1, le=10,
        description="recursion_coverage_min override for multi_hop + rule_application",
    )
    enable_corrective_retry: bool = True
    # Phase C — pervasive Toulmin ADU.
    enable_pervasive_adu: bool = True
    adu_extract_top_n: int = Field(5, ge=1, le=20)
    # Phase E.4 — selective HyDE (env AKN_E4_HYDE).
    hyde: bool = True
    # Advanced ablation enhancers (env AKN_E{1,2,3,5,6,7}_*).
    enhancers: EnhancerFlags = Field(default_factory=EnhancerFlags)
    # Ceiling-breakers — request-safe kwarg (enable_ceiling_breakers).
    ceiling_breakers: bool = False
    # KG on/off — kg_loader present (TF/CD work) vs None (TF/CD abstain).
    use_kg: bool = True
    # Citation gate — presence-based env AKN_NO_CITATION_GATE ("1" when OFF).
    citation_gate: bool = True
    # Model overrides. None = locked deployable defaults from akn_rlm.config /
    # classifier / supervisor modules. Applied only when ALLOW_MODEL_OVERRIDE is
    # enabled; never via process-global env.
    classifier_model: Optional[str] = None
    sub_model: Optional[str] = None
    supervisor_model: Optional[str] = None
    # Long-context summariser timeout.
    long_context_timeout_s: float = Field(60.0, gt=0, le=600)


class AnswerRequest(BaseModel):
    query: str = Field(..., min_length=1)
    options: AnswerOptions = Field(default_factory=AnswerOptions)


class ClassifyRequest(BaseModel):
    query: str = Field(..., min_length=1)


class StreamRequest(BaseModel):
    """Body for ``POST /api/answer/stream``.

    * ``replay`` (offline, always works): needs ``question_id``.
    * ``live`` (needs LLM): needs ``query`` (+ optional ``options``).
    """

    mode: Literal["replay", "live"] = "replay"
    question_id: Optional[str] = None
    query: Optional[str] = None
    options: AnswerOptions = Field(default_factory=AnswerOptions)


# ---------------------------------------------------------------------------
# Response models (mirror akn_rlm/api/answer.py dataclasses)
# ---------------------------------------------------------------------------


class CitationModel(BaseModel):
    doc_id: str
    article_ref: str
    doc_title: str
    supporting_span: str
    text: str
    confidence: float
    version_date: Optional[str] = None
    kg_source: Optional[str] = None
    argumentation: Optional[dict[str, Any]] = None
    verifier_relevant: Optional[bool] = None


class TrajectoryStepModel(BaseModel):
    step: str
    depth: int
    summary: str
    detail: dict[str, Any] = Field(default_factory=dict)


class AnswerResponseModel(BaseModel):
    query: str
    query_type_predicted: str
    handler_used: str
    answer_text: str
    citations: list[CitationModel]
    references: list[str]
    trajectory: list[TrajectoryStepModel]
    abstained: bool
    abstention_reason: Optional[str] = None
    latency_s: float
    sub_call_count: int
    am_faithfulness_score: Optional[float] = None
    recursion_depth_max: int = 1
    corrective_retry_fired: bool = False


class ClassifyResponse(BaseModel):
    query_type: str
    confidence: float


# ---------------------------------------------------------------------------
# Pipeline config catalog (GET /api/pipeline/config) + reset
# ---------------------------------------------------------------------------


class PipelineOption(BaseModel):
    key: str
    type: str  # "bool" | "int" | "float" | "enum" | "string"
    default: Any
    allowed: Optional[list[Any]] = None
    advanced: bool = False
    requires_live: bool = True
    label: str
    help: str = ""


class PipelineModelOption(BaseModel):
    id: str
    label: str
    default: bool = False


class PipelineConfig(BaseModel):
    options: list[PipelineOption]
    query_types: list[str]
    defaults: dict[str, Any]
    models: dict[str, list[PipelineModelOption]] = Field(default_factory=dict)
    model_overrides_enabled: bool = True


class ResetResponse(BaseModel):
    ok: bool
    cleared: int


# ---------------------------------------------------------------------------
# SSE event payload models (documentation of the wire shapes the stream emits)
# ---------------------------------------------------------------------------


class StepEvent(BaseModel):
    index: int
    step: str
    depth: int
    summary: str
    detail: dict[str, Any] = Field(default_factory=dict)


class HeartbeatEvent(BaseModel):
    elapsed_s: float
    status: str = "running"


class ErrorEvent(BaseModel):
    detail: str


class DoneEvent(BaseModel):
    ok: bool = True
    mode: str
    n_steps: int = 0
