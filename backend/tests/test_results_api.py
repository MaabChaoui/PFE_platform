from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_results_metrics_and_runs() -> None:
    with TestClient(app) as client:
        metrics_response = client.get("/api/results/metrics")
        runs_response = client.get("/api/results/runs")

    assert metrics_response.status_code == 200
    metrics = metrics_response.json()
    assert metrics["overall"]["citation_f1"] == 0.5
    assert metrics["overall"]["abstention_f1"] == 1.0
    assert set(metrics) >= {
        "overall",
        "by_query_type",
        "by_category",
        "by_difficulty",
        "by_language",
        "by_split",
        "temporal",
        "counts",
    }

    assert runs_response.status_code == 200
    runs = runs_response.json()
    assert len(runs) == 1
    assert runs[0]["run_id"] == "rlm_dispatched_full_phase_e_final"
    assert runs[0]["is_locked"] is True
    assert runs[0]["citation_f1"] == 0.5


def test_results_baselines_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/results/baselines")

    assert response.status_code == 200
    payload = response.json()
    assert payload["improvement_factors"] == {
        "vs_strongest_direct_llm": 1.64,
        "vs_strongest_deterministic": 2.9,
        "vs_strongest_minimal_rag": 1.74,
    }
    assert payload["tier1_direct_llm"][-1]["model"] == "AKN-RLM"
    assert payload["ablation"][0]["config"] == "Locked"
    assert "citation_f1" in payload["metric_definitions"]


def test_results_classification_metrics() -> None:
    with TestClient(app) as client:
        response = client.get("/api/results/classification")

    assert response.status_code == 200
    payload = response.json()
    assert payload["accuracy"] == 0.75
    assert payload["n"] == 4
    assert len(payload["labels"]) == 8
    assert payload["per_type"]["unanswerable"]["support"] == 2
    assert payload["per_type"]["unanswerable"]["precision"] == 1.0
    assert payload["per_type"]["unanswerable"]["recall"] == 0.5
    assert payload["confusion_matrix"]["unanswerable"]["rule_application"] == 1
