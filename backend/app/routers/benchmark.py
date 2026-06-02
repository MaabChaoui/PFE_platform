from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..deps import get_benchmark
from ..models import BenchmarkQuestionDetail, BenchmarkQuestionPage, BenchmarkStats
from ..services.benchmark import BenchmarkService

router = APIRouter()


@router.get("/benchmark/questions", response_model=BenchmarkQuestionPage)
def questions(
    query_type: str | None = None,
    difficulty: str | None = None,
    category: str | None = None,
    answerable: bool | None = None,
    language: str | None = None,
    split: str | None = None,
    q: str | None = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    benchmark: BenchmarkService = Depends(get_benchmark),
) -> BenchmarkQuestionPage:
    return benchmark.list_questions(
        query_type=query_type,
        difficulty=difficulty,
        category=category,
        answerable=answerable,
        language=language,
        split=split,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.get("/benchmark/questions/{question_id}", response_model=BenchmarkQuestionDetail)
def question_detail(
    question_id: str,
    benchmark: BenchmarkService = Depends(get_benchmark),
) -> BenchmarkQuestionDetail:
    return benchmark.question_detail(question_id)


@router.get("/benchmark/stats", response_model=BenchmarkStats)
def stats(benchmark: BenchmarkService = Depends(get_benchmark)) -> BenchmarkStats:
    return benchmark.stats()
