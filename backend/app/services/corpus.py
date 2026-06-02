from __future__ import annotations

import json
from functools import cached_property
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..models import (
    ArticleModel,
    DocumentDetail,
    DocumentSummary,
    FormatsAvailable,
    HierarchyNode,
    MetaResponse,
    SearchHit,
)
from ..settings import Settings, settings
from .pipeline import PipelineService

HIERARCHY_LEVELS = ("book", "part", "title", "chapter", "section", "subsection")


class CorpusService:
    def __init__(
        self,
        pipeline: PipelineService,
        config: Settings = settings,
    ) -> None:
        self.pipeline = pipeline
        self.settings = config

    def meta(self) -> MetaResponse:
        registry = self.pipeline.registry
        benchmark = self._benchmark_json
        report = self._extraction_report_json

        kg_triples = None
        if report:
            summary = report.get("summary") or {}
            value = summary.get("total_triples")
            kg_triples = int(value) if value is not None else None

        return MetaResponse(
            documents=registry.doc_count,
            articles=len(self.pipeline.articles),
            benchmark_questions=len(benchmark.get("questions") or []),
            kg_triples=kg_triples,
            offline_mode=self.settings.OFFLINE_MODE,
            indices_present=(self.settings.INDICES_DIR / "bm25.pkl").exists(),
            dataset_present=self.settings.AKN_RLM_BENCHMARK_PATH.exists(),
        )

    def documents(self) -> list[DocumentSummary]:
        summaries: list[DocumentSummary] = []
        for doc_id, entry, articles in self.pipeline.documents():
            summaries.append(
                DocumentSummary(
                    doc_id=doc_id,
                    title=entry.doc_title,
                    date=entry.doc_date,
                    type=entry.doc_type,
                    article_count=len(articles),
                    formats_available=self.formats_available(doc_id, entry),
                )
            )
        return summaries

    def document(self, doc_id: str) -> DocumentDetail:
        resolved = self.pipeline.document(doc_id)
        if resolved is None:
            raise HTTPException(status_code=404, detail="Document not found")

        canonical_id, entry, articles = resolved
        article_models = [self.article_to_model(article) for article in articles]
        return DocumentDetail(
            doc_id=canonical_id,
            title=entry.doc_title,
            date=entry.doc_date,
            type=entry.doc_type,
            filename_stem=entry.filename_stem,
            article_count=len(articles),
            formats_available=self.formats_available(canonical_id, entry),
            hierarchy=self._hierarchy(canonical_id, articles),
            articles=article_models,
        )

    def article(self, doc_id: str, article_ref: str) -> ArticleModel:
        article = self.pipeline.article(doc_id, article_ref)
        if article is None:
            raise HTTPException(status_code=404, detail="Article not found")
        return self.article_to_model(article)

    def raw_xml(self, doc_id: str) -> str:
        return self._raw_file(doc_id, self.settings.AKN_RLM_AKN_DIR, ".xml", "XML")

    def raw_text(self, doc_id: str) -> str:
        return self._raw_file(doc_id, self.settings.AKN_RLM_TXT_DIR, ".txt", "text")

    def search(
        self,
        q: str,
        *,
        doc_id: str | None = None,
        doc_type: str | None = None,
    ) -> list[SearchHit]:
        results = self.pipeline.search(q, doc_id=doc_id, doc_type=doc_type)
        return [
            SearchHit(
                doc_id=result.article.doc_id,
                article_ref=result.article.article_ref,
                doc_title=result.article.doc_title,
                snippet=self._snippet(result.article, q),
                score=result.score,
            )
            for result in results
        ]

    def formats_available(self, doc_id: str, entry: Any) -> FormatsAvailable:
        benchmark_formats = self._benchmark_formats_for(doc_id)
        if benchmark_formats is not None:
            return FormatsAvailable(**benchmark_formats)

        stem = entry.filename_stem
        return FormatsAvailable(
            akn=(self.settings.AKN_RLM_AKN_DIR / f"{stem}.xml").exists(),
            txt=(self.settings.AKN_RLM_TXT_DIR / f"{stem}.txt").exists(),
            rdf=(self.settings.AKN_RLM_RDF_DIR / f"{stem}.ttl").exists(),
            pdf=(self.settings.AKN_RLM_PDF_DIR / f"{stem}.pdf").exists(),
        )

    def article_to_model(self, article: Any) -> ArticleModel:
        return ArticleModel(
            doc_id=article.doc_id,
            article_ref=article.article_ref,
            eid=article.eid,
            num=article.article_ref or None,
            status=None,
            doc_title=article.doc_title,
            doc_date=article.doc_date,
            doc_type=article.doc_type,
            frbr_uri=article.frbr_uri,
            filename_stem=article.filename_stem,
            ancestors=dict(article.ancestors),
            text_ar=article.text_ar,
            text_normalized=article.text_normalized,
            paragraphs=list(article.paragraphs),
        )

    def _raw_file(self, doc_id: str, directory: Path, suffix: str, label: str) -> str:
        resolved = self.pipeline.document(doc_id)
        if resolved is None:
            raise HTTPException(status_code=404, detail="Document not found")

        _, entry, _ = resolved
        path = directory / f"{entry.filename_stem}{suffix}"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Raw {label} not found")
        return path.read_text(encoding="utf-8")

    def _hierarchy(self, doc_id: str, articles: list[Any]) -> HierarchyNode:
        root = HierarchyNode(
            id=doc_id,
            level="document",
            label="document",
            value=doc_id,
        )

        children_by_parent: dict[tuple[str, str, str], HierarchyNode] = {}

        for article in articles:
            node = root
            for level in HIERARCHY_LEVELS:
                value = article.ancestors.get(level)
                if not value:
                    continue
                key = (node.id, level, value)
                child = children_by_parent.get(key)
                if child is None:
                    child = HierarchyNode(
                        id=f"{node.id}/{level}:{value}",
                        level=level,
                        label=f"{level} {value}",
                        value=value,
                    )
                    children_by_parent[key] = child
                    node.children.append(child)
                node = child
            node.article_refs.append(article.article_ref)

        return root

    def _benchmark_formats_for(self, doc_id: str) -> dict[str, bool] | None:
        registry = self._benchmark_json.get("document_registry") or {}

        direct = registry.get(doc_id)
        if direct is not None:
            return direct.get("formats_available") or None

        for registry_doc_id, entry in registry.items():
            canonical = self.pipeline.resolve_doc_id(registry_doc_id)
            if canonical == doc_id:
                return entry.get("formats_available") or None
        return None

    def _snippet(self, article: Any, query: str, width: int = 260) -> str:
        from akn_rlm.normalizers import normalize_arabic

        query_tokens = [token for token in normalize_arabic(query).split() if token]
        texts = article.paragraphs or [article.text_ar]
        for paragraph in texts:
            normalized = normalize_arabic(paragraph)
            if any(token in normalized for token in query_tokens):
                return _trim(paragraph, width)
        return _trim(article.text_ar, width)

    @cached_property
    def _benchmark_json(self) -> dict[str, Any]:
        path = self.settings.AKN_RLM_BENCHMARK_PATH
        if not path.exists():
            return {"questions": [], "document_registry": {}}
        return json.loads(path.read_text(encoding="utf-8"))

    @cached_property
    def _extraction_report_json(self) -> dict[str, Any]:
        path = self.settings.AKN_RLM_EXTRACTION_REPORT_PATH
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))


def _trim(text: str, width: int) -> str:
    text = " ".join((text or "").split())
    if len(text) <= width:
        return text
    return f"{text[: width - 1].rstrip()}..."
