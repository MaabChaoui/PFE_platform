from __future__ import annotations

import os
import sys
from pathlib import Path

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
        "INDICES_DIR": str(REPO_ROOT / "akn_rlm" / "data" / "indices"),
        "EVAL_RESULTS_DIR": str(FIXTURES / "eval"),
        "OFFLINE_MODE": "true",
    }
)
