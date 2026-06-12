'use client'

import * as React from 'react'

import type { AnswerResponse, CompareResponse, StepEvent } from '@/lib/types'

import type { CompareStatus } from './retrieval-channels'
import { stepMeta } from './utils'

/**
 * Enrichment that the trajectory stations read to show REAL content. The locked
 * run never persisted per-step articles/triplets, so each station pulls from the
 * two places the real content actually lives:
 *   · retrieve → `compare` (POST /api/retrieval/compare, seeded by question)
 *   · verify / argue → `answer.citations[]` (verifier flag + Toulmin ADU)
 *
 * It is prop-drilled deep (trace → timeline → row → card), so it travels as
 * context. The default is inert (null answer/compare), so a `StepCard` rendered
 * without a provider degrades to its raw `detail` view — it never crashes.
 */
export interface TraceEnrichment {
  answer: AnswerResponse | null
  compare: CompareResponse | null
  compareStatus: CompareStatus
  /** Index of the single step that hosts the full retrieval narrative, or null. */
  retrievalHostIndex: number | null
}

const INERT: TraceEnrichment = {
  answer: null,
  compare: null,
  compareStatus: 'idle',
  retrievalHostIndex: null,
}

const TraceEnrichmentContext = React.createContext<TraceEnrichment>(INERT)

export function useTraceEnrichment(): TraceEnrichment {
  return React.useContext(TraceEnrichmentContext)
}

/**
 * Pick the ONE step that should host the full BM25 → Dense → Hybrid → baseline
 * retrieval story. Prefer the `rank` (fuse) step; fall back to `candidate_pool`;
 * then any retrieve-phase step. One coherent card beats stitching the story
 * across two stations — and most trajectories only emit `rank` anyway.
 */
export function retrievalHostIndex(steps: StepEvent[]): number | null {
  // Return the hosting step's OWN `.index` (not its array position) so the card
  // match stays correct even if SSE indices ever skip.
  const find = (pred: (s: StepEvent) => boolean) => steps.find(pred)?.index ?? null
  return (
    find((s) => s.step === 'rank') ??
    find((s) => s.step === 'candidate_pool') ??
    // `hyde` is retrieve-phase but tells its own story (the hypothetical
    // answer) — never let it host the BM25/Dense/Hybrid channels card.
    find((s) => s.step !== 'hyde' && stepMeta(s.step).phase === 'retrieve')
  )
}

export function TraceEnrichmentProvider({
  value,
  children,
}: {
  value: TraceEnrichment
  children: React.ReactNode
}) {
  return (
    <TraceEnrichmentContext.Provider value={value}>
      {children}
    </TraceEnrichmentContext.Provider>
  )
}
