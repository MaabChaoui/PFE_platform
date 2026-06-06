'use client'

import * as React from 'react'
import { ArrowDown, BadgeCheck, ChevronDown, XCircle } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { fmtPct, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnswerResponse, Citation, StepEvent } from '@/lib/types'

import { RetrievalChannels, type CompareStatus } from './retrieval-channels'
import { ToulminBlock, hasToulmin } from './toulmin'
import { useTraceEnrichment } from './trace-context'
import {
  ACCENT_SOFT_BG,
  ACCENT_TEXT,
  PHASE_META,
  detailLabel,
  gapDecisionLabel,
  isArabic,
  isScoreKey,
  stepMeta,
} from './utils'

// ───────────────────────── detail value rendering ─────────────────────────

function BoolChip({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px]',
        value
          ? 'bg-success/15 text-success'
          : 'bg-foreground/[0.06] text-muted-foreground',
      )}
    >
      {value ? '✓' : '✗'} {value ? 'true' : 'false'}
    </span>
  )
}

function ScalarValue({ keyName, value }: { keyName: string; value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>

  if (typeof value === 'boolean') return <BoolChip value={value} />

  if (typeof value === 'number') {
    if (isScoreKey(keyName) && value >= 0 && value <= 1)
      return <span className="nums font-mono text-foreground">{fmtPct(value)}</span>
    return <span className="nums font-mono text-foreground">{value}</span>
  }

  const text = String(value)
  if (keyName === 'gap_decision') {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-foreground">{gapDecisionLabel(text)}</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {text}
        </span>
      </span>
    )
  }
  if (isArabic(text)) {
    return (
      <ArabicText
        as="span"
        className="block text-[13px] leading-relaxed text-foreground/90"
      >
        {text}
      </ArabicText>
    )
  }
  return <span className="break-words font-mono text-foreground/90">{text}</span>
}

function DetailValue({ keyName, value }: { keyName: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-muted-foreground">—</span>
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <span
              key={i}
              className={cn(
                'rounded-md bg-foreground/[0.05] px-1.5 py-0.5 text-[11px] text-foreground/85',
                isArabic(String(v)) ? 'font-arabic' : 'font-mono',
              )}
              dir={isArabic(String(v)) ? 'rtl' : undefined}
            >
              {String(v)}
            </span>
          ))}
        </span>
      )
    }
    return (
      <span className="font-mono text-[11px] text-muted-foreground">
        {value.length} items
      </span>
    )
  }
  if (value && typeof value === 'object') {
    return (
      <span className="font-mono text-[11px] text-muted-foreground">
        {Object.keys(value as object).length} fields
      </span>
    )
  }
  return <ScalarValue keyName={keyName} value={value} />
}

function DetailGrid({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail)
  if (entries.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        No structured payload for this step.
      </p>
    )
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {entries.map(([key, value]) => {
        const wide = isArabic(String(value)) && typeof value === 'string'
        return (
          <div
            key={key}
            className={cn('min-w-0', wide && 'sm:col-span-2')}
          >
            <dt className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {detailLabel(key)}
            </dt>
            <dd className="text-sm">
              <DetailValue keyName={key} value={value} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

// ───────────────────────── real-content enrichment ─────────────────────────
// The locked run never persisted per-step articles / triplets, so each station
// surfaces the REAL content from where it actually lives: retrieved articles from
// `/api/retrieval/compare` (via context) and ADU triplets + verifier flags from
// the AnswerResponse `citations[]`. These layer ON TOP of the raw `detail` grid.

function Caption({ en, ar }: { en: string; ar?: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {en}
      {ar ? (
        <span className="font-arabic text-[11px] normal-case tracking-normal text-muted-foreground/70">
          {ar}
        </span>
      ) : null}
    </div>
  )
}

function RefChip({ value }: { value: string }) {
  return (
    <span className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-foreground/85">
      {value}
    </span>
  )
}

function DocTitle({ title }: { title: string }) {
  if (isArabic(title)) {
    return (
      <ArabicText as="span" lines={1} className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
        {title}
      </ArabicText>
    )
  }
  return (
    <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-muted-foreground">
      {title}
    </span>
  )
}

/** route → the routing decision the dispatcher actually made. */
function RouteEnrichment({ answer }: { answer: AnswerResponse }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {[
        { label: 'Handler', value: humanize(answer.handler_used) },
        { label: 'Predicted type', value: humanize(answer.query_type_predicted) },
      ].map((f) => (
        <div key={f.label}>
          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {f.label}
          </div>
          <span className="inline-flex rounded-md bg-foreground/[0.05] px-2 py-0.5 text-[12px] font-medium text-foreground/90">
            {f.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** verify → the citations that survived the supervisor verifier. */
function VerifyEnrichment({ citations }: { citations: Citation[] }) {
  return (
    <div className="space-y-2">
      <Caption en="Surviving citations · verifier" ar="المُتحقَّق منها" />
      <ul className="space-y-1.5">
        {citations.map((c, i) => (
          <li
            key={`${c.doc_id}-${c.article_ref}-${i}`}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2',
              c.verifier_relevant
                ? 'border-success/25 bg-success/[0.05]'
                : 'border-foreground/[0.06] bg-foreground/[0.015]',
            )}
          >
            <RefChip value={c.article_ref} />
            <DocTitle title={c.doc_title} />
            {c.verifier_relevant === true ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-success">
                <BadgeCheck className="h-3.5 w-3.5" /> relevant
              </span>
            ) : c.verifier_relevant === false ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" /> rejected
              </span>
            ) : null}
            <span
              className="shrink-0 nums font-mono text-[11px] tabular-nums text-foreground/75"
              title="Verifier confidence (the relevance confidence the verifier emitted)"
            >
              {fmtPct(c.confidence, 0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-relaxed text-muted-foreground/70">
        Score = the verifier&apos;s emitted relevance confidence.
      </p>
    </div>
  )
}

/** argue → the actual Toulmin ADU triplets mined for each cited article. */
function ArgueEnrichment({ citations }: { citations: Citation[] }) {
  return (
    <div className="space-y-2.5">
      <Caption en="Argument mining · ADU triplets" ar="تنقيب الحجج" />
      {citations.map((c, i) => (
        <div key={`${c.doc_id}-${c.article_ref}-${i}`} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <RefChip value={c.article_ref} />
            <DocTitle title={c.doc_title} />
          </div>
          <ToulminBlock
            arg={c.argumentation as Record<string, unknown> | null | undefined}
            title="Mined argument (ADU)"
          />
        </div>
      ))}
    </div>
  )
}

/** summarize → an anchor down to the grounded answer it produced. */
function SummarizeEnrichment({ answer }: { answer: AnswerResponse }) {
  const n = answer.citations.length
  const scrollToAnswer = () => {
    if (typeof document === 'undefined') return
    document
      .getElementById('grounded-answer')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-muted-foreground">
        {answer.abstained
          ? 'Declined to answer — the abstention safeguard fired.'
          : `Synthesised the grounded answer from ${n} verified citation${n === 1 ? '' : 's'}.`}
      </p>
      <button
        type="button"
        onClick={scrollToAnswer}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/12 bg-foreground/[0.03] px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground"
      >
        Jump to answer
        <ArrowDown className="h-3 w-3" />
      </button>
    </div>
  )
}

type EnrichKind = 'retrieve' | 'verify' | 'argue' | 'route' | 'summarize' | null

/** A one-line content preview shown on the COLLAPSED card so the station says
 *  what it holds before the user expands it (answers "the contents aren't saying
 *  anything" up front). */
function enrichmentTeaser(
  kind: EnrichKind,
  ctx: {
    compareStatus: CompareStatus
    hasCompare: boolean
    verifiedCount: number
    citedCount: number
    arguedCount: number
    handler: string
  },
): string | null {
  switch (kind) {
    case 'retrieve':
      if (ctx.compareStatus === 'loading') return 'retrieving…'
      return ctx.hasCompare ? 'BM25 · Dense · Hybrid RRF' : null
    case 'verify':
      return `${ctx.verifiedCount} verified · ${ctx.citedCount} cited`
    case 'argue':
      return ctx.arguedCount > 0 ? `Toulmin ADU ×${ctx.arguedCount}` : null
    case 'route':
      return ctx.handler || null
    default:
      return null
  }
}

// ───────────────────────── step card ─────────────────────────

export interface StepCardProps {
  event: StepEvent
  open: boolean
  onToggle: () => void
  /** Dim future (not-yet-reached) steps. */
  dim?: boolean
  className?: string
}

/**
 * One trajectory step: an LTR header (icon · label · depth badge), the Arabic
 * `summary` sentence (RTL), and — when expanded — the raw `detail` payload laid
 * out as a clean definition grid. Unknown steps degrade via `stepMeta`.
 */
export function StepCard({
  event,
  open,
  onToggle,
  dim,
  className,
}: StepCardProps) {
  const meta = stepMeta(event.step)
  const phase = PHASE_META[meta.phase]
  const Icon = meta.icon
  const showSummary = !!event.summary && event.summary !== event.step
  const summaryRtl = showSummary && isArabic(event.summary)
  const hasDetail = Object.keys(event.detail ?? {}).length > 0

  // Real-content enrichment for this station (layered on top of `detail`).
  const enr = useTraceEnrichment()
  const answer = enr.answer
  const citations = answer?.citations ?? []
  const arguedCitations = citations.filter((c) =>
    hasToulmin(c.argumentation as Record<string, unknown> | null | undefined),
  )
  const isRetrievalHost =
    enr.retrievalHostIndex !== null && enr.retrievalHostIndex === event.index

  let enrichKind: EnrichKind = null
  if (isRetrievalHost) enrichKind = 'retrieve'
  else if (meta.phase === 'verify' && citations.length > 0) enrichKind = 'verify'
  else if (meta.phase === 'argue' && arguedCitations.length > 0) enrichKind = 'argue'
  else if (meta.phase === 'route' && answer) enrichKind = 'route'
  else if (meta.phase === 'summarize' && answer) enrichKind = 'summarize'

  const teaser = enrichmentTeaser(enrichKind, {
    compareStatus: enr.compareStatus,
    hasCompare: !!enr.compare,
    verifiedCount: citations.filter((c) => c.verifier_relevant).length,
    citedCount: citations.length,
    arguedCount: arguedCitations.length,
    handler: answer ? humanize(answer.handler_used) : '',
  })
  const hasBody = hasDetail || enrichKind !== null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card/60 transition-all duration-500 ease-spring',
        open
          ? 'border-foreground/15 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]'
          : 'border-foreground/[0.08] hover:border-foreground/15',
        dim && 'opacity-55',
        className,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg',
            ACCENT_SOFT_BG[phase.accent],
            ACCENT_TEXT[phase.accent],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {meta.label}
            </span>
            {event.depth > 0 ? (
              <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                D{event.depth}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-[0.16em]',
              ACCENT_TEXT[phase.accent],
              'opacity-80',
            )}
          >
            {phase.label}
          </span>
        </span>

        {!open && teaser ? (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            {teaser}
          </span>
        ) : null}

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-spring',
            open && 'rotate-180',
          )}
        />
      </button>

      {showSummary ? (
        <div className="px-3.5 pb-2.5 -mt-0.5">
          {summaryRtl ? (
            <ArabicText className="text-[13px] leading-relaxed text-foreground/80">
              {event.summary}
            </ArabicText>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {event.summary}
            </p>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          'grid transition-all duration-500 ease-spring motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-foreground/[0.07] bg-background/30 px-3.5 py-3">
            {hasDetail ? <DetailGrid detail={event.detail} /> : null}

            {enrichKind === 'retrieve' ? (
              <RetrievalChannels compare={enr.compare} status={enr.compareStatus} />
            ) : enrichKind === 'verify' ? (
              <VerifyEnrichment citations={citations} />
            ) : enrichKind === 'argue' ? (
              <ArgueEnrichment citations={arguedCitations} />
            ) : enrichKind === 'route' ? (
              <RouteEnrichment answer={answer!} />
            ) : enrichKind === 'summarize' ? (
              <SummarizeEnrichment answer={answer!} />
            ) : null}

            {!hasBody ? (
              <p className="text-xs text-muted-foreground">
                No structured payload for this step.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
