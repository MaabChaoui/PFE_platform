/**
 * Shared metadata + formatting for the Main pipeline visualizer (S10a).
 *
 * The SSE `step` token is a stable English identifier (route, recursion, …); the
 * `summary` it carries is an Arabic sentence (RTL). We map each token to an
 * English label + phase + icon so the timeline chrome stays LTR while the Arabic
 * summary renders RTL. Unknown steps degrade gracefully via `stepMeta()`.
 *
 * Phases group the steps into the readable arc the brief prescribes:
 *   route → retrieve → verify → KG → recurse → argue → summarize → gate.
 */
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownNarrowWide,
  BadgeCheck,
  CalendarClock,
  Compass,
  Layers,
  Network,
  PenLine,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  Split,
  Workflow,
} from 'lucide-react'

import { humanize } from '@/lib/format'
import type { AnswerOptions, Health } from '@/lib/types'

// ───────────────────────── live health gate ─────────────────────────

/** True only when the backend's real probe reports the live LLM endpoint as
 *  reachable AND usable. As of S15 `health.llm` is a small contract enum
 *  (`"ok" | "unreachable" | "disabled" | "unchecked"`) produced by a real,
 *  cached reachability probe — ONLY `"ok"` un-gates Live. Every other value
 *  (`unreachable` / `disabled` / `unchecked` / missing) → false (replay-only).
 *  Binary, default-closed; must agree with the backend `health_probe` contract. */
export function isLlmReachable(health: Health | null | undefined): boolean {
  return health?.llm === 'ok'
}

// ───────────────────────── run-config → AnswerOptions ─────────────────────────

const ENHANCER_PREFIX = 'enhancers.'

/** Translate the flat run-config `overrides` (keyed by `/pipeline/config` option
 *  keys, including dotted `enhancers.eN`) into the nested `Partial<AnswerOptions>`
 *  the live SSE run expects. null/undefined values are dropped — every field's
 *  "null/default" maps to the backend's locked default anyway, so an empty
 *  overrides map == the locked Phase E config. Nothing is hardcoded. */
export function buildAnswerOptions(
  overrides: Record<string, unknown>,
): Partial<AnswerOptions> {
  const opts: Record<string, unknown> = {}
  const enhancers: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined) continue
    if (key.startsWith(ENHANCER_PREFIX)) {
      enhancers[key.slice(ENHANCER_PREFIX.length)] = value
    } else {
      opts[key] = value
    }
  }
  if (Object.keys(enhancers).length > 0) opts.enhancers = enhancers
  return opts as Partial<AnswerOptions>
}

// ───────────────────────── phases ─────────────────────────

export type PhaseKey =
  | 'route'
  | 'retrieve'
  | 'verify'
  | 'kg'
  | 'recurse'
  | 'argue'
  | 'summarize'
  | 'gate'
  | 'other'

/** Semantic accent per phase. Warm `primary` is reserved for `recurse` (the
 *  marquee behaviour) + the active station; everything else leans on the cool
 *  info / success / neutral families so colour never competes with motion. */
export type Accent = 'info' | 'success' | 'primary' | 'foreground'

export interface PhaseMeta {
  label: string
  accent: Accent
}

export const PHASE_META: Record<PhaseKey, PhaseMeta> = {
  route: { label: 'Route', accent: 'info' },
  retrieve: { label: 'Retrieve', accent: 'foreground' },
  verify: { label: 'Verify', accent: 'success' },
  kg: { label: 'Knowledge graph', accent: 'info' },
  recurse: { label: 'Recurse', accent: 'primary' },
  argue: { label: 'Argue', accent: 'foreground' },
  summarize: { label: 'Synthesize', accent: 'foreground' },
  gate: { label: 'Gate', accent: 'success' },
  other: { label: 'Step', accent: 'foreground' },
}

// ───────────────────────── steps ─────────────────────────

export interface StepMeta {
  label: string
  phase: PhaseKey
  icon: LucideIcon
}

/** Verified trajectory step tokens (S4). Unknown tokens fall through to a
 *  humanised label + `other` phase so the timeline never breaks on drift. */
export const STEP_META: Record<string, StepMeta> = {
  route: { label: 'Document routing', phase: 'route', icon: Compass },
  // Live-only, backend-injected (SFIX-2): the locked replay run never carries it.
  hyde: { label: 'HyDE expansion', phase: 'retrieve', icon: Sparkles },
  candidate_pool: { label: 'Candidate pool', phase: 'retrieve', icon: Layers },
  rank: { label: 'Rank & fuse', phase: 'retrieve', icon: ArrowDownNarrowWide },
  supervisor: { label: 'Supervisor verify', phase: 'verify', icon: ShieldCheck },
  kg_chain: { label: 'KG amendment chain', phase: 'kg', icon: Network },
  extract_date: { label: 'Reference date', phase: 'kg', icon: CalendarClock },
  decompose_sweep: { label: 'Decompose & sweep', phase: 'recurse', icon: Split },
  recursion: { label: 'Recursive retrieval', phase: 'recurse', icon: Repeat },
  adu_extract: { label: 'Argument mining', phase: 'argue', icon: Scale },
  summarize: { label: 'Answer synthesis', phase: 'summarize', icon: PenLine },
  faithfulness_gate: { label: 'Faithfulness gate', phase: 'gate', icon: BadgeCheck },
  handler_summary: { label: 'Handler summary', phase: 'route', icon: Workflow },
}

export function stepMeta(step: string): StepMeta {
  return (
    STEP_META[step] ?? { label: humanize(step), phase: 'other', icon: Workflow }
  )
}

// ───────────────────────── recursion gap decisions ─────────────────────────

/** English gloss for the `gap_decision` token a recursion step carries. The
 *  Arabic `summary` already explains it; this is for the LTR detail view. */
const GAP_DECISION_EN: Record<string, string> = {
  depth_1: 'Initial retrieval',
  strong_skip: 'High confidence — recursion skipped',
  thin_force_yes: 'Thin candidate pool — forced recurse',
  thin_force_no: 'Thin pool — no retrievable gap',
  weak_probe_yes: 'Medium confidence — probe requested recurse',
  weak_probe_no: 'Medium confidence — probe confirmed sufficient',
  covered: 'Coverage complete — stop',
  max_depth: 'Max depth reached',
  thin_force_yes_at_max_depth: 'Thin pool — forced at max depth',
}

export function gapDecisionLabel(token: string | null | undefined): string {
  if (!token) return '—'
  return GAP_DECISION_EN[token] ?? humanize(token)
}

// ───────────────────────── text helpers ─────────────────────────

/** True when a string contains Arabic-script characters → render RTL. */
export function isArabic(value: string): boolean {
  return /[؀-ۿ]/.test(value)
}

/** A `detail` key looks like a 0..1 score we should render as a percentage. */
export function isScoreKey(key: string): boolean {
  return /confidence|score|groundedness|faithfulness/i.test(key)
}

/** A reader-friendly label for a `detail` key (`top_confidence_pre` → "Top
 *  confidence pre"). */
export function detailLabel(key: string): string {
  return humanize(key)
}

// ───────────────────────── accent → class maps ─────────────────────────
// Literal class strings (kept here so Tailwind's content scan keeps them) shared
// by the step card + timeline so phase colour stays consistent everywhere.

export const ACCENT_TEXT: Record<Accent, string> = {
  info: 'text-info',
  success: 'text-success',
  primary: 'text-primary',
  foreground: 'text-foreground',
}

export const ACCENT_DOT: Record<Accent, string> = {
  info: 'bg-info',
  success: 'bg-success',
  primary: 'bg-primary',
  foreground: 'bg-foreground/70',
}

export const ACCENT_RING: Record<Accent, string> = {
  info: 'ring-info/40',
  success: 'ring-success/40',
  primary: 'ring-primary/50',
  foreground: 'ring-foreground/25',
}

export const ACCENT_SOFT_BG: Record<Accent, string> = {
  info: 'bg-info/10',
  success: 'bg-success/10',
  primary: 'bg-primary/10',
  foreground: 'bg-foreground/[0.06]',
}

export const ACCENT_BORDER: Record<Accent, string> = {
  info: 'border-info/30',
  success: 'border-success/30',
  primary: 'border-primary/40',
  foreground: 'border-foreground/15',
}
