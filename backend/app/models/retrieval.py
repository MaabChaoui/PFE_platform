from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class RRFWeights(BaseModel):
    bm25: float = Field(1.0, ge=0.0)
    dense: float = Field(1.0, ge=0.0)


class RetrievalCompareRequest(BaseModel):
    query: str | None = None
    question_id: str | None = None
    retrievers: list[str] = Field(
        default_factory=lambda: ["bm25", "dense", "hybrid", "hybrid_rerank"],
        min_length=1,
    )
    k_each: int = Field(30, ge=1, le=500)
    top_k: int = Field(10, ge=1, le=100)
    rrf_weights: RRFWeights = Field(default_factory=RRFWeights)
    rerank_pool_size: int = Field(50, ge=1, le=500)
    doc_id: str | None = None
    gold_article_ids: list[str] | None = None

    @model_validator(mode="after")
    def exactly_one_query_source(self) -> "RetrievalCompareRequest":
        has_query = bool((self.query or "").strip())
        has_question = bool((self.question_id or "").strip())
        if has_query == has_question:
            raise ValueError("exactly one of query or question_id is required")
        if self.query is not None:
            self.query = self.query.strip()
        if self.question_id is not None:
            self.question_id = self.question_id.strip()
        if self.doc_id is not None:
            self.doc_id = self.doc_id.strip() or None
        return self


class RetrievalCandidate(BaseModel):
    rank: int
    doc_id: str
    article_ref: str
    doc_title: str
    snippet: str
    score: float
    is_gold: bool = False


class RetrievalChannel(BaseModel):
    name: str
    params: dict[str, Any] = Field(default_factory=dict)
    candidates: list[RetrievalCandidate] = Field(default_factory=list)
    n: int = 0
    elapsed_ms: float = 0.0
    offline_capable: bool = True
    note: str | None = None


class RetrievalCompareResponse(BaseModel):
    query: str
    seeded_from_question: str | None = None
    channels: list[RetrievalChannel]
    gold_article_ids: list[str] | None = None
