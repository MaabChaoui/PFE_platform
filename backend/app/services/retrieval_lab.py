from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Iterable

from fastapi import HTTPException

from akn_rlm.baselines.hybrid_rerank_pipeline import HybridRerankBaselinePipeline
from akn_rlm.config import RERANKER_MODEL, RRF_K
from akn_rlm.normalizers import normalize_arabic, ref_to_eid
from akn_rlm.retrievers.hybrid_fusion import rrf_fuse

from ..models.retrieval import RetrievalCompareRequest
from .benchmark import BenchmarkService
from .corpus import CorpusService
from .pipeline import PipelineService

SUPPORTED_CHANNELS = {"bm25", "dense", "hybrid", "hybrid_rerank", "kg"}


@dataclass
class _Outcome:
    hits: list[dict[str, Any]]
    elapsed_ms: float
    note: str | None = None


class RetrievalLabService:
    """Offline baseline-comparison surface for retriever controls.

    This mirrors ``HybridRerankBaselinePipeline`` composition:
    BM25 + Dense are converted with that baseline's hit->dict helper, fused by
    ``rrf_fuse`` (where ``k`` is the RRF constant and ``weights`` are per-list),
    then optionally sent through ``akn_rlm.reranker.rerank``.

    Gold matching uses the S2 canonical article-id shape:
    ``canonical_doc_id#eid`` (for example ``84-11_1984-06-09#art_4``).
    Candidate ids are resolved through the S1 corpus before comparison.
    """

    def __init__(
        self,
        pipeline: PipelineService,
        corpus: CorpusService,
        benchmark: BenchmarkService,
    ) -> None:
        self.pipeline = pipeline
        self.corpus = corpus
        self.benchmark = benchmark

    def compare(self, req: RetrievalCompareRequest) -> dict[str, Any]:
        query, seeded_from, gold_ids = self._resolve_query_and_gold(req)
        requested = self._requested_channels(req.retrievers)
        gold_set = (
            {self._normalise_gold_id(article_id) for article_id in gold_ids}
            if gold_ids is not None
            else None
        )
        gold_set = {article_id for article_id in gold_set or set() if article_id}

        doc_filter = self._resolve_doc_filter(req.doc_id)
        if req.doc_id and doc_filter is None:
            channels = [
                self._empty_channel(
                    name,
                    req,
                    note=f"doc_id not found after alias resolution: {req.doc_id}",
                )
                for name in requested
            ]
            return {
                "query": query,
                "seeded_from_question": seeded_from,
                "channels": channels,
                "gold_article_ids": sorted(gold_set) if gold_ids is not None else None,
            }

        needs_bm25 = any(name in {"bm25", "hybrid", "hybrid_rerank"} for name in requested)
        needs_dense = any(name in {"dense", "hybrid", "hybrid_rerank"} for name in requested)

        bm25 = self._search_channel(
            "bm25",
            query=query,
            k=req.k_each,
            doc_filter=doc_filter,
        ) if needs_bm25 else None
        dense = self._search_channel(
            "dense",
            query=query,
            k=req.k_each,
            doc_filter=doc_filter,
        ) if needs_dense else None

        fused: _Outcome | None = None
        if any(name in {"hybrid", "hybrid_rerank"} for name in requested):
            fused = self._fuse(
                bm25 or _Outcome([], 0.0, "bm25 was not requested"),
                dense or _Outcome([], 0.0, "dense was not requested"),
                bm25_weight=req.rrf_weights.bm25,
                dense_weight=req.rrf_weights.dense,
            )

        channels: list[dict[str, Any]] = []
        for name in requested:
            if name == "bm25":
                channels.append(self._channel(name, bm25, req, gold_set))
            elif name == "dense":
                channels.append(self._channel(name, dense, req, gold_set))
            elif name == "hybrid":
                channels.append(self._channel(name, fused, req, gold_set))
            elif name == "hybrid_rerank":
                reranked = self._rerank(query, fused, req)
                channels.append(self._channel(name, reranked, req, gold_set))
            elif name == "kg":
                channels.append(
                    self._empty_channel(
                        "kg",
                        req,
                        offline_capable=False,
                        note=(
                            "KG retrieval is heavy/experimental and disabled in "
                            "the Retrieval Lab by default; use the SQLite KG "
                            "explorer instead of loading the 74 MB rdflib graph."
                        ),
                    )
                )
            else:
                channels.append(
                    self._empty_channel(
                        name,
                        req,
                        offline_capable=False,
                        note=f"unknown retrieval channel: {name}",
                    )
                )

        return {
            "query": query,
            "seeded_from_question": seeded_from,
            "channels": channels,
            "gold_article_ids": sorted(gold_set) if gold_ids is not None else None,
        }

    def _resolve_query_and_gold(
        self,
        req: RetrievalCompareRequest,
    ) -> tuple[str, str | None, list[str] | None]:
        if req.question_id:
            question = self.benchmark.questions_by_id.get(req.question_id)
            if question is None:
                raise HTTPException(
                    status_code=404,
                    detail="Benchmark question not found",
                )
            prediction = self.benchmark.predictions_by_id.get(req.question_id)
            query = str(
                (prediction or {}).get("query")
                or question.get("question")
                or ""
            ).strip()
            gold_ids = self._benchmark_gold_ids(question, prediction)
            return query, req.question_id, sorted(gold_ids)

        gold_ids = req.gold_article_ids
        return str(req.query or "").strip(), None, gold_ids

    def _benchmark_gold_ids(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any] | None,
    ) -> set[str]:
        if prediction and prediction.get("gold_article_ids"):
            return {
                self._normalise_gold_id(str(article_id))
                for article_id in prediction["gold_article_ids"]
            }

        gold_ids: set[str] = set()
        for article in question.get("expected_articles") or []:
            if not article.get("in_dataset", True):
                continue
            doc_id = str(article.get("document_id") or "")
            article_ref = str(article.get("article_ref") or "")
            if not doc_id or not article_ref:
                continue
            canonical = self.pipeline.resolve_doc_id(doc_id) or doc_id
            eid = ref_to_eid(article_ref)
            if eid:
                gold_ids.add(f"{canonical}#{eid}")
        return gold_ids

    def _requested_channels(self, retrievers: Iterable[str]) -> list[str]:
        requested: list[str] = []
        seen: set[str] = set()
        for retriever in retrievers:
            name = str(retriever).strip().lower()
            if not name or name in seen:
                continue
            seen.add(name)
            requested.append(name)
        return requested

    def _resolve_doc_filter(self, doc_id: str | None) -> str | None:
        if not doc_id:
            return None
        return self.pipeline.resolve_doc_id(doc_id)

    def _search_channel(
        self,
        name: str,
        *,
        query: str,
        k: int,
        doc_filter: str | None,
    ) -> _Outcome:
        t0 = time.perf_counter()
        try:
            if name == "bm25":
                hits = self.pipeline.bm25().search(query, k=k)
            elif name == "dense":
                dense = self.pipeline.dense()
                model_name = getattr(dense, "_model_name", None)
                model_loaded = getattr(dense, "_model", None) is not None
                if model_name and not model_loaded and not self._hf_model_cached(model_name):
                    return _Outcome(
                        [],
                        self._elapsed(t0),
                        f"dense unavailable: local encoder weights not cached ({model_name})",
                    )
                hits = dense.search(query, k=k)
            else:
                raise ValueError(f"unsupported search channel: {name}")
            dicts = HybridRerankBaselinePipeline._hits_to_dicts(
                hits,
                retriever=name,
            )
            dicts = self._filter_doc(dicts, doc_filter)
            return _Outcome(dicts, self._elapsed(t0))
        except Exception as exc:
            return _Outcome([], self._elapsed(t0), f"{name} unavailable: {exc}")

    def _filter_doc(
        self,
        hits: list[dict[str, Any]],
        doc_filter: str | None,
    ) -> list[dict[str, Any]]:
        if doc_filter is None:
            return hits

        filtered: list[dict[str, Any]] = []
        for hit in hits:
            doc_id = str(hit.get("doc_id") or "")
            canonical = self.pipeline.resolve_doc_id(doc_id) or doc_id
            if canonical == doc_filter:
                filtered.append(hit)
        return filtered

    def _fuse(
        self,
        bm25: _Outcome,
        dense: _Outcome,
        *,
        bm25_weight: float,
        dense_weight: float,
    ) -> _Outcome:
        if bm25.note or dense.note:
            notes = "; ".join(note for note in (bm25.note, dense.note) if note)
            return _Outcome([], bm25.elapsed_ms + dense.elapsed_ms, notes)

        t0 = time.perf_counter()
        try:
            fused = rrf_fuse(
                [bm25.hits, dense.hits],
                weights=[bm25_weight, dense_weight],
            )
            return _Outcome(
                fused,
                bm25.elapsed_ms + dense.elapsed_ms + self._elapsed(t0),
            )
        except Exception as exc:
            return _Outcome(
                [],
                bm25.elapsed_ms + dense.elapsed_ms + self._elapsed(t0),
                f"hybrid fusion unavailable: {exc}",
            )

    def _rerank(
        self,
        query: str,
        fused: _Outcome | None,
        req: RetrievalCompareRequest,
    ) -> _Outcome:
        if fused is None:
            return _Outcome([], 0.0, "hybrid_rerank requires fused candidates")
        if fused.note:
            return _Outcome([], fused.elapsed_ms, fused.note)

        pool = fused.hits[: req.rerank_pool_size]
        t0 = time.perf_counter()
        try:
            from akn_rlm import reranker

            model_loaded = getattr(reranker, "_MODEL", None) is not None
            if not model_loaded and not self._hf_model_cached(RERANKER_MODEL):
                return _Outcome(
                    [],
                    fused.elapsed_ms + self._elapsed(t0),
                    (
                        "hybrid_rerank unavailable: local cross-encoder weights "
                        f"not cached ({RERANKER_MODEL})"
                    ),
                )
            reranked = reranker.rerank(query, pool, k=req.top_k) or []
            elapsed = fused.elapsed_ms + self._elapsed(t0)
            if getattr(reranker, "_MODEL_FAILED", False):
                return _Outcome(
                    [],
                    elapsed,
                    "hybrid_rerank unavailable: local cross-encoder weights could not be loaded",
                )
            return _Outcome(reranked, elapsed)
        except Exception as exc:
            return _Outcome(
                [],
                fused.elapsed_ms + self._elapsed(t0),
                f"hybrid_rerank unavailable: {exc}",
            )

    def _channel(
        self,
        name: str,
        outcome: _Outcome | None,
        req: RetrievalCompareRequest,
        gold_set: set[str] | None,
    ) -> dict[str, Any]:
        if outcome is None:
            return self._empty_channel(name, req, note=f"{name} was not run")

        candidates = [
            self._candidate(hit, rank=rank, gold_set=gold_set)
            for rank, hit in enumerate(outcome.hits[: req.top_k], start=1)
        ]
        return {
            "name": name,
            "params": self._params(name, req),
            "candidates": candidates,
            "n": len(candidates),
            "elapsed_ms": round(outcome.elapsed_ms, 3),
            "offline_capable": name != "kg",
            "note": outcome.note,
        }

    def _empty_channel(
        self,
        name: str,
        req: RetrievalCompareRequest,
        *,
        offline_capable: bool | None = None,
        note: str | None = None,
    ) -> dict[str, Any]:
        return {
            "name": name,
            "params": self._params(name, req),
            "candidates": [],
            "n": 0,
            "elapsed_ms": 0.0,
            "offline_capable": (
                name in SUPPORTED_CHANNELS and name != "kg"
                if offline_capable is None
                else offline_capable
            ),
            "note": note,
        }

    def _candidate(
        self,
        hit: dict[str, Any],
        *,
        rank: int,
        gold_set: set[str] | None,
    ) -> dict[str, Any]:
        raw_doc_id = str(hit.get("doc_id") or "")
        raw_ref = str(hit.get("article_ref") or "")
        article = self._article(raw_doc_id, raw_ref)

        if article is not None:
            doc_id = str(getattr(article, "doc_id", raw_doc_id) or raw_doc_id)
            article_ref = str(getattr(article, "article_ref", raw_ref) or raw_ref)
            doc_title = str(getattr(article, "doc_title", None) or doc_id)
            eid = str(getattr(article, "eid", None) or ref_to_eid(article_ref))
            text = (
                getattr(article, "text_normalized", None)
                or getattr(article, "text_ar", None)
                or hit.get("text")
                or ""
            )
        else:
            doc_id = self.pipeline.resolve_doc_id(raw_doc_id) or raw_doc_id
            article_ref = raw_ref
            doc_title = doc_id
            eid = ref_to_eid(raw_ref)
            text = str(hit.get("text") or "")

        gold_key = f"{doc_id}#{eid}" if doc_id and eid else ""
        score = hit.get("rerank_score", hit.get("score", 0.0))
        return {
            "rank": rank,
            "doc_id": doc_id,
            "article_ref": article_ref,
            "doc_title": doc_title,
            "snippet": self._snippet(str(text)),
            "score": float(score or 0.0),
            "is_gold": bool(gold_set and gold_key in gold_set),
        }

    def _article(self, doc_id: str, article_ref: str) -> Any | None:
        try:
            return self.corpus.article(doc_id, article_ref)
        except HTTPException:
            return None

    def _normalise_gold_id(self, article_id: str) -> str:
        if "#" not in article_id:
            return article_id.strip()
        doc_id, ref = article_id.split("#", 1)
        canonical = self.pipeline.resolve_doc_id(doc_id.strip()) or doc_id.strip()
        eid = ref_to_eid(ref.strip())
        if not canonical or not eid:
            return article_id.strip()
        return f"{canonical}#{eid}"

    def _params(self, name: str, req: RetrievalCompareRequest) -> dict[str, Any]:
        base: dict[str, Any] = {
            "top_k": req.top_k,
            "doc_id": req.doc_id,
        }
        if name in {"bm25", "dense", "hybrid", "hybrid_rerank"}:
            base["k_each"] = req.k_each
        if name in {"hybrid", "hybrid_rerank"}:
            base["rrf_k"] = RRF_K
            base["rrf_weights"] = req.rrf_weights.model_dump()
        if name == "hybrid_rerank":
            base["rerank_pool_size"] = req.rerank_pool_size
        if name == "kg":
            base["enabled"] = False
        return base

    @staticmethod
    def _snippet(text: str, width: int = 160) -> str:
        normalized = " ".join(normalize_arabic(text).split())
        if len(normalized) <= width:
            return normalized
        return f"{normalized[: width - 1].rstrip()}..."

    @staticmethod
    def _elapsed(start: float) -> float:
        return (time.perf_counter() - start) * 1000.0

    @staticmethod
    def _hf_model_cached(model_name: str) -> bool:
        if "/" not in model_name:
            return True

        try:
            from pathlib import Path

            if Path(model_name).exists():
                return True
        except Exception:
            pass

        try:
            from huggingface_hub import scan_cache_dir

            cache = scan_cache_dir()
        except Exception:
            return False

        return any(repo.repo_id == model_name and repo.revisions for repo in cache.repos)
