from __future__ import annotations

import json
from collections import Counter
from functools import cached_property
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..models import (
    BaselinesResponse,
    ClassificationResponse,
    ClassificationTypeMetrics,
    MetricsResponse,
    RunSummary,
)
from ..settings import Settings, settings

LOCKED_RUN_ID = "rlm_dispatched_full_phase_e_final"
QUERY_TYPE_ORDER = [
    "rule_application",
    "exact_article",
    "unanswerable",
    "multi_hop",
    "long_context",
    "layman",
    "conceptual_definitional",
    "temporal_factual",
]


class ResultsService:
    def __init__(self, config: Settings = settings) -> None:
        self.settings = config

    def metrics(self) -> MetricsResponse:
        path = self.settings.METRICS_PATH
        if path is None or not path.exists():
            raise HTTPException(status_code=404, detail="metrics.json not found")
        return MetricsResponse(**json.loads(path.read_text(encoding="utf-8")))

    def runs(self) -> list[RunSummary]:
        root = self.settings.EVAL_RESULTS_DIR
        if not root.exists():
            return []

        runs: list[RunSummary] = []
        for metrics_path in sorted(root.glob("*/metrics.json")):
            try:
                data = json.loads(metrics_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue

            overall = data.get("overall") or {}
            run_id = metrics_path.parent.name
            runs.append(
                RunSummary(
                    run_id=run_id,
                    citation_f1=_float_or_none(overall.get("citation_f1")),
                    abstention_f1=_float_or_none(overall.get("abstention_f1")),
                    hcr=_float_or_none(overall.get("hcr")),
                    jir=_float_or_none(overall.get("jir")),
                    is_locked=run_id == LOCKED_RUN_ID,
                )
            )

        runs.sort(key=lambda run: (not run.is_locked, run.run_id))
        return runs

    def baselines(self) -> BaselinesResponse:
        path = Path(__file__).resolve().parents[1] / "data" / "baselines.json"
        if not path.exists():
            raise HTTPException(status_code=404, detail="baselines.json not found")
        return BaselinesResponse(**json.loads(path.read_text(encoding="utf-8")))

    def classification(self) -> ClassificationResponse:
        predictions = self._classifier_predictions
        confusion_matrix = self._confusion_matrix
        labels = self._labels(predictions, confusion_matrix)

        support: Counter[str] = Counter()
        predicted_as: Counter[str] = Counter()
        true_positive: Counter[str] = Counter()
        correct = 0

        for record in predictions:
            gold = _gold_label(record)
            predicted = _predicted_label(record)
            if gold is None or predicted is None:
                continue
            support[gold] += 1
            predicted_as[predicted] += 1
            if gold == predicted:
                correct += 1
                true_positive[gold] += 1

        per_type: dict[str, ClassificationTypeMetrics] = {}
        for label in labels:
            precision = (
                true_positive[label] / predicted_as[label]
                if predicted_as[label]
                else 0.0
            )
            recall = true_positive[label] / support[label] if support[label] else 0.0
            f1 = (
                (2 * precision * recall / (precision + recall))
                if precision + recall
                else 0.0
            )
            per_type[label] = ClassificationTypeMetrics(
                precision=precision,
                recall=recall,
                f1=f1,
                support=support[label],
            )

        n = len(
            [
                record
                for record in predictions
                if _gold_label(record) is not None and _predicted_label(record) is not None
            ]
        )
        return ClassificationResponse(
            accuracy=(correct / n if n else 0.0),
            n=n,
            per_type=per_type,
            confusion_matrix=confusion_matrix,
            labels=labels,
        )

    @cached_property
    def _classifier_predictions(self) -> list[dict[str, Any]]:
        directory = self.settings.CLASSIFIER_DIR
        path = directory / "classifier_predictions.jsonl" if directory else None
        if path is None or not path.exists():
            raise HTTPException(
                status_code=404,
                detail="classifier_predictions.jsonl not found",
            )

        records: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    records.append(json.loads(line))
        return records

    @cached_property
    def _confusion_matrix(self) -> dict[str, dict[str, int]]:
        directory = self.settings.CLASSIFIER_DIR
        path = directory / "confusion_matrix.json" if directory else None
        if path is None or not path.exists():
            raise HTTPException(status_code=404, detail="confusion_matrix.json not found")

        raw = json.loads(path.read_text(encoding="utf-8"))
        return {
            str(true_label): {
                str(predicted_label): int(count)
                for predicted_label, count in (row or {}).items()
            }
            for true_label, row in raw.items()
        }

    def _labels(
        self,
        predictions: list[dict[str, Any]],
        confusion_matrix: dict[str, dict[str, int]],
    ) -> list[str]:
        seen = set(confusion_matrix.keys())
        for row in confusion_matrix.values():
            seen.update(row.keys())
        for record in predictions:
            gold = _gold_label(record)
            predicted = _predicted_label(record)
            if gold:
                seen.add(gold)
            if predicted:
                seen.add(predicted)

        labels = list(QUERY_TYPE_ORDER)
        labels.extend(sorted(seen - set(labels)))
        return labels


def _gold_label(record: dict[str, Any]) -> str | None:
    value = (
        record.get("gold_query_type")
        or record.get("gold")
        or record.get("query_type")
        or record.get("true_query_type")
    )
    return str(value) if value is not None else None


def _predicted_label(record: dict[str, Any]) -> str | None:
    value = (
        record.get("pred_query_type")
        or record.get("predicted_query_type")
        or record.get("prediction")
        or record.get("predicted")
    )
    return str(value) if value is not None else None


def _float_or_none(value: Any) -> float | None:
    return float(value) if value is not None else None
