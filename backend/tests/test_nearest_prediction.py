"""S15 — nearest-precomputed fallback helper (BenchmarkService)."""
from __future__ import annotations

from app.deps import get_benchmark
from app.services.benchmark import BenchmarkService


def test_nearest_prefers_matching_query_type() -> None:
    bench = get_benchmark()
    rec = bench.nearest_prediction(query_type="unanswerable")
    assert rec is not None
    assert rec["query_type"] == "unanswerable"  # fixture-q2


def test_nearest_lexical_match_picks_closest_query() -> None:
    bench = get_benchmark()
    # Near-identical to fixture-q1's own query → should pick fixture-q1.
    rec = bench.nearest_prediction(query="ما مضمون المادة الأولى من القانون؟")
    assert rec is not None
    assert rec["question_id"] == "fixture-q1"


def test_nearest_no_query_returns_first_of_type_pool() -> None:
    bench = get_benchmark()
    rec = bench.nearest_prediction(query_type="exact_article")
    assert rec is not None
    assert rec["query_type"] == "exact_article"


def test_nearest_unknown_type_falls_back_to_full_pool() -> None:
    bench = get_benchmark()
    # No prediction has this type → pool falls back to all; a record is returned.
    rec = bench.nearest_prediction(query="أي شيء", query_type="does_not_exist")
    assert rec is not None


def test_nearest_empty_predictions_returns_none(monkeypatch) -> None:
    bench = BenchmarkService(get_benchmark().corpus)
    # Force an empty prediction set (cached_property override).
    bench.__dict__["predictions_by_id"] = {}
    assert bench.nearest_prediction(query="x", query_type="exact_article") is None
