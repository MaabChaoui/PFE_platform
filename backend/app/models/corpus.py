from __future__ import annotations

from pydantic import BaseModel, Field


class FormatsAvailable(BaseModel):
    akn: bool = False
    txt: bool = False
    rdf: bool = False
    pdf: bool = False


class MetaResponse(BaseModel):
    documents: int
    articles: int
    benchmark_questions: int
    kg_triples: int | None = None
    offline_mode: bool
    indices_present: bool
    dataset_present: bool


class DocumentSummary(BaseModel):
    doc_id: str
    title: str
    date: str
    type: str
    article_count: int
    formats_available: FormatsAvailable


class HierarchyNode(BaseModel):
    id: str
    level: str
    label: str
    value: str | None = None
    article_refs: list[str] = Field(default_factory=list)
    children: list["HierarchyNode"] = Field(default_factory=list)


class ArticleModel(BaseModel):
    doc_id: str
    article_ref: str
    eid: str
    num: str | None = None
    status: str | None = None
    doc_title: str
    doc_date: str
    doc_type: str
    frbr_uri: str
    filename_stem: str
    ancestors: dict[str, str]
    text_ar: str
    text_normalized: str
    paragraphs: list[str]


class DocumentDetail(BaseModel):
    doc_id: str
    title: str
    date: str
    type: str
    filename_stem: str
    article_count: int
    formats_available: FormatsAvailable
    hierarchy: HierarchyNode
    articles: list[ArticleModel]


class SearchHit(BaseModel):
    doc_id: str
    article_ref: str
    doc_title: str
    snippet: str
    score: float
