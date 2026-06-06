'use client'

/**
 * S11 — the Retrieval Lab's parameterized retrieval hook.
 *
 * Distinct from S10c's `use-retrieval-compare.ts` (one-shot, question_id-only,
 * module-cached — the Main page depends on it; do NOT fold this into it). This
 * one re-runs on EVERY control change for interactive exploration:
 *
 *   · Controls → a `CompareRequest` (`toRequest`), enforcing the backend's
 *     EXACTLY-ONE-of `query` | `question_id` rule (seed mode sends only
 *     question_id; query mode sends only a non-empty query) so we never 422.
 *   · The request is serialized and DEBOUNCED (~400ms) into `activeKey`, so a
 *     slider drag or a burst of keystrokes fires a single fetch once it settles.
 *   · `useQuery` (same idiom as `benchmark-picker.tsx`) gives us AbortController
 *     cancellation (`signal`), `placeholderData: keepPrevious` — the previous
 *     channels stay on screen while the next run loads, so the Hybrid list
 *     visibly REORDERS rather than blanking — `status`, and `error`. `retry`
 *     is off so a 503 (e.g. cross-encoder weights not cached) doesn't silently
 *     re-fire three ~14s calls.
 *   · `runNow()` flushes the debounce / re-fires for an explicit "Run" button.
 *
 * Fully offline: `/api/retrieval/compare` runs over the built BM25 + dense
 * indices with NO LLM. The first dense/hybrid call lazy-loads the e5 encoder
 * (~7–14s) — the page renders a warming state off `status==='loading' && !compare`.
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { compareRetrieval } from './api'
import type { CompareRequest, CompareResponse } from './types'

export type LabStatus = 'idle' | 'loading' | 'done' | 'error'

export type InputMode = 'query' | 'seed'

/** Flat, serializable control state owned by the page. */
export interface LabControls {
  mode: InputMode
  query: string
  questionId: string | null
  retrievers: string[]
  kEach: number
  topK: number
  rrfWeights: { bm25: number; dense: number }
  rerankPoolSize: number
}

export const DEFAULT_CONTROLS: LabControls = {
  mode: 'query',
  query: '',
  questionId: null,
  // Backend default set — Hybrid is the live retrieve, Hybrid+Rerank the baseline.
  retrievers: ['bm25', 'dense', 'hybrid', 'hybrid_rerank'],
  kEach: 30,
  topK: 10,
  rrfWeights: { bm25: 1, dense: 1 },
  rerankPoolSize: 50,
}

/** Build the request, or `null` when the controls don't form a valid call. */
export function toRequest(c: LabControls): CompareRequest | null {
  if (c.retrievers.length === 0) return null
  const base = {
    retrievers: c.retrievers,
    k_each: c.kEach,
    top_k: c.topK,
    rrf_weights: c.rrfWeights,
    rerank_pool_size: c.rerankPoolSize,
  }
  if (c.mode === 'seed') {
    // EXACTLY one of query|question_id — seed mode sends ONLY question_id.
    if (!c.questionId) return null
    return { question_id: c.questionId, ...base }
  }
  const q = c.query.trim()
  if (!q) return null
  return { query: q, ...base }
}

export interface RetrievalLabState {
  compare: CompareResponse | null
  status: LabStatus
  error: unknown
  /** False when controls don't form a valid request (disable Run, render prompt). */
  isValid: boolean
  /** True while showing the previous run's channels during a re-run. */
  isStale: boolean
  /** Imperative trigger for an explicit "Run" / retry-after-error button. */
  runNow: () => void
}

export function useRetrievalLab(
  controls: LabControls,
  debounceMs = 400,
): RetrievalLabState {
  // `requestKey` is a primitive string, so the debounce effect only re-runs when
  // the effective request actually changes — not on every render.
  const request = toRequest(controls)
  const requestKey = request ? JSON.stringify(request) : null

  const [activeKey, setActiveKey] = React.useState<string | null>(requestKey)

  React.useEffect(() => {
    const t = setTimeout(() => setActiveKey(requestKey), debounceMs)
    return () => clearTimeout(t)
  }, [requestKey, debounceMs])

  const query = useQuery<CompareResponse>({
    queryKey: ['retrieval-lab', activeKey],
    // queryFn only runs when enabled (activeKey != null), so the assertion is safe.
    queryFn: ({ signal }) =>
      compareRetrieval(JSON.parse(activeKey as string) as CompareRequest, signal),
    enabled: activeKey != null,
    placeholderData: (prev) => prev, // keep prior channels visible while re-running
    retry: false,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })

  const runNow = React.useCallback(() => {
    if (requestKey == null) return
    if (requestKey === activeKey) {
      void query.refetch()
    } else {
      setActiveKey(requestKey) // flush a pending debounce immediately
    }
  }, [requestKey, activeKey, query])

  // No active key yet. If the controls ARE valid we're inside the debounce window
  // before the first fetch → report 'loading' so the status pill matches the
  // page's warming panel; only a genuinely-invalid request is 'idle'. Either way
  // surface no stale channels.
  if (activeKey == null) {
    return {
      compare: null,
      status: requestKey != null ? 'loading' : 'idle',
      error: null,
      isValid: requestKey != null,
      isStale: false,
      runNow,
    }
  }

  const compare = query.data ?? null
  const status: LabStatus = query.isError
    ? 'error'
    : query.isFetching
      ? 'loading'
      : 'done'

  return {
    compare,
    status,
    error: query.error,
    isValid: requestKey != null,
    isStale: query.isPlaceholderData,
    runNow,
  }
}
