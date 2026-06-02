from __future__ import annotations

import threading

from .services.corpus import CorpusService
from .services.benchmark import BenchmarkService
from .services.pipeline import PipelineService
from .services.results import ResultsService
from .settings import settings

_LOCK = threading.RLock()
_PIPELINE: PipelineService | None = None
_CORPUS: CorpusService | None = None
_BENCHMARK: BenchmarkService | None = None
_RESULTS: ResultsService | None = None


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


def get_benchmark() -> BenchmarkService:
    global _BENCHMARK
    if _BENCHMARK is not None:
        return _BENCHMARK
    with _LOCK:
        if _BENCHMARK is None:
            _BENCHMARK = BenchmarkService(get_corpus(), settings)
        return _BENCHMARK


def get_results() -> ResultsService:
    global _RESULTS
    if _RESULTS is not None:
        return _RESULTS
    with _LOCK:
        if _RESULTS is None:
            _RESULTS = ResultsService(settings)
        return _RESULTS


def warm_services() -> None:
    get_pipeline().load()
    get_corpus()


def corpus_ready() -> bool:
    return _PIPELINE is not None and _PIPELINE.loaded


def reset_services_for_tests() -> None:
    global _PIPELINE, _CORPUS, _BENCHMARK, _RESULTS
    with _LOCK:
        _PIPELINE = None
        _CORPUS = None
        _BENCHMARK = None
        _RESULTS = None
