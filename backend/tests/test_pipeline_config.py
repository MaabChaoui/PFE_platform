from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_pipeline_config_catalog_matches_locked_defaults() -> None:
    with TestClient(app) as client:
        response = client.get("/api/pipeline/config")

    assert response.status_code == 200
    payload = response.json()

    # Full control catalog (19 options: see answer_runtime.pipeline_config_options).
    assert len(payload["options"]) == 19

    # The 8 ALB v3.0 query types are enumerated.
    assert payload["query_types"] == [
        "rule_application",
        "exact_article",
        "multi_hop",
        "unanswerable",
        "layman",
        "long_context",
        "conceptual_definitional",
        "temporal_factual",
    ]

    by_key = {option["key"]: option for option in payload["options"]}

    # Defaults reproduce the locked Phase E config.
    assert by_key["query_type"]["default"] is None
    assert by_key["enable_recursion"]["default"] is True
    assert by_key["recursion_max_depth"]["default"] == 3
    assert by_key["mh_ra_coverage_min"]["default"] == 4
    assert by_key["enable_corrective_retry"]["default"] is True
    assert by_key["enable_pervasive_adu"]["default"] is True
    assert by_key["adu_extract_top_n"]["default"] == 5
    assert by_key["hyde"]["default"] is True
    assert by_key["ceiling_breakers"]["default"] is False
    assert by_key["use_kg"]["default"] is True
    assert by_key["citation_gate"]["default"] is True
    assert by_key["enhancers.e1"]["default"] is False

    # query_type allows null + the 8 types.
    allowed = by_key["query_type"]["allowed"]
    assert allowed[0] is None
    assert "multi_hop" in allowed
    assert len([a for a in allowed if a is not None]) == 8

    # requires_live + advanced flags are present and sane.
    assert by_key["hyde"]["requires_live"] is True
    assert by_key["enable_recursion"]["advanced"] is False
    assert by_key["ceiling_breakers"]["advanced"] is True
    assert by_key["enhancers.e7"]["advanced"] is True

    # defaults echo matches the per-option defaults.
    assert payload["defaults"]["recursion_max_depth"] == 3
    assert payload["defaults"]["hyde"] is True


def test_pipeline_reset_clears_cache() -> None:
    with TestClient(app) as client:
        response = client.post("/api/pipeline/reset")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert isinstance(payload["cleared"], int)
    assert payload["cleared"] >= 0
