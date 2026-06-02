from __future__ import annotations

import json
from collections import Counter
from functools import cached_property
from typing import Any

from fastapi import HTTPException

from ..models import (
    BenchmarkQuestionDetail,
    BenchmarkQuestionPage,
    BenchmarkQuestionSummary,
    BenchmarkStats,
    Correctness,
    ExpectedArticle,
    PredictionView,
)
from ..settings import Settings, settings
from .corpus import CorpusService


class BenchmarkService:
    def __init__(
        self,
        corpus: CorpusService,
        config: Settings = settings,
    ) -> None:
        self.corpus = corpus
        self.settings = config

    def list_questions(
        self,
        *,
        query_type: str | None = None,
        difficulty: str | None = None,
        category: str | None = None,
        answerable: bool | None = None,
        language: str | None = None,
        split: str | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> BenchmarkQuestionPage:
        filtered = [
            question
            for question in self.questions
            if self._matches(
                question,
                query_type=query_type,
                difficulty=difficulty,
                category=category,
                answerable=answerable,
                language=language,
                split=split,
                q=q,
            )
        ]

        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        return BenchmarkQuestionPage(
            total=total,
            page=page,
            page_size=page_size,
            items=[self._summary(question) for question in filtered[start:end]],
        )

    def question_detail(self, question_id: str) -> BenchmarkQuestionDetail:
        question = self.questions_by_id.get(question_id)
        if question is None:
            raise HTTPException(status_code=404, detail="Benchmark question not found")

        prediction = self.predictions_by_id.get(question_id)
        payload = dict(question)
        payload["expected_articles"] = [
            self._expected_article(article)
            for article in question.get("expected_articles") or []
        ]
        payload["prediction"] = (
            self._prediction_view(question, prediction) if prediction is not None else None
        )
        payload["gold_vs_pred"] = self._gold_vs_pred(question, prediction)
        return BenchmarkQuestionDetail(**payload)

    def stats(self) -> BenchmarkStats:
        return BenchmarkStats(
            query_type=self._count("query_type"),
            difficulty=self._count("difficulty"),
            category=self._count("category"),
            answerable=self._count("answerable", stringify_bool=True),
            language=self._count("language"),
            split=self._count("split"),
        )

    @cached_property
    def benchmark_json(self) -> dict[str, Any]:
        path = self.settings.AKN_RLM_BENCHMARK_PATH
        if not path.exists():
            return {"metadata": {}, "document_registry": {}, "questions": []}
        return json.loads(path.read_text(encoding="utf-8"))

    @cached_property
    def document_registry(self) -> dict[str, Any]:
        registry = self.benchmark_json.get("document_registry") or {}
        return registry if isinstance(registry, dict) else {}

    @cached_property
    def questions(self) -> list[dict[str, Any]]:
        questions = self.benchmark_json.get("questions") or []
        return [question for question in questions if isinstance(question, dict)]

    @cached_property
    def questions_by_id(self) -> dict[str, dict[str, Any]]:
        return {
            str(question["id"]): question
            for question in self.questions
            if question.get("id") is not None
        }

    @cached_property
    def predictions_by_id(self) -> dict[str, dict[str, Any]]:
        path = self.settings.PREDICTIONS_PATH
        if path is None or not path.exists():
            return {}

        predictions: dict[str, dict[str, Any]] = {}
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                record = json.loads(line)
                question_id = record.get("question_id")
                if question_id is not None:
                    predictions[str(question_id)] = record
        return predictions

    def _matches(
        self,
        question: dict[str, Any],
        *,
        query_type: str | None,
        difficulty: str | None,
        category: str | None,
        answerable: bool | None,
        language: str | None,
        split: str | None,
        q: str | None,
    ) -> bool:
        if query_type and question.get("query_type") != query_type:
            return False
        if difficulty and question.get("difficulty") != difficulty:
            return False
        if category and question.get("category") != category:
            return False
        if answerable is not None and bool(question.get("answerable")) is not answerable:
            return False
        if language and question.get("language") != language:
            return False
        if split and question.get("split") != split:
            return False
        if q:
            needle = q.casefold().strip()
            haystack = str(question.get("question") or "").casefold()
            if needle and needle not in haystack:
                return False
        return True

    def _summary(self, question: dict[str, Any]) -> BenchmarkQuestionSummary:
        prediction = self.predictions_by_id.get(str(question.get("id")))
        return BenchmarkQuestionSummary(
            id=str(question.get("id")),
            query_type=str(question.get("query_type") or ""),
            difficulty=str(question.get("difficulty") or ""),
            category=str(question.get("category") or ""),
            language=str(question.get("language") or ""),
            answerable=bool(question.get("answerable")),
            question=str(question.get("question") or ""),
            dispatched_handler=(
                str(prediction.get("dispatched_handler"))
                if prediction and prediction.get("dispatched_handler") is not None
                else None
            ),
            predicted_abstain=(
                bool(prediction.get("predicted_abstain"))
                if prediction and prediction.get("predicted_abstain") is not None
                else None
            ),
            latency_s=(
                float(prediction["latency_s"])
                if prediction and prediction.get("latency_s") is not None
                else None
            ),
            correctness=self._correctness(question, prediction),
            has_prediction=prediction is not None,
        )

    def _expected_article(self, article: dict[str, Any]) -> ExpectedArticle:
        payload = dict(article)
        payload.update(
            {
                "text": None,
                "resolved": False,
                "resolved_doc_id": None,
                "eid": None,
                "doc_title": None,
                "ancestors": {},
            }
        )

        if not article.get("in_dataset", True):
            return ExpectedArticle(**payload)

        doc_id = str(article.get("document_id") or "")
        article_ref = str(article.get("article_ref") or "")
        try:
            resolved = self.corpus.article(doc_id, article_ref)
        except HTTPException:
            return ExpectedArticle(**payload)

        payload.update(
            {
                "text": resolved.text_ar,
                "resolved": True,
                "resolved_doc_id": resolved.doc_id,
                "eid": resolved.eid,
                "doc_title": resolved.doc_title,
                "ancestors": resolved.ancestors,
            }
        )
        return ExpectedArticle(**payload)

    def _prediction_view(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any],
    ) -> PredictionView:
        payload = dict(prediction)
        payload["correctness"] = self._correctness(question, prediction)
        return PredictionView(**payload)

    def _gold_vs_pred(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any] | None,
    ) -> dict[str, Any]:
        gold_ids = self._gold_article_ids(question, prediction)
        pred_ids = set(prediction.get("pred_article_ids") or []) if prediction else set()
        sorted_gold = sorted(gold_ids)
        sorted_pred = sorted(pred_ids)

        return {
            "gold_article_ids": sorted_gold,
            "pred_article_ids": sorted_pred,
            "gold": [
                {
                    "article_id": article_id,
                    "retrieved": article_id in pred_ids,
                    "cited": article_id in pred_ids,
                }
                for article_id in sorted_gold
            ],
            "gold_not_pred": sorted(gold_ids - pred_ids),
            "pred_not_gold": sorted(pred_ids - gold_ids),
            "n_gold": len(gold_ids),
            "n_pred": len(pred_ids),
            "n_correct": len(gold_ids & pred_ids),
            "retrieval_source": "pred_article_ids",
        }

    def _correctness(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any] | None,
    ) -> Correctness:
        if prediction is not None and self._abstention_scored(question, prediction):
            gold_abstain = bool(
                prediction.get(
                    "gold_abstain",
                    question.get("query_type") == "unanswerable",
                )
            )
            predicted_abstain = bool(prediction.get("predicted_abstain"))
            correct = predicted_abstain == gold_abstain
            score = 1.0 if correct else 0.0
            return Correctness(
                n_gold=int(gold_abstain),
                n_pred=int(predicted_abstain),
                n_correct=int(correct),
                precision=score,
                recall=score,
                f1=score,
                abstention_scored=True,
            )

        gold_ids = self._gold_article_ids(question, prediction)
        pred_ids = set(prediction.get("pred_article_ids") or []) if prediction else set()
        n_gold = len(gold_ids)
        n_pred = len(pred_ids)
        n_correct = len(gold_ids & pred_ids)
        precision = n_correct / n_pred if n_pred else 0.0
        recall = n_correct / n_gold if n_gold else 0.0
        f1 = (
            (2 * precision * recall / (precision + recall))
            if precision + recall
            else 0.0
        )
        return Correctness(
            n_gold=n_gold,
            n_pred=n_pred,
            n_correct=n_correct,
            precision=precision,
            recall=recall,
            f1=f1,
            abstention_scored=False,
        )

    def _abstention_scored(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any],
    ) -> bool:
        return bool(prediction.get("gold_abstain")) or question.get("query_type") == "unanswerable"

    def _gold_article_ids(
        self,
        question: dict[str, Any],
        prediction: dict[str, Any] | None,
    ) -> set[str]:
        if prediction and prediction.get("gold_article_ids"):
            return {str(article_id) for article_id in prediction["gold_article_ids"]}

        from akn_rlm.normalizers import ref_to_eid

        gold_ids: set[str] = set()
        for article in question.get("expected_articles") or []:
            if not article.get("in_dataset", True):
                continue
            doc_id = str(article.get("document_id") or "")
            article_ref = str(article.get("article_ref") or "")
            if not doc_id or not article_ref:
                continue
            canonical = self.corpus.pipeline.resolve_doc_id(doc_id) or doc_id
            gold_ids.add(f"{canonical}#{ref_to_eid(article_ref)}")
        return gold_ids

    def _count(self, field: str, *, stringify_bool: bool = False) -> dict[str, int]:
        counter: Counter[str] = Counter()
        for question in self.questions:
            value = question.get(field)
            if stringify_bool:
                key = "true" if bool(value) else "false"
            else:
                key = str(value)
            counter[key] += 1
        return dict(counter)
