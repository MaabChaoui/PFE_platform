from __future__ import annotations

import os
import threading
import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable

from ..settings import Settings, settings


@dataclass(frozen=True)
class CorpusSearchResult:
    article: Any
    score: float


class PipelineService:
    """Shared backend resources around the existing akn_rlm package.

    Corpus parsing and the ArticleRegistry are warmed at application startup.
    Retrieval, dense, LLM, KG, and dispatcher objects remain lazy so the S1
    corpus API does not load model weights or the RDF graph.
    """

    def __init__(self, config: Settings = settings) -> None:
        self.settings = config

        self._corpus_lock = threading.Lock()
        self._resource_lock = threading.Lock()

        self._loaded = False
        self._articles: list[Any] = []
        self._registry: Any = None
        self._articles_by_doc: dict[str, list[Any]] = {}
        self._article_by_ref: dict[tuple[str, str], Any] = {}
        self._article_by_eid: dict[tuple[str, str], Any] = {}

        self._bm25: Any = None
        self._dense: Any = None
        self._llm_pool: Any = None
        self._kg: Any = None
        self._dispatchers: dict[tuple[tuple[str, Any], ...], Any] = {}

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def registry(self) -> Any:
        self.load()
        return self._registry

    @property
    def articles(self) -> list[Any]:
        self.load()
        return self._articles

    def load(self) -> "PipelineService":
        if self._loaded:
            return self

        with self._corpus_lock:
            if self._loaded:
                return self

            self._configure_akn_rlm_env()

            from akn_rlm.corpus.akn_parser import parse_all
            from akn_rlm.corpus.article_registry import ArticleRegistry
            from akn_rlm.normalizers import normalize_article_ref

            articles = self._preserve_benchmark_file_identities(parse_all())
            registry = ArticleRegistry()
            registry.build(articles)

            articles_by_doc: dict[str, list[Any]] = {}
            article_by_ref: dict[tuple[str, str], Any] = {}
            article_by_eid: dict[tuple[str, str], Any] = {}

            for article in articles:
                articles_by_doc.setdefault(article.doc_id, []).append(article)

                ref_key = normalize_article_ref(article.article_ref)
                if ref_key:
                    article_by_ref.setdefault((article.doc_id, ref_key), article)

                if article.eid:
                    article_by_eid[(article.doc_id, article.eid.lower())] = article

            for doc_articles in articles_by_doc.values():
                doc_articles.sort(key=_article_sort_key)

            self._articles = articles
            self._registry = registry
            self._articles_by_doc = articles_by_doc
            self._article_by_ref = article_by_ref
            self._article_by_eid = article_by_eid
            self._loaded = True
            return self

    def documents(self) -> list[tuple[str, Any, list[Any]]]:
        self.load()
        docs: list[tuple[str, Any, list[Any]]] = []
        for doc_id in sorted(self._registry.canonical_ids):
            entry = self._registry.get_doc(doc_id)
            if entry is None:
                continue
            docs.append((doc_id, entry, self._articles_by_doc.get(doc_id, [])))
        docs.sort(key=lambda item: (item[1].doc_date or "", item[0]))
        return docs

    def document(self, doc_id: str) -> tuple[str, Any, list[Any]] | None:
        self.load()
        canonical = self.resolve_doc_id(doc_id)
        if canonical is None:
            return None
        entry = self._registry.get_doc(canonical)
        if entry is None:
            return None
        return canonical, entry, self._articles_by_doc.get(canonical, [])

    def article(self, doc_id: str, ref: str) -> Any | None:
        self.load()
        canonical = self.resolve_doc_id(doc_id)
        if canonical is None:
            return None

        from akn_rlm.normalizers import normalize_arabic, normalize_article_ref, ref_to_eid

        ref_key = normalize_article_ref(ref)
        article = self._article_by_ref.get((canonical, ref_key))
        if article is not None:
            return article

        entry = self._registry.get_doc(canonical)
        if entry is None:
            return None

        for candidate_key in (
            ref_key,
            normalize_arabic(ref).lower().strip(),
            ref_to_eid(ref).lower(),
        ):
            if not candidate_key:
                continue
            eid = entry.article_refs.get(candidate_key)
            if eid:
                article = self._article_by_eid.get((canonical, eid.lower()))
                if article is not None:
                    return article

            article = self._article_by_eid.get((canonical, candidate_key.lower()))
            if article is not None:
                return article

        return None

    def search(
        self,
        q: str,
        *,
        doc_id: str | None = None,
        doc_type: str | None = None,
        limit: int = 50,
    ) -> list[CorpusSearchResult]:
        self.load()
        from akn_rlm.normalizers import normalize_arabic

        query_norm = normalize_arabic(q).casefold()
        tokens = [token for token in query_norm.split() if token]
        if not query_norm or not tokens:
            return []

        canonical_doc_id = self.resolve_doc_id(doc_id) if doc_id else None
        if doc_id and canonical_doc_id is None:
            return []

        candidates: Iterable[Any]
        if canonical_doc_id:
            candidates = self._articles_by_doc.get(canonical_doc_id, [])
        else:
            candidates = self._articles

        hits: list[CorpusSearchResult] = []
        for article in candidates:
            if doc_type and article.doc_type != doc_type:
                continue

            title_norm = normalize_arabic(article.doc_title).casefold()
            haystack = f"{article.text_normalized} {title_norm}".casefold()

            phrase_hits = haystack.count(query_norm)
            token_hits = sum(haystack.count(token) for token in tokens)
            if phrase_hits == 0 and token_hits == 0:
                continue

            score = float((phrase_hits * (len(tokens) + 3)) + token_hits)
            hits.append(CorpusSearchResult(article=article, score=score))

        hits.sort(
            key=lambda hit: (
                hit.score,
                -(len(hit.article.text_ar or "")),
                hit.article.doc_date or "",
            ),
            reverse=True,
        )
        return hits[:limit]

    def resolve_doc_id(self, doc_id: str | None) -> str | None:
        if not doc_id:
            return None
        self.load()
        if self._registry.get_doc(doc_id) is not None:
            entry = self._registry.get_doc(doc_id)
            return entry.canonical_id if entry is not None else None
        return self._registry.resolve_alias(doc_id)

    def bm25(self) -> Any:
        if self._bm25 is not None:
            return self._bm25
        with self._resource_lock:
            if self._bm25 is None:
                from akn_rlm.indexers.bm25 import BM25Index

                self._bm25 = BM25Index.load(self.settings.INDICES_DIR / "bm25.pkl")
            return self._bm25

    def dense(self) -> Any:
        if self._dense is not None:
            return self._dense
        with self._resource_lock:
            if self._dense is None:
                from akn_rlm.indexers.dense import DenseIndex

                self._dense = DenseIndex.load(
                    self.settings.INDICES_DIR / "dense.faiss",
                    self.settings.INDICES_DIR / "dense_meta.parquet",
                )
            return self._dense

    def llm_pool(self) -> Any:
        if self._llm_pool is not None:
            return self._llm_pool
        with self._resource_lock:
            if self._llm_pool is None:
                from akn_rlm.llm.client import LLMPool

                self._llm_pool = LLMPool.default()
            return self._llm_pool

    def kg(self) -> Any:
        if self._kg is not None:
            return self._kg
        with self._resource_lock:
            if self._kg is None:
                from akn_rlm.corpus.kg_loader import load_kg

                self._kg = load_kg(self.settings.AKN_RLM_KG_PATH)
            return self._kg

    def get_dispatcher(self, options: dict[str, Any] | None = None) -> Any:
        options_key = tuple(sorted((options or {}).items()))
        if options_key in self._dispatchers:
            return self._dispatchers[options_key]
        raise NotImplementedError("wired in S4")

    def _configure_akn_rlm_env(self) -> None:
        env_paths: dict[str, Path] = {
            "AKN_RLM_AKN_DIR": self.settings.AKN_RLM_AKN_DIR,
            "AKN_RLM_KG_PATH": self.settings.AKN_RLM_KG_PATH,
            "AKN_RLM_BENCHMARK_PATH": self.settings.AKN_RLM_BENCHMARK_PATH,
            "AKN_RLM_TXT_DIR": self.settings.AKN_RLM_TXT_DIR,
        }
        for key, path in env_paths.items():
            os.environ[key] = str(path)

    def _preserve_benchmark_file_identities(self, articles: list[Any]) -> list[Any]:
        stems_by_doc: dict[str, set[str]] = {}
        for article in articles:
            stems_by_doc.setdefault(article.doc_id, set()).add(article.filename_stem)

        duplicated_doc_ids = {
            doc_id for doc_id, stems in stems_by_doc.items() if len(stems) > 1
        }
        if not duplicated_doc_ids:
            return articles

        benchmark_registry = self._benchmark_document_registry()
        rewritten: list[Any] = []
        for article in articles:
            if (
                article.doc_id in duplicated_doc_ids
                and article.filename_stem != article.doc_id
            ):
                benchmark_doc = benchmark_registry.get(article.filename_stem) or {}
                rewritten.append(
                    replace(
                        article,
                        doc_id=article.filename_stem,
                        doc_title=benchmark_doc.get("title") or article.doc_title,
                        doc_date=_date_from_doc_id(article.filename_stem)
                        or article.doc_date,
                    )
                )
            else:
                rewritten.append(article)
        return rewritten

    def _benchmark_document_registry(self) -> dict[str, Any]:
        path = self.settings.AKN_RLM_BENCHMARK_PATH
        if not path.exists():
            return {}
        data = json.loads(path.read_text(encoding="utf-8"))
        registry = data.get("document_registry") or {}
        return registry if isinstance(registry, dict) else {}


def _article_sort_key(article: Any) -> tuple:
    from akn_rlm.normalizers import normalize_article_ref

    ref = normalize_article_ref(article.article_ref)
    parts: list[tuple[int, int | str]] = []
    for piece in ref.replace("_", " ").split():
        parts.append((0, int(piece)) if piece.isdigit() else (1, piece))
    return (tuple(parts), article.eid or "")


def _date_from_doc_id(doc_id: str) -> str:
    parts = doc_id.rsplit("_", 1)
    if len(parts) == 2 and len(parts[1]) == 10:
        return parts[1]
    return ""
