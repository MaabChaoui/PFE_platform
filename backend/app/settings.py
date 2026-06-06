from pathlib import Path
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root is 3 levels up: settings.py → app/ → backend/ → PFE_locally/
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    AKN_RLM_AKN_DIR: Path = REPO_ROOT / "latest_dataset/akn"
    AKN_RLM_TXT_DIR: Path = REPO_ROOT / "latest_dataset/txt"
    AKN_RLM_RDF_DIR: Path = REPO_ROOT / "latest_dataset/rdf"
    AKN_RLM_PDF_DIR: Path = REPO_ROOT / "latest_dataset/pdf"
    AKN_RLM_KG_PATH: Path = REPO_ROOT / "latest_dataset/rdf/algerian_legal_kg.ttl"
    AKN_RLM_EXTRACTION_REPORT_PATH: Path = (
        REPO_ROOT / "latest_dataset/rdf/extraction_report.json"
    )
    AKN_RLM_BENCHMARK_PATH: Path = REPO_ROOT / "latest_dataset/AlgerianLegalBench_v3.0_final.json"
    KG_INDEX_PATH: Path = REPO_ROOT / "backend/data/kg_index.sqlite"
    KG_BUILD_ON_START: bool = True
    INDICES_DIR: Path = REPO_ROOT / "akn_rlm/data/indices"
    EVAL_RESULTS_DIR: Path = REPO_ROOT / "akn_rlm/eval_results"

    # Derived from EVAL_RESULTS_DIR when not explicitly set (handles Docker override)
    PREDICTIONS_PATH: Optional[Path] = None
    METRICS_PATH: Optional[Path] = None
    CLASSIFIER_DIR: Optional[Path] = None

    OFFLINE_MODE: bool = True
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOW_MODEL_OVERRIDE: bool = True
    MODEL_CATALOG_JSON: Optional[str] = None

    @model_validator(mode="after")
    def derive_paths(self) -> "Settings":
        run_dir = self.EVAL_RESULTS_DIR / "rlm_dispatched_full_phase_e_final"
        if self.PREDICTIONS_PATH is None:
            self.PREDICTIONS_PATH = run_dir / "predictions.jsonl"
        if self.METRICS_PATH is None:
            self.METRICS_PATH = run_dir / "metrics.json"
        if self.CLASSIFIER_DIR is None:
            self.CLASSIFIER_DIR = self.EVAL_RESULTS_DIR / "classifier_accuracy_llm_final"
        return self


settings = Settings()
