"""S4 — live answer + SSE stream + classify + pipeline config/reset.

Offline-safe endpoints: ``/pipeline/config``, ``/pipeline/reset`` and the SSE
``replay`` mode (precomputed trajectory). Live endpoints (``/answer``,
``/classify``, SSE ``live`` mode) degrade gracefully to a 503 / ``error`` event
when keys/endpoint are unavailable — they never crash the server. See
``plan.md`` §5 (control map) and §9 (replay vs live).
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse
from starlette.concurrency import run_in_threadpool

from ..deps import get_benchmark, get_pipeline
from ..models.answer import (
    QUERY_TYPES,
    AnswerOptions,
    AnswerRequest,
    AnswerResponseModel,
    ClassifyRequest,
    ClassifyResponse,
    NearestResponse,
    PipelineConfig,
    ResetResponse,
    StreamRequest,
)
from ..services.answer_runtime import (
    pipeline_config_options,
    pipeline_model_catalog,
    replay_response,
)
from ..services.benchmark import BenchmarkService
from ..services.pipeline import (
    LiveReplayRedirect,
    PipelineLiveError,
    PipelineService,
)
from ..settings import settings

router = APIRouter()

#: Seconds between SSE heartbeats while a live run blocks in the threadpool.
_HEARTBEAT_S: float = 5.0
#: Small pacing delay between emitted trajectory steps so the UI can animate.
_STEP_PACING_S: float = 0.06


def _fallback_note(reason: str, query_type: str | None) -> str:
    """Honest, user-visible note explaining why a precomputed example is shown
    under a live query (rendered as an in-panel banner, per the demo's honesty
    contract — not just a transient toast)."""
    if reason == "tf_cd":
        return (
            "This query type relies on the full knowledge graph "
            "(temporal / conceptual reasoning). To keep the live demo fast, "
            "AKN-RLM is showing the nearest precomputed example instead."
        )
    return (
        "The live run couldn’t complete, so AKN-RLM is showing the nearest "
        "precomputed example for this question type."
    )


def _sse(event: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"event": event, "data": json.dumps(payload, ensure_ascii=False)}


def _step_payload(index: int, step: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": index,
        "step": step.get("step", "?"),
        "depth": step.get("depth", 0),
        "summary": step.get("summary", ""),
        "detail": step.get("detail", {}),
    }


# ---------------------------------------------------------------------------
# Sync live answer
# ---------------------------------------------------------------------------


@router.post("/answer", response_model=AnswerResponseModel)
def answer(
    body: AnswerRequest,
    pipeline: PipelineService = Depends(get_pipeline),
    benchmark: BenchmarkService = Depends(get_benchmark),
) -> dict[str, Any]:
    """Run the live pipeline (sync). 503 on LLM/endpoint failure. A live TF/CD
    query under ``LIVE_TF_CD="replay"`` falls back to the nearest precomputed
    example instead of loading the 74 MB KG."""
    try:
        return pipeline.answer(body.query, body.options)
    except LiveReplayRedirect as redirect:
        record = benchmark.nearest_prediction(
            query=redirect.query, query_type=redirect.query_type
        )
        if record is None:
            raise HTTPException(
                status_code=503,
                detail="TF/CD live runs are disabled and no precomputed example exists",
            )
        resp, _scores = replay_response(record)
        return resp.to_dict()
    except PipelineLiveError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# Classify preview
# ---------------------------------------------------------------------------


@router.post("/classify", response_model=ClassifyResponse)
def classify(
    body: ClassifyRequest,
    pipeline: PipelineService = Depends(get_pipeline),
) -> ClassifyResponse:
    """Live classifier preview. 503 when the LLM can't produce a label."""
    try:
        query_type, confidence = pipeline.classify(body.query)
    except PipelineLiveError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return ClassifyResponse(query_type=query_type, confidence=confidence)


# ---------------------------------------------------------------------------
# Nearest precomputed example (offline) — relevant replay fallback
# ---------------------------------------------------------------------------


@router.get("/answer/nearest", response_model=NearestResponse)
def answer_nearest(
    query: Optional[str] = Query(default=None),
    query_type: Optional[str] = Query(default=None),
    benchmark: BenchmarkService = Depends(get_benchmark),
) -> NearestResponse:
    """Return the nearest precomputed example to replay when a live run fails.
    OFFLINE. Powers the live-error surface's "Replay a relevant example"."""
    record = benchmark.nearest_prediction(query=query, query_type=query_type)
    if record is None:
        raise HTTPException(status_code=404, detail="no precomputed predictions available")
    return NearestResponse(
        question_id=str(record.get("question_id") or ""),
        query=str(record.get("query") or ""),
        query_type=str(record.get("query_type") or ""),
        dispatched_handler=record.get("dispatched_handler"),
    )


# ---------------------------------------------------------------------------
# SSE stream — replay (offline) + live
# ---------------------------------------------------------------------------


async def _replay_events(record: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
    resp, scores = replay_response(record)
    resp_dict = resp.to_dict()
    steps = resp_dict.get("trajectory") or []
    for index, step in enumerate(steps):
        yield _sse("step", _step_payload(index, step))
        await asyncio.sleep(_STEP_PACING_S)
    yield _sse("answer", {**resp_dict, "scores": scores})
    yield _sse("done", {"ok": True, "mode": "replay", "n_steps": len(steps)})


async def _fallback_replay_events(
    benchmark: BenchmarkService,
    *,
    query: str,
    query_type: str | None,
    reason: str,
) -> AsyncIterator[dict[str, Any]]:
    """Serve the nearest precomputed example as a replay, carrying a ``fallback``
    marker (+ honest note) on the ``answer`` and ``done`` events so the UI shows
    a banner. Used when a live TF/CD query is routed to replay (LIVE_TF_CD)."""
    record = benchmark.nearest_prediction(query=query, query_type=query_type)
    if record is None:
        yield _sse("error", {
            "detail": "no precomputed example available to fall back to",
        })
        return

    resp, scores = replay_response(record)
    resp_dict = resp.to_dict()
    fallback = {
        "reason": reason,
        "query_type": query_type,
        "note": _fallback_note(reason, query_type),
        "example_question_id": str(record.get("question_id") or ""),
        "example_query": str(record.get("query") or ""),
    }
    steps = resp_dict.get("trajectory") or []
    for index, step in enumerate(steps):
        yield _sse("step", _step_payload(index, step))
        await asyncio.sleep(_STEP_PACING_S)
    yield _sse("answer", {**resp_dict, "scores": scores, "fallback": fallback})
    yield _sse("done", {
        "ok": True, "mode": "replay", "n_steps": len(steps), "fallback": fallback,
    })


async def _live_events(
    pipeline: PipelineService,
    query: str,
    options: AnswerOptions,
    benchmark: BenchmarkService,
) -> AsyncIterator[dict[str, Any]]:
    # The dispatcher is blocking (10-60 s) with no mid-run hooks, so we run it
    # in a threadpool and emit heartbeats while it works, then replay its
    # trajectory post-hoc. True mid-run streaming would need akn_rlm callbacks
    # (explicit non-goal for S4).
    task = asyncio.ensure_future(run_in_threadpool(pipeline.answer, query, options))
    started = time.time()
    while True:
        done, _ = await asyncio.wait({task}, timeout=_HEARTBEAT_S)
        if task in done:
            break
        yield _sse("heartbeat", {
            "elapsed_s": round(time.time() - started, 1),
            "status": "running",
        })

    try:
        resp_dict = task.result()
    except LiveReplayRedirect as redirect:
        # TF/CD routed to replay (LIVE_TF_CD): serve the nearest precomputed
        # example inline instead of loading the heavy KG. MUST precede the
        # generic Exception handler (it is not a PipelineLiveError).
        async for event in _fallback_replay_events(
            benchmark,
            query=redirect.query,
            query_type=redirect.query_type,
            reason="tf_cd",
        ):
            yield event
        return
    except PipelineLiveError as exc:
        yield _sse("error", {"detail": str(exc)})
        return
    except Exception as exc:  # never crash the stream
        yield _sse("error", {"detail": f"unexpected live error: {exc}"})
        return

    steps = resp_dict.get("trajectory") or []
    for index, step in enumerate(steps):
        yield _sse("step", _step_payload(index, step))
        await asyncio.sleep(_STEP_PACING_S)
    yield _sse("answer", resp_dict)
    yield _sse("done", {"ok": True, "mode": "live", "n_steps": len(steps)})


@router.post("/answer/stream")
def answer_stream(
    body: StreamRequest,
    pipeline: PipelineService = Depends(get_pipeline),
    benchmark: BenchmarkService = Depends(get_benchmark),
) -> EventSourceResponse:
    """SSE stream. ``replay`` = precomputed (offline); ``live`` = SSE over a
    threadpool run with heartbeats then post-hoc step replay."""
    if body.mode == "replay":
        if not body.question_id:
            raise HTTPException(status_code=422, detail="replay mode requires question_id")
        record = benchmark.predictions_by_id.get(body.question_id)
        if record is None:
            raise HTTPException(
                status_code=404,
                detail=f"no precomputed prediction for question_id={body.question_id!r}",
            )
        return EventSourceResponse(_replay_events(record))

    # live
    if not (body.query and body.query.strip()):
        raise HTTPException(status_code=422, detail="live mode requires a non-empty query")
    return EventSourceResponse(
        _live_events(pipeline, body.query, body.options, benchmark)
    )


# ---------------------------------------------------------------------------
# Pipeline config + reset (offline)
# ---------------------------------------------------------------------------


@router.get("/pipeline/config", response_model=PipelineConfig)
def pipeline_config() -> PipelineConfig:
    """Control catalog the frontend renders the panel from. OFFLINE."""
    options = pipeline_config_options()
    defaults = {option.key: option.default for option in options}
    return PipelineConfig(
        options=options,
        query_types=list(QUERY_TYPES),
        defaults=defaults,
        models=pipeline_model_catalog(),
        model_overrides_enabled=settings.ALLOW_MODEL_OVERRIDE,
        demo_default_model=settings.DEMO_DEFAULT_MODEL,
    )


@router.post("/pipeline/reset", response_model=ResetResponse)
def pipeline_reset(
    pipeline: PipelineService = Depends(get_pipeline),
) -> ResetResponse:
    """Clear the memoized dispatcher cache. OFFLINE."""
    cleared = pipeline.reset_dispatchers()
    return ResetResponse(ok=True, cleared=cleared)
