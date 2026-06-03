from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import get_retrieval_lab
from ..models import RetrievalCompareRequest, RetrievalCompareResponse
from ..services.retrieval_lab import RetrievalLabService

router = APIRouter()


@router.post("/retrieval/compare", response_model=RetrievalCompareResponse)
def compare(
    req: RetrievalCompareRequest,
    lab: RetrievalLabService = Depends(get_retrieval_lab),
) -> dict:
    return lab.compare(req)
