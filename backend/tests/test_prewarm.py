"""S15 — startup pre-warm of the default dispatcher (offline-safe)."""
from __future__ import annotations

from unittest.mock import Mock

import akn_rlm.rlm.classifier as classifier_mod
import akn_rlm.rlm.dispatcher as dispatcher_mod

from app.deps import prewarm_default_dispatcher
from app.services.pipeline import PipelineService
from app.settings import settings


def _stubbed_service() -> PipelineService:
    """A PipelineService with every heavy singleton stubbed so building the
    dispatcher never loads BM25/dense/LLM/registry (no model download)."""
    service = PipelineService(settings)
    service._loaded = True
    service._registry = Mock(name="registry")
    service._bm25 = Mock(name="bm25")
    service._dense = Mock(name="dense")
    service._llm_pool = Mock(name="llm_pool")
    service._router = Mock(name="router")
    return service


def test_prewarm_builds_default_dispatcher_without_llm_call(monkeypatch) -> None:
    built = {"n": 0}

    def fake_build(**_kwargs):
        built["n"] += 1
        return Mock(name="dispatcher")

    # classifier_fn is CONSTRUCTED (no call) — patched so no real LLM is touched.
    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", fake_build)
    monkeypatch.setattr(
        classifier_mod,
        "make_llm_classifier_fn",
        lambda pool, *, model, max_tokens=32: (lambda q: "multi_hop"),
    )

    service = _stubbed_service()
    ok = prewarm_default_dispatcher(service)

    assert ok is True
    assert built["n"] == 1  # default dispatcher built exactly once
    # The stub LLM pool object was never *called* (no network): construction only.
    assert not service._llm_pool.method_calls


def test_prewarm_offline_failure_does_not_raise(monkeypatch) -> None:
    def boom(**_kwargs):
        raise RuntimeError("embedding weights not cached (offline)")

    monkeypatch.setattr(dispatcher_mod, "build_dispatcher", boom)
    monkeypatch.setattr(
        classifier_mod,
        "make_llm_classifier_fn",
        lambda pool, *, model, max_tokens=32: (lambda q: "multi_hop"),
    )

    service = _stubbed_service()
    # Must swallow + return False, NOT propagate (startup stays up offline).
    assert prewarm_default_dispatcher(service) is False
