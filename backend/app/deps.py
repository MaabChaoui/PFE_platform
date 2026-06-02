from __future__ import annotations

import threading

from .services.corpus import CorpusService
from .services.pipeline import PipelineService
from .settings import settings

_LOCK = threading.RLock()
_PIPELINE: PipelineService | None = None
_CORPUS: CorpusService | None = None


def get_pipeline() -> PipelineService:
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE
    with _LOCK:
        if _PIPELINE is None:
            _PIPELINE = PipelineService(settings)
        return _PIPELINE


def get_corpus() -> CorpusService:
    global _CORPUS
    if _CORPUS is not None:
        return _CORPUS
    with _LOCK:
        if _CORPUS is None:
            _CORPUS = CorpusService(get_pipeline(), settings)
        return _CORPUS


def warm_services() -> None:
    get_pipeline().load()
    get_corpus()


def corpus_ready() -> bool:
    return _PIPELINE is not None and _PIPELINE.loaded


def reset_services_for_tests() -> None:
    global _PIPELINE, _CORPUS
    with _LOCK:
        _PIPELINE = None
        _CORPUS = None
