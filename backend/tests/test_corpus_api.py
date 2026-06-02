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
        "AKN_RLM_EXTRACTION_REPORT_PATH": str(FIXTURES / "rdf" / "extraction_report.json"),
        "AKN_RLM_BENCHMARK_PATH": str(
            FIXTURES / "benchmark" / "AlgerianLegalBench_v3.0_final.json"
        ),
        "INDICES_DIR": str(REPO_ROOT / "akn_rlm" / "data" / "indices"),
        "EVAL_RESULTS_DIR": str(REPO_ROOT / "akn_rlm" / "eval_results"),
        "OFFLINE_MODE": "true",
    }
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_meta_uses_fixture_counts() -> None:
    with TestClient(app) as client:
        response = client.get("/api/meta")
    assert response.status_code == 200
    payload = response.json()
    assert payload["documents"] == 2
    assert payload["articles"] == 11
    assert payload["benchmark_questions"] == 1
    assert payload["kg_triples"] == 123


def test_documents_and_detail_contract() -> None:
    with TestClient(app) as client:
        docs_response = client.get("/api/corpus/documents")
        detail_response = client.get("/api/corpus/documents/94-03_1994-04-11")

    assert docs_response.status_code == 200
    docs = docs_response.json()
    assert len(docs) == 2
    assert docs[0]["doc_id"]
    assert {"akn", "txt", "rdf", "pdf"} == set(docs[0]["formats_available"])

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["doc_id"] == "94-03_1994-04-11"
    assert detail["article_count"] == 3
    assert detail["hierarchy"]["level"] == "document"
    assert detail["articles"][0]["text_ar"]
    assert detail["articles"][0]["paragraphs"]


def test_article_raw_files_and_search() -> None:
    with TestClient(app) as client:
        article_response = client.get("/api/corpus/articles/94-03_1994-04-11/1")
        xml_response = client.get("/api/corpus/documents/94-03_1994-04-11/xml")
        text_response = client.get("/api/corpus/documents/94-03_1994-04-11/text")
        search_response = client.get("/api/corpus/search", params={"q": "علاقات العمل"})

    assert article_response.status_code == 200
    article = article_response.json()
    assert article["article_ref"] == "1"
    assert article["text_ar"]

    assert xml_response.status_code == 200
    assert "<akomaNtoso" in xml_response.text

    assert text_response.status_code == 200
    assert "علاقات العمل" in text_response.text

    assert search_response.status_code == 200
    hits = search_response.json()
    assert len(hits) >= 1
    assert hits[0]["doc_id"] == "94-03_1994-04-11"
