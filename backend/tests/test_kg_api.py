from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.deps import reset_services_for_tests
from app.main import app
from app.scripts.build_kg_index import build_index
from app.settings import settings

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.fixture()
def kg_client(tmp_path: Path):
    index_path = tmp_path / "kg_index.sqlite"
    build_index(
        rdf_dir=FIXTURES / "rdf",
        index_path=index_path,
        force=True,
    )
    settings.KG_INDEX_PATH = index_path
    reset_services_for_tests()
    with TestClient(app) as client:
        yield client


def test_kg_meta_enumerates_actual_ontology(kg_client: TestClient) -> None:
    response = kg_client.get("/api/kg/meta")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["node_types"]) >= 1
    assert len(payload["edge_types"]) >= 1
    assert payload["totals"]["nodes"] > 0
    assert payload["totals"]["edges"] > 0


def test_kg_subgraph_is_bounded_and_reports_truncation(
    kg_client: TestClient,
) -> None:
    response = kg_client.get(
        "/api/kg/subgraph",
        params={"doc_id": "94-03_1994-04-11", "depth": 1, "limit": 2},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["nodes"]) <= 2
    assert payload["truncated"] is True
    assert payload["total_neighbors"] >= 2


def test_kg_node_returns_props_and_article_corpus_link(
    kg_client: TestClient,
) -> None:
    node_id = "https://legal.dz/resource/law/1994-04-11/94-03#art_1"
    response = kg_client.get("/api/kg/node", params={"id": node_id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == node_id
    assert payload["type"] == "Article"
    assert payload["props"]
    assert payload["corpus_link"] == {
        "doc_id": "94-03_1994-04-11",
        "article_ref": "1",
    }
    assert payload["degree"]["in_count"] + payload["degree"]["out_count"] > 0


def test_kg_search_finds_known_fixture_node(kg_client: TestClient) -> None:
    response = kg_client.get("/api/kg/search", params={"q": "الأجر", "limit": 10})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 1
    assert any(hit["id"].endswith("#art_87_bis") for hit in payload)
