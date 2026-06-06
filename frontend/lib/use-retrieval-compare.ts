'use client'

/**
 * S10c — fire ONE `POST /api/retrieval/compare` per replayed question to feed the
 * reasoning trace's retrieve station with the REAL ranked articles (BM25, Dense,
 * fused Hybrid RRF, and the rerank baseline). Fully offline: the endpoint runs
 * over the built indices with NO LLM.
 *
 * Design notes:
 *   · Seeded by `question_id` ONLY — the backend auto-resolves the query AND the
 *     gold article ids and marks `is_gold` candidates.
 *   · Cached per question id (module-level), so replaying the same question — or
 *     toggling between questions — never refetches.
 *   · Non-blocking: the trace renders immediately; this fills in when it resolves.
 *   · AbortController cancels the in-flight fetch on question change / unmount; a
 *     superseded request is ignored via a monotonic nonce.
 *   · A modest pool (top_k 25 / k_each 40) keeps the payload bounded while giving
 *     gold articles a fair chance to surface; the UI shows top ~6 with expand.
 */
import * as React from 'react'

import { compareRetrieval } from './api'
import type { CompareResponse } from './types'

export type CompareStatus = 'idle' | 'loading' | 'done' | 'error'

const CACHE = new Map<string, CompareResponse>()

export interface RetrievalCompareState {
  compare: CompareResponse | null
  status: CompareStatus
}

export function useRetrievalCompare(
  questionId: string | null | undefined,
): RetrievalCompareState {
  const [state, setState] = React.useState<RetrievalCompareState>(() => ({
    compare: questionId ? (CACHE.get(questionId) ?? null) : null,
    status: questionId && CACHE.has(questionId) ? 'done' : 'idle',
  }))
  const nonce = React.useRef(0)

  React.useEffect(() => {
    const myRun = ++nonce.current

    if (!questionId) {
      setState({ compare: null, status: 'idle' })
      return
    }

    const cached = CACHE.get(questionId)
    if (cached) {
      setState({ compare: cached, status: 'done' })
      return
    }

    const controller = new AbortController()
    setState({ compare: null, status: 'loading' })

    compareRetrieval(
      { question_id: questionId, top_k: 25, k_each: 40 },
      controller.signal,
    )
      .then((res) => {
        CACHE.set(questionId, res)
        if (myRun === nonce.current) setState({ compare: res, status: 'done' })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        if (myRun === nonce.current) setState({ compare: null, status: 'error' })
        // Swallow — the trace renders without retrieval detail.
        void err
      })

    return () => controller.abort()
  }, [questionId])

  return state
}
