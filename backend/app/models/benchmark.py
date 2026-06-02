from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Correctness(BaseModel):
    n_gold: int = 0
    n_pred: int = 0
    n_correct: int = 0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    abstention_scored: bool = False


class BenchmarkQuestionSummary(BaseModel):
    id: str
    query_type: str
    difficulty: str
    category: str
    language: str
    answerable: bool
    question: str
    dispatched_handler: str | None = None
    predicted_abstain: bool | None = None
    latency_s: float | None = None
    correctness: Correctness
    has_prediction: bool


class BenchmarkQuestionPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[BenchmarkQuestionSummary]


class ExpectedArticle(BaseModel):
    model_config = ConfigDict(extra="allow")

    document_id: str
    article_ref: str
    law_name_ar: str | None = None
    in_dataset: bool = True
    article_ref_disambig: str | None = None
    text: str | None = None
    resolved: bool = False
    resolved_doc_id: str | None = None
    eid: str | None = None
    doc_title: str | None = None
    ancestors: dict[str, str] = Field(default_factory=dict)


class PredictionView(BaseModel):
    model_config = ConfigDict(extra="allow")

    question_id: str | None = None
    query: str | None = None
    query_type: str | None = None
    dispatched_handler: str | None = None
    pred_doc_ids: list[str] = Field(default_factory=list)
    pred_article_ids: list[str] = Field(default_factory=list)
    gold_doc_ids: list[str] = Field(default_factory=list)
    gold_article_ids: list[str] = Field(default_factory=list)
    predicted_citations: list[dict[str, Any]] = Field(default_factory=list)
    gold_citations: list[dict[str, Any]] = Field(default_factory=list)
    predicted_abstain: bool | None = None
    gold_abstain: bool | None = None
    answer_text: str | None = None
    gold_answer_text: str | None = None
    reasoning_chain: list[Any] = Field(default_factory=list)
    trajectory: list[dict[str, Any]] = Field(default_factory=list)
    hcr: float | None = None
    jir: float | None = None
    answer_faithfulness: float | None = None
    citation_groundedness: float | None = None
    am_faithfulness_score: float | None = None
    latency_s: float | None = None
    sub_call_count: int | None = None
    calls_by_model: dict[str, int] = Field(default_factory=dict)
    retry_count: int | None = None
    legal_category: str | None = None
    difficulty: str | None = None
    language: str | None = None
    split: str | None = None
    correctness: Correctness | None = None


class BenchmarkQuestionDetail(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    version: str | None = None
    source: str | None = None
    split: str | None = None
    language: str
    category: str
    query_type: str
    difficulty: str
    question: str
    answerable: bool
    partially_answerable: bool | None = None
    temporal_note: str | None = None
    expected_documents: list[str] = Field(default_factory=list)
    expected_articles: list[ExpectedArticle] = Field(default_factory=list)
    ground_truth_answer: str | None = None
    reasoning_chain: list[str] = Field(default_factory=list)
    annotation: dict[str, Any] = Field(default_factory=dict)
    prediction: PredictionView | None = None
    gold_vs_pred: dict[str, Any] = Field(default_factory=dict)


class BenchmarkStats(BaseModel):
    query_type: dict[str, int]
    difficulty: dict[str, int]
    category: dict[str, int]
    answerable: dict[str, int]
    language: dict[str, int]
    split: dict[str, int]
