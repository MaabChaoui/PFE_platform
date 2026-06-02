from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class KGNode(BaseModel):
    id: str
    type: str | None = None
    label: str | None = None
    doc_id: str | None = None
    article_ref: str | None = None
    props: dict[str, Any] = Field(default_factory=dict)


class KGEdge(BaseModel):
    id: int
    source: str
    target: str
    predicate: str


class Subgraph(BaseModel):
    nodes: list[KGNode]
    edges: list[KGEdge]
    truncated: bool
    total_neighbors: int


class KGTypeCount(BaseModel):
    type: str
    count: int


class KGPredicateCount(BaseModel):
    predicate: str
    count: int


class KGDocumentCount(BaseModel):
    doc_id: str
    nodes: int
    edges: int


class KGTotals(BaseModel):
    nodes: int
    edges: int


class KGMeta(BaseModel):
    node_types: list[KGTypeCount]
    edge_types: list[KGPredicateCount]
    documents: list[KGDocumentCount]
    totals: KGTotals


class CorpusLink(BaseModel):
    doc_id: str
    article_ref: str


class NodeDegree(BaseModel):
    in_count: int
    out_count: int


class NodeDetail(KGNode):
    text: str | None = None
    corpus_link: CorpusLink | None = None
    degree: NodeDegree


class KGSearchHit(KGNode):
    text_snippet: str | None = None
    score: float = 0.0
