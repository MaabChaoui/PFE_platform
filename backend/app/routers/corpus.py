from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse

from ..deps import get_corpus
from ..models import ArticleModel, DocumentDetail, DocumentSummary, MetaResponse, SearchHit
from ..services.corpus import CorpusService

router = APIRouter()


@router.get("/meta", response_model=MetaResponse)
def meta(corpus: CorpusService = Depends(get_corpus)) -> MetaResponse:
    return corpus.meta()


@router.get("/corpus/documents", response_model=list[DocumentSummary])
def documents(corpus: CorpusService = Depends(get_corpus)) -> list[DocumentSummary]:
    return corpus.documents()


@router.get(
    "/corpus/documents/{doc_id}/xml",
    response_class=PlainTextResponse,
)
def document_xml(doc_id: str, corpus: CorpusService = Depends(get_corpus)) -> str:
    return corpus.raw_xml(doc_id)


@router.get(
    "/corpus/documents/{doc_id}/text",
    response_class=PlainTextResponse,
)
def document_text(doc_id: str, corpus: CorpusService = Depends(get_corpus)) -> str:
    return corpus.raw_text(doc_id)


@router.get("/corpus/documents/{doc_id}", response_model=DocumentDetail)
def document(doc_id: str, corpus: CorpusService = Depends(get_corpus)) -> DocumentDetail:
    return corpus.document(doc_id)


@router.get("/corpus/articles/{doc_id}/{article_ref}", response_model=ArticleModel)
def article(
    doc_id: str,
    article_ref: str,
    corpus: CorpusService = Depends(get_corpus),
) -> ArticleModel:
    return corpus.article(doc_id, article_ref)


@router.get("/corpus/search", response_model=list[SearchHit])
def search(
    q: str = Query(..., min_length=1),
    doc_id: str | None = None,
    doc_type: str | None = Query(None, alias="type"),
    corpus: CorpusService = Depends(get_corpus),
) -> list[SearchHit]:
    return corpus.search(q, doc_id=doc_id, doc_type=doc_type)
