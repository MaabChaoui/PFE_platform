/**
 * Shared logic for the Benchmark page (S9). The per-question outcome badge, the
 * loose-dict coercers (predicted_citations / trajectory items are `Record<string,
 * unknown>` — see plan §6), and the filter/stats facet config all live here so the
 * list, detail and diff stay in lockstep. Pure functions — no React.
 */
import type { LucideIcon } from 'lucide-react'
import {
  CircleCheckBig,
  CircleDashed,
  CircleSlash,
  Minus,
  ShieldCheck,
} from 'lucide-react'

import type { Correctness } from '@/lib/types'

// ───────────────────────── outcome badge ─────────────────────────

/** The per-question verdict. Citation questions → hit / partial / miss (set
 *  overlap of gold vs predicted article ids); unanswerable questions are scored
 *  on abstention → correct-abstain (abstained) or miss (answered anyway). `none`
 *  = no precomputed prediction joined for this question. */
export type Outcome = 'hit' | 'partial' | 'miss' | 'correct-abstain' | 'none'

/**
 * Drive the badge from `correctness` exactly as the brief prescribes:
 *   - no prediction            → none
 *   - abstention_scored (unanswerable): predicted_abstain ? correct-abstain : miss
 *   - else citation overlap:   f1≈1 (P=R=1) → hit · n_correct>0 → partial · else miss
 * NB a question whose gold is all matched but with *extra* citations has recall=1,
 * precision<1 → f1<1 → "partial". The legend states this so it never confuses.
 */
export function computeOutcome(
  c: Correctness | null | undefined,
  predictedAbstain: boolean | null | undefined,
  hasPrediction: boolean,
): Outcome {
  if (!hasPrediction || !c) return 'none'
  if (c.abstention_scored) return predictedAbstain ? 'correct-abstain' : 'miss'
  if (c.f1 >= 0.999) return 'hit'
  if (c.n_correct > 0) return 'partial'
  return 'miss'
}

export interface OutcomeMeta {
  label: string
  short: string
  icon: LucideIcon
  /** text + ring colour token base, e.g. "success" → text-success / ring-success/40 */
  tone: 'success' | 'warning' | 'destructive' | 'info' | 'muted'
  description: string
}

export const OUTCOME_META: Record<Outcome, OutcomeMeta> = {
  hit: {
    label: 'Hit',
    short: 'Hit',
    icon: CircleCheckBig,
    tone: 'success',
    description: 'Exact citation match — every gold article cited, no extras (P = R = 1).',
  },
  partial: {
    label: 'Partial',
    short: 'Partial',
    icon: CircleDashed,
    tone: 'warning',
    description: 'Some gold articles matched — recall or precision below 1 (e.g. extra citations).',
  },
  miss: {
    label: 'Miss',
    short: 'Miss',
    icon: CircleSlash,
    tone: 'destructive',
    description: 'No gold article matched — or an unanswerable question that failed to abstain.',
  },
  'correct-abstain': {
    label: 'Correct abstain',
    short: 'Abstain',
    icon: ShieldCheck,
    tone: 'info',
    description: 'Unanswerable question — the system correctly abstained.',
  },
  none: {
    label: 'No prediction',
    short: '—',
    icon: Minus,
    tone: 'muted',
    description: 'No precomputed prediction is joined for this question.',
  },
}

/** Tone → Tailwind class bundles (literal strings so the content scan keeps them). */
export const OUTCOME_TONE: Record<
  OutcomeMeta['tone'],
  { text: string; ring: string; soft: string; dot: string }
> = {
  success: {
    text: 'text-success',
    ring: 'ring-success/40',
    soft: 'bg-success/10',
    dot: 'bg-success',
  },
  warning: {
    text: 'text-warning',
    ring: 'ring-warning/40',
    soft: 'bg-warning/10',
    dot: 'bg-warning',
  },
  destructive: {
    text: 'text-destructive',
    ring: 'ring-destructive/40',
    soft: 'bg-destructive/10',
    dot: 'bg-destructive',
  },
  info: {
    text: 'text-info',
    ring: 'ring-info/40',
    soft: 'bg-info/10',
    dot: 'bg-info',
  },
  muted: {
    text: 'text-muted-foreground',
    ring: 'ring-foreground/15',
    soft: 'bg-foreground/[0.06]',
    dot: 'bg-foreground/40',
  },
}

// ───────────────────────── loose-dict coercers ─────────────────────────

export function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

export function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v)
  }
  return null
}

export function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 'True' || v === 'true') return true
  if (v === 'False' || v === 'false') return false
  return null
}

export function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** Article ids are `doc_id#eid` (e.g. "84-11_1984#art_53"). Split for display. */
export function parseArticleId(id: string): { docId: string; ref: string } {
  const hashIdx = id.indexOf('#')
  if (hashIdx === -1) return { docId: id, ref: '' }
  const docId = id.slice(0, hashIdx)
  const eid = id.slice(hashIdx + 1)
  // eid is "art_53" / "art_53_bis" — surface the human ref ("53 bis").
  const ref = eid.replace(/^art[_-]?/i, '').replace(/[_-]+/g, ' ').trim()
  return { docId, ref }
}

// ───────────────────────── facets (filters + stats) ─────────────────────────

export interface Facet {
  /** Stats key + list query param (matches both). */
  key: 'query_type' | 'difficulty' | 'category' | 'answerable' | 'language' | 'split'
  label: string
  /** Whether the underlying value is a boolean (answerable). */
  boolean?: boolean
  /** Optional clarifying note shown under the control. */
  note?: string
}

/** The six facets the backend exposes on /benchmark/stats — also the filterable
 *  list params. `answerable` is a boolean facet, labelled so it is never conflated
 *  with the `unanswerable` abstention positive set (plan §6). */
export const FACETS: Facet[] = [
  { key: 'query_type', label: 'Query type' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'category', label: 'Category' },
  {
    key: 'answerable',
    label: 'Answerable',
    boolean: true,
    note: 'Answerability facet — distinct from the unanswerable abstention set.',
  },
  { key: 'language', label: 'Language' },
  { key: 'split', label: 'Split' },
]

/** Pretty-print the `answerable` boolean-facet option. Deliberately avoids the
 *  word "unanswerable" for the false set (67) so it is never conflated with the
 *  `query_type==='unanswerable'` abstention positive set (40). */
export function boolOptionLabel(value: string): string {
  return value === 'true' ? 'Answerable' : 'Not answerable'
}
