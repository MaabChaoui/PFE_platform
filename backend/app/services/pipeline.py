from __future__ import annotations

import contextlib
import os
import threading
import time
import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

from ..settings import Settings, settings

if TYPE_CHECKING:  # avoid importing pydantic models at module load
    from ..models.answer import AnswerOptions


class PipelineLiveError(RuntimeError):
    """Raised when a live LLM/transport path fails or is unavailable.

    Routers translate this into a clean ``503`` (sync) or an SSE ``error``
    event (stream) so the demo server never crashes when keys/endpoint are
    down. Full health-gating + nearest-precomputed fallback is S15.
    """


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
        self._router: Any = None
        self._dispatchers: dict[tuple[tuple[str, Any], ...], Any] = {}
        # Serialises dispatcher BUILDS only. Env-driven enhancer flags
        # (E1-E7, AKN_E4_HYDE, AKN_NO_CITATION_GATE) are read from os.environ
        # at build time and mutating them is process-global; we set them under
        # this lock, build, then restore. Single-user demo concurrency
        # assumption (plan §4). Runs are not serialised.
        self._dispatch_lock = threading.Lock()

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

    def router(self) -> Any:
        """Shared DocRouter, built once from the warm registry + BM25.

        Combo-independent, so every dispatcher reuses it (mirrors
        ``_build_dispatcher`` which passes a single prebuilt router). Note:
        with ceiling-breakers on, the dispatcher would otherwise build its own
        router with an LLM tie-breaker channel — reusing this shared router
        skips that channel, but the NLI verifier injection (the main
        ceiling-breaker effect) still applies via kwarg.
        """
        if self._router is not None:
            return self._router
        with self._resource_lock:
            if self._router is None:
                from akn_rlm.rlm.routing import build_doc_router

                self._router = build_doc_router(
                    registry=self.registry, bm25=self.bm25(),
                )
            return self._router

    def get_dispatcher(self, options: "AnswerOptions") -> Any:
        """Return a memoized dispatcher for ``options`` (built at most once).

        Default ``AnswerOptions()`` reproduces ``akn_rlm/api/answer.py:
        _build_dispatcher`` exactly. The whole build is lock-serialised because
        env enhancer flags are process-global; they are set, the dispatcher is
        built (reading them), then restored.
        """
        key = _options_key(
            options,
            allow_model_override=self.settings.ALLOW_MODEL_OVERRIDE,
        )
        disp = self._dispatchers.get(key)
        if disp is not None:
            return disp

        with self._dispatch_lock:
            disp = self._dispatchers.get(key)
            if disp is not None:
                return disp

            import akn_rlm.rlm.dispatcher as _disp_mod
            from akn_rlm.rlm.classifier import (
                DEFAULT_LLM_CLASSIFIER_MODEL,
                make_llm_classifier_fn,
            )

            registry = self.registry
            bm25 = self.bm25()
            dense = self.dense()
            pool = self.llm_pool()
            router = self.router()

            allow_models = self.settings.ALLOW_MODEL_OVERRIDE
            classifier_model = (
                options.classifier_model if allow_models and options.classifier_model
                else DEFAULT_LLM_CLASSIFIER_MODEL
            )
            classifier_fn = make_llm_classifier_fn(pool, model=classifier_model)
            # kg on → lazy loader (74 MB rdflib parse on first TF/CD dispatch);
            # kg off → None so TF/CD abstain (plan §5).
            kg_loader = (lambda: self.kg()) if options.use_kg else None

            kwargs: dict[str, Any] = dict(
                router=router,
                kg=None,
                kg_loader=kg_loader,
                classifier_fn=classifier_fn,
                enable_pervasive_adu=options.enable_pervasive_adu,
                adu_extract_top_n=options.adu_extract_top_n,
                enable_recursion=options.enable_recursion,
                recursion_max_depth=options.recursion_max_depth,
                enable_corrective_retry=options.enable_corrective_retry,
                # Request-safe kwarg; takes precedence over AKN_CEILING_BREAKERS.
                enable_ceiling_breakers=options.ceiling_breakers,
                long_context_timeout_s=options.long_context_timeout_s,
                # Phase E.1 — MH/RA coverage_min override (TF/CD keep default 2).
                recursion_coverage_min_overrides={
                    "multi_hop": options.mh_ra_coverage_min,
                    "rule_application": options.mh_ra_coverage_min,
                },
            )
            if allow_models and options.sub_model:
                kwargs["sub_model"] = options.sub_model
            if allow_models and options.supervisor_model:
                kwargs["supervisor_model"] = options.supervisor_model

            with self._scoped_env(_env_for_options(options)):
                disp = _disp_mod.build_dispatcher(
                    bm25=bm25, dense=dense, registry=registry,
                    llm_pool=pool, **kwargs,
                )

            self._dispatchers[key] = disp
            return disp

    def reset_dispatchers(self) -> int:
        """Clear the memo cache (and the akn_rlm default singleton). Returns
        the number of cached combos cleared. Backs ``POST /pipeline/reset``."""
        with self._dispatch_lock:
            cleared = len(self._dispatchers)
            self._dispatchers.clear()
        try:
            from akn_rlm.api.answer import reset_dispatcher as _reset_default

            _reset_default()
        except Exception:
            pass
        return cleared

    def answer(self, query: str, options: "AnswerOptions") -> dict[str, Any]:
        """Run the live pipeline and return an ``AnswerResponse`` dict.

        Auto-classified (``query_type=None``) and manually-routed runs both
        funnel through the SAME converter so the shapes never drift. Infra
        failures (LLM/transport/build) — whether raised or swallowed into a
        dispatcher abstain envelope — become a ``PipelineLiveError`` (→ 503);
        genuine domain abstentions (e.g. ``unanswerable``) stay a 200.
        """
        if not isinstance(query, str) or not query.strip():
            raise PipelineLiveError("query must be a non-empty string")

        from .answer_runtime import build_answer_response, is_dispatch_failure

        query_type = (options.query_type or "").strip() or None

        t0 = time.time()
        try:
            # Build is inside the try: a build failure (e.g. uncached embedding
            # weights, LLM-pool construction) must also degrade to a 503, never
            # an opaque 500. This also turns a genuine build bug into a 503 —
            # acceptable for the demo (server stays up).
            disp = self.get_dispatcher(options)
            raw = disp.run(query.strip(), query_type=query_type)
        except Exception as exc:  # build / transport / LLM error that propagated
            raise PipelineLiveError(f"live pipeline error: {exc}") from exc
        latency = time.time() - t0

        if is_dispatch_failure(raw):
            telemetry = raw.get("_telemetry") or {}
            detail = telemetry.get("error") or raw.get("abstention_reason")
            raise PipelineLiveError(f"live pipeline unavailable: {detail}")

        # Liveness heuristic: the typed handlers swallow LLM transport errors
        # into an empty (non-abstaining) result rather than raising, so a run
        # that produced no answer text AND no citations — without deliberately
        # abstaining — almost always means the LLM endpoint was unreachable.
        # Surface that as a 503 instead of a misleading empty 200. (S15 replaces
        # this with real health-gating + nearest-precomputed fallback.)
        answer_text = str(raw.get("answer_text", "") or "").strip()
        has_citations = bool(raw.get("citations"))
        if not bool(raw.get("abstention")) and not answer_text and not has_citations:
            raise PipelineLiveError(
                "live pipeline produced no answer (LLM keys/endpoint may be down)"
            )

        return build_answer_response(query.strip(), raw, latency).to_dict()

    def classify(self, query: str) -> tuple[str, float]:
        """Live classifier preview → ``(query_type, confidence)``.

        Uses ``akn_rlm.rlm.classifier.llm_classify`` with the regex fallback
        DISABLED: a clean LLM label returns confidence 0.95; anything else
        (LLM unreachable → swallowed internally → confidence 0.0, or
        unparseable output) raises ``PipelineLiveError`` so the endpoint
        returns a 503 rather than a regex guess masquerading as the LLM
        classifier. This is a live-only *preview* endpoint.
        """
        if not isinstance(query, str) or not query.strip():
            raise PipelineLiveError("query must be a non-empty string")

        from akn_rlm.rlm.classifier import llm_classify

        try:
            pool = self.llm_pool()
            result = llm_classify(query.strip(), pool, fallback_to_regex=False)
        except Exception as exc:
            raise PipelineLiveError(f"classifier failed: {exc}") from exc

        if result.confidence >= 0.95 and result.query_type:
            return result.query_type, float(result.confidence)
        raise PipelineLiveError(
            "live classifier unavailable: LLM did not return a usable label "
            "(keys/endpoint may be down)"
        )

    @contextlib.contextmanager
    def _scoped_env(self, env: dict[str, str | None]):
        """Apply ``env`` (None value = unset the key), restore prior on exit."""
        prior: dict[str, str | None] = {}
        try:
            for key, value in env.items():
                prior[key] = os.environ.get(key)
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            yield
        finally:
            for key, value in prior.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

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


def _options_key(
    options: "AnswerOptions",
    *,
    allow_model_override: bool = True,
) -> tuple[tuple[str, Any], ...]:
    """Hashable, normalized build key. Excludes ``query_type`` — manual routing
    is a run-time ``run(query, query_type=...)`` arg, not a build input."""
    enh = options.enhancers
    classifier_model = options.classifier_model if allow_model_override else None
    sub_model = options.sub_model if allow_model_override else None
    supervisor_model = options.supervisor_model if allow_model_override else None
    return (
        ("enable_recursion", options.enable_recursion),
        ("recursion_max_depth", options.recursion_max_depth),
        ("mh_ra_coverage_min", options.mh_ra_coverage_min),
        ("enable_corrective_retry", options.enable_corrective_retry),
        ("enable_pervasive_adu", options.enable_pervasive_adu),
        ("adu_extract_top_n", options.adu_extract_top_n),
        ("hyde", options.hyde),
        ("ceiling_breakers", options.ceiling_breakers),
        ("use_kg", options.use_kg),
        ("citation_gate", options.citation_gate),
        ("classifier_model", classifier_model),
        ("sub_model", sub_model),
        ("supervisor_model", supervisor_model),
        ("long_context_timeout_s", options.long_context_timeout_s),
        ("e1", enh.e1), ("e2", enh.e2), ("e3", enh.e3),
        ("e5", enh.e5), ("e6", enh.e6), ("e7", enh.e7),
    )


def _env_for_options(options: "AnswerOptions") -> dict[str, str | None]:
    """Build-time env flags for ``options`` (value ``None`` = unset the key).

    * E1-E7 + AKN_E4_HYDE use ``enhancers._env_flag`` ({1,true,yes,on} = on;
      "0"/unset = off). ``AKN_ENHANCERS`` is a master that force-enables ALL
      enhancers when truthy, so we neutralise it to "0" for exact per-flag
      control.
    * AKN_NO_CITATION_GATE is **presence-based** (``if os.getenv(...)``) — even
      "0" reads as ON. So gate-on (default) = unset; gate-off = "1".
    * Ceiling-breakers are passed as a kwarg, not via env.
    """
    enh = options.enhancers
    return {
        "AKN_E1_CONCEPT_AMENDMENT": "1" if enh.e1 else "0",
        "AKN_E2_NLI_REVERSE": "1" if enh.e2 else "0",
        "AKN_E3_PARAPHRASE": "1" if enh.e3 else "0",
        "AKN_E4_HYDE": "1" if options.hyde else "0",
        "AKN_E5_KG_TOPOLOGY": "1" if enh.e5 else "0",
        "AKN_E6_CONCEPT_KG": "1" if enh.e6 else "0",
        "AKN_E7_KG_DOC_ROUTER": "1" if enh.e7 else "0",
        "AKN_ENHANCERS": "0",
        "AKN_NO_CITATION_GATE": None if options.citation_gate else "1",
    }


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
