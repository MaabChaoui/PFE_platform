from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_benchmark_questions_filters_and_overlap() -> None:
    with TestClient(app) as client:
        response = client.get("/api/benchmark/questions", params={"page_size": 5})
        filtered = client.get(
            "/api/benchmark/questions",
            params={"query_type": "unanswerable"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["page"] == 1
    assert len(payload["items"]) == 2

    first = payload["items"][0]
    assert first["id"] == "fixture-q1"
    assert first["has_prediction"] is True
    assert first["correctness"]["n_gold"] == 2
    assert first["correctness"]["n_pred"] == 2
    assert first["correctness"]["n_correct"] == 1
    assert first["correctness"]["f1"] == 0.5

    assert filtered.status_code == 200
    filtered_payload = filtered.json()
    assert filtered_payload["total"] == 1
    assert filtered_payload["items"][0]["correctness"]["abstention_scored"] is True
    assert filtered_payload["items"][0]["correctness"]["f1"] == 1.0


def test_benchmark_detail_enriches_gold_text_and_diff() -> None:
    with TestClient(app) as client:
        response = client.get("/api/benchmark/questions/fixture-q1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == "fixture-q1"
    assert payload["expected_articles"][0]["resolved"] is True
    assert payload["expected_articles"][0]["text"]
    assert payload["prediction"]["predicted_citations"]
    assert payload["prediction"]["trajectory"]
    assert payload["gold_vs_pred"]["gold_not_pred"] == [
        "94-03_1994-04-11#art_2"
    ]
    assert payload["gold_vs_pred"]["pred_not_gold"] == [
        "94-03_1994-04-11#art_3"
    ]


def test_benchmark_stats_counts() -> None:
    with TestClient(app) as client:
        response = client.get("/api/benchmark/stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["query_type"] == {"exact_article": 1, "unanswerable": 1}
    assert payload["difficulty"] == {"easy": 1, "hard": 1}
    assert payload["answerable"] == {"true": 1, "false": 1}
