from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MetricsResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    overall: dict[str, Any] = Field(default_factory=dict)
    by_query_type: dict[str, Any] = Field(default_factory=dict)
    by_category: dict[str, Any] = Field(default_factory=dict)
    by_difficulty: dict[str, Any] = Field(default_factory=dict)
    by_language: dict[str, Any] = Field(default_factory=dict)
    by_split: dict[str, Any] = Field(default_factory=dict)
    temporal: dict[str, Any] = Field(default_factory=dict)
    counts: dict[str, Any] = Field(default_factory=dict)


class RunSummary(BaseModel):
    run_id: str
    citation_f1: float | None = None
    abstention_f1: float | None = None
    hcr: float | None = None
    jir: float | None = None
    is_locked: bool = False


class BaselinesResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    improvement_factors: dict[str, float]
    tier1_direct_llm: list[dict[str, Any]]
    tier2_deterministic_rag: list[dict[str, Any]]
    phase_progression: list[dict[str, Any]]
    ablation: list[dict[str, Any]]
    notes: Any
    metric_definitions: dict[str, str]


class ClassificationTypeMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: int


class ClassificationResponse(BaseModel):
    accuracy: float
    n: int
    per_type: dict[str, ClassificationTypeMetrics]
    confusion_matrix: dict[str, dict[str, int]]
    labels: list[str]
