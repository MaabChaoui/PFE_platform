from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.answer_runtime import pipeline_model_catalog
from app.settings import Settings


def test_pipeline_config_catalog_matches_locked_defaults() -> None:
    with TestClient(app) as client:
        response = client.get("/api/pipeline/config")

    assert response.status_code == 200
    payload = response.json()

    # Full control catalog (21 options: see answer_runtime.pipeline_config_options).
    assert len(payload["options"]) == 21

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
    assert by_key["classifier_model"]["default"] is None
    assert by_key["sub_model"]["default"] is None
    assert by_key["supervisor_model"]["default"] is None
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
    assert by_key["classifier_model"]["advanced"] is True
    assert by_key["sub_model"]["advanced"] is True
    assert by_key["supervisor_model"]["advanced"] is True
    assert by_key["enhancers.e7"]["advanced"] is True

    # defaults echo matches the per-option defaults.
    assert payload["defaults"]["recursion_max_depth"] == 3
    assert payload["defaults"]["hyde"] is True
    assert payload["defaults"]["classifier_model"] is None

    models = payload["models"]
    assert payload["model_overrides_enabled"] is True
    assert "root" not in models
    assert models["generator"][0] == {
        "id": "Qwen3-30B-A3B-Thinking",
        "label": (
            "Qwen3-30B-A3B-Thinking — locked sub-LM generator; overrides also "
            "route HyDE, gap probe, and router tie-breaker"
        ),
        "default": True,
    }
    assert "HyDE" in by_key["sub_model"]["help"]
    assert [m["id"] for m in models["classifier"]] == [
        "google/gemma-4-31B",
        "gpt-oss-120b",
        "Qwen3-30B-A3B-Thinking",
    ]
    assert models["classifier"][0]["default"] is True
    assert models["supervisor"][0]["id"] == "gpt-oss-120b"
    assert models["supervisor"][0]["default"] is True
    assert "intfloat/multilingual-e5-small" in [m["id"] for m in models["fixed"]]
    assert "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli" in [
        m["id"] for m in models["fixed"]
    ]


def test_pipeline_config_echoes_demo_default_model(monkeypatch) -> None:
    # SFIX-2: default-off (None) keeps the locked behaviour …
    with TestClient(app) as client:
        assert client.get("/api/pipeline/config").json()["demo_default_model"] is None

    # … and a configured demo default is echoed additively (catalog defaults
    # untouched — `default=True` still marks the locked Phase E models).
    from app.settings import settings as app_settings

    monkeypatch.setattr(app_settings, "DEMO_DEFAULT_MODEL", "google/gemma-4-31B")
    with TestClient(app) as client:
        payload = client.get("/api/pipeline/config").json()
    assert payload["demo_default_model"] == "google/gemma-4-31B"
    assert payload["models"]["generator"][0]["id"] == "Qwen3-30B-A3B-Thinking"
    assert payload["models"]["generator"][0]["default"] is True


def test_pipeline_model_catalog_can_be_configured_offline() -> None:
    config = Settings(
        MODEL_CATALOG_JSON=(
            '{"classifier": [{"id": "local-test", "label": "Local test", '
            '"default": true}]}'
        )
    )

    catalog = pipeline_model_catalog(config)

    assert list(catalog) == ["classifier"]
    assert catalog["classifier"][0].id == "local-test"
    assert catalog["classifier"][0].default is True


def test_pipeline_reset_clears_cache() -> None:
    with TestClient(app) as client:
        response = client.post("/api/pipeline/reset")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert isinstance(payload["cleared"], int)
    assert payload["cleared"] >= 0
