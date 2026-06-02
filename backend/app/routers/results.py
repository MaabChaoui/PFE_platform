from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_results
from ..models import (
    BaselinesResponse,
    ClassificationResponse,
    MetricsResponse,
    RunSummary,
)
from ..services.results import ResultsService

router = APIRouter()


@router.get("/results/metrics", response_model=MetricsResponse)
def metrics(results: ResultsService = Depends(get_results)) -> MetricsResponse:
    return results.metrics()


@router.get("/results/baselines", response_model=BaselinesResponse)
def baselines(results: ResultsService = Depends(get_results)) -> BaselinesResponse:
    return results.baselines()


@router.get("/results/runs", response_model=list[RunSummary])
def runs(results: ResultsService = Depends(get_results)) -> list[RunSummary]:
    return results.runs()


@router.get("/results/classification", response_model=ClassificationResponse)
def classification(
    results: ResultsService = Depends(get_results),
) -> ClassificationResponse:
    return results.classification()
