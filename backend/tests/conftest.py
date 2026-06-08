from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
FIXTURES = BACKEND_ROOT / "fixtures"

sys.path.insert(0, str(BACKEND_ROOT))

os.environ.update(
    {
        "AKN_RLM_AKN_DIR": str(FIXTURES / "akn"),
        "AKN_RLM_TXT_DIR": str(FIXTURES / "txt"),
        "AKN_RLM_RDF_DIR": str(FIXTURES / "rdf"),
        "AKN_RLM_PDF_DIR": str(FIXTURES / "pdf"),
        "AKN_RLM_KG_PATH": str(FIXTURES / "rdf" / "missing.ttl"),
        "AKN_RLM_EXTRACTION_REPORT_PATH": str(
            FIXTURES / "rdf" / "extraction_report.json"
        ),
        "AKN_RLM_BENCHMARK_PATH": str(
            FIXTURES / "benchmark" / "AlgerianLegalBench_v3.0_final.json"
        ),
        "KG_INDEX_PATH": str(FIXTURES / "rdf" / "kg_index.sqlite"),
        "KG_BUILD_ON_START": "false",
        "INDICES_DIR": str(REPO_ROOT / "akn_rlm" / "data" / "indices"),
        "EVAL_RESULTS_DIR": str(FIXTURES / "eval"),
        "OFFLINE_MODE": "true",
        # S15: never pull real BM25/dense during TestClient lifespan warm-up.
        "WARM_DISPATCHER_ON_START": "false",
    }
)


@pytest.fixture(autouse=True)
def _reset_sse_app_status():
    """sse-starlette keeps a process-global ``AppStatus.should_exit_event`` that
    binds to the event loop of the FIRST EventSourceResponse. Each ``TestClient``
    block runs its own loop, so a second SSE test would otherwise crash on
    shutdown ("Event bound to a different event loop"). Reset it before every
    test so the event is recreated on the current loop. Harmless for non-SSE
    tests. (S15 added a second real SSE stream test, surfacing this.)"""
    import sse_starlette.sse as _sse

    _sse.AppStatus.should_exit_event = None
    _sse.AppStatus.should_exit = False
    yield
