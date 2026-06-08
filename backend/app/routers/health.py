from fastapi import APIRouter
from ..deps import corpus_ready
from ..services.health_probe import get_llm_status
from ..settings import settings

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "offline_mode": settings.OFFLINE_MODE,
        "indices_present": (settings.INDICES_DIR / "bm25.pkl").exists(),
        "dataset_present": settings.AKN_RLM_BENCHMARK_PATH.exists(),
        "predictions_present": (
            settings.PREDICTIONS_PATH is not None
            and settings.PREDICTIONS_PATH.exists()
        ),
        "corpus_ready": corpus_ready(),
        # Real cached probe (S15). Non-blocking: offline → "disabled" instantly;
        # online → "unchecked" then "ok"/"unreachable" once the bg probe lands.
        "llm": get_llm_status(),
    }
