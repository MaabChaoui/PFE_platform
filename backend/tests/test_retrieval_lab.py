from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from akn_rlm.config import EMBED_MODEL, RERANKER_MODEL
from akn_rlm.retrievers.hybrid_fusion import rrf_fuse

from app.main import app
from app.models.retrieval import RetrievalCompareRequest
from app.services.retrieval_lab import RetrievalLabService


def test_bm25_channel_returns_ranked_hits() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/retrieval/compare",
            json={
                "query": "علاقات العمل",
                "retrievers": ["bm25"],
                "k_each": 10,
                "top_k": 5,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "علاقات العمل"
    assert [channel["name"] for channel in payload["channels"]] == ["bm25"]
    channel = payload["channels"][0]
    assert channel["n"] >= 1
    ranks = [candidate["rank"] for candidate in channel["candidates"]]
    assert ranks == list(range(1, len(ranks) + 1))
    assert channel["candidates"][0]["doc_id"]
    assert isinstance(channel["candidates"][0]["score"], float)


def test_rrf_weights_reorder_synthetic_lists() -> None:
    bm25 = [
        {"doc_id": "doc-a", "article_ref": "1", "score": 10.0},
        {"doc_id": "doc-b", "article_ref": "1", "score": 9.0},
    ]
    dense = [
        {"doc_id": "doc-b", "article_ref": "1", "score": 0.9},
        {"doc_id": "doc-a", "article_ref": "1", "score": 0.8},
    ]

    bm25_heavy = rrf_fuse([bm25, dense], weights=[3.0, 0.0])
    dense_heavy = rrf_fuse([bm25, dense], weights=[0.0, 3.0])

    assert bm25_heavy[0]["doc_id"] == "doc-a"
    assert dense_heavy[0]["doc_id"] == "doc-b"


def test_gold_marking_uses_canonical_doc_id_eid_rule() -> None:
    lab = RetrievalLabService(
        _FakePipeline(
            bm25_hits=[
                _hit("alias-doc", "2", 4.2),
                _hit("alias-doc", "3", 3.0),
            ],
            dense_hits=[],
        ),
        _FakeCorpus(),
        _FakeBenchmark(),
    )
    req = RetrievalCompareRequest(
        query="fixture",
        retrievers=["bm25"],
        gold_article_ids=["doc-a#art_2"],
    )

    payload = lab.compare(req)
    candidates = payload["channels"][0]["candidates"]

    assert candidates[0]["doc_id"] == "doc-a"
    assert candidates[0]["article_ref"] == "2"
    assert candidates[0]["is_gold"] is True
    assert candidates[1]["is_gold"] is False


def test_doc_id_filter_restricts_candidates_before_fusion() -> None:
    lab = RetrievalLabService(
        _FakePipeline(
            bm25_hits=[
                _hit("alias-doc", "2", 4.2),
                _hit("other-doc", "1", 5.0),
            ],
            dense_hits=[
                _hit("other-doc", "1", 0.9),
                _hit("doc-a", "3", 0.8),
            ],
        ),
        _FakeCorpus(),
        _FakeBenchmark(),
    )
    req = RetrievalCompareRequest(
        query="fixture",
        retrievers=["bm25", "dense", "hybrid"],
        doc_id="alias-doc",
        k_each=10,
        top_k=10,
    )

    payload = lab.compare(req)
    for channel in payload["channels"]:
        assert channel["candidates"]
        assert {candidate["doc_id"] for candidate in channel["candidates"]} == {"doc-a"}


@pytest.mark.models
def test_dense_channel_smoke_when_local_model_present() -> None:
    _skip_if_model_not_cached(EMBED_MODEL)
    with TestClient(app) as client:
        response = client.post(
            "/api/retrieval/compare",
            json={
                "query": "شروط الزواج",
                "retrievers": ["dense"],
                "k_each": 5,
                "top_k": 3,
            },
        )

    assert response.status_code == 200
    channel = response.json()["channels"][0]
    assert channel["name"] == "dense"
    assert channel["note"] is None
    assert channel["n"] >= 1


@pytest.mark.models
def test_hybrid_rerank_channel_smoke_when_local_models_present() -> None:
    _skip_if_model_not_cached(EMBED_MODEL)
    _skip_if_model_not_cached(RERANKER_MODEL)
    with TestClient(app) as client:
        response = client.post(
            "/api/retrieval/compare",
            json={
                "query": "شروط الزواج",
                "retrievers": ["hybrid_rerank"],
                "k_each": 5,
                "top_k": 3,
                "rerank_pool_size": 5,
            },
        )

    assert response.status_code == 200
    channel = response.json()["channels"][0]
    assert channel["name"] == "hybrid_rerank"
    assert channel["note"] is None
    assert channel["n"] >= 1


def _hit(doc_id: str, article_ref: str, score: float) -> SimpleNamespace:
    return SimpleNamespace(
        chunk_id=f"{doc_id}#{article_ref}",
        doc_id=doc_id,
        article_ref=article_ref,
        score=score,
        text=f"نص المادة {article_ref}",
    )


class _FakeSearchIndex:
    def __init__(self, hits: list[SimpleNamespace]) -> None:
        self.hits = hits

    def search(self, query: str, k: int = 20) -> list[SimpleNamespace]:
        return self.hits[:k]


class _FakePipeline:
    def __init__(
        self,
        *,
        bm25_hits: list[SimpleNamespace],
        dense_hits: list[SimpleNamespace],
    ) -> None:
        self._bm25 = _FakeSearchIndex(bm25_hits)
        self._dense = _FakeSearchIndex(dense_hits)

    def bm25(self) -> _FakeSearchIndex:
        return self._bm25

    def dense(self) -> _FakeSearchIndex:
        return self._dense

    def resolve_doc_id(self, doc_id: str | None) -> str | None:
        if doc_id in {"alias-doc", "doc-a"}:
            return "doc-a"
        if doc_id == "other-doc":
            return "other-doc"
        return None


class _FakeCorpus:
    def article(self, doc_id: str, article_ref: str) -> SimpleNamespace:
        canonical = "doc-a" if doc_id in {"alias-doc", "doc-a"} else doc_id
        return SimpleNamespace(
            doc_id=canonical,
            article_ref=article_ref,
            eid=f"art_{article_ref}",
            doc_title=f"title {canonical}",
            text_normalized=f"النص القانوني للمادة {article_ref}",
            text_ar=f"النص القانوني للمادة {article_ref}",
        )


class _FakeBenchmark:
    questions_by_id: dict = {}
    predictions_by_id: dict = {}


def _skip_if_model_not_cached(model_name: str) -> None:
    try:
        from huggingface_hub import scan_cache_dir
    except Exception as exc:
        pytest.skip(f"huggingface cache scanner unavailable: {exc}")

    try:
        cache = scan_cache_dir()
    except Exception as exc:
        pytest.skip(f"cannot inspect Hugging Face cache: {exc}")

    if not any(repo.repo_id == model_name and repo.revisions for repo in cache.repos):
        pytest.skip(f"local model weights not cached: {model_name}")
