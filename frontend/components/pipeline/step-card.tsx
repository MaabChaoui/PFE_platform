'use client'

import * as React from 'react'
import Link from 'next/link'
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

// ─────────────── KG retrieval enrichment (SFIX-3, live runs only) ───────────────
// The backend folds the rich TF/CD KG telemetry into the `kg_chain` /
// `candidate_pool` step detail. These structured keys get dedicated sections
// (the generic grid would render them as "N items") — absent in replay.

const KG_STRUCT_KEYS = new Set([
  'amendment_chains',
  'kg_first',
  'kg_hit_articles',
  'kg_target_date',
])

interface AmendmentChainRow {
  doc_id?: string
  article_ref?: string
  picked?: string | null
  source?: string | null
  uri?: string | null
  chain_len?: number
  chain_dates?: string[]
}

interface KgFirstDepth {
  depth?: number
  hybrid_count?: number
  kg_first_count?: number
  kg_first_hits?: [string, string][]
  merged_pool_size?: number
  kg_first_in_top_slice?: number
  kg_first_uri_resolved?: number
  kg_first_in_verified?: number
}

interface KgHitArticle {
  doc_id?: string
  article_ref?: string
  phrase_matches?: number
  span?: string
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/** Compact deep-linking article chip → `/corpus?doc=&article=`. */
function KgChipLink({ docId, articleRef }: { docId: string; articleRef: string }) {
  const lawNum = docId.split('_')[0] || docId
  return (
    <Link
      href={`/corpus?doc=${encodeURIComponent(docId)}&article=${encodeURIComponent(articleRef)}`}
      title={`${docId} — article ${articleRef}`}
      className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-foreground/85 transition-colors hover:bg-foreground/[0.12] hover:text-primary"
    >
      art. {articleRef} · {lawNum}
    </Link>
  )
}

/** One version node on a chain timeline. */
function ChainVersionNode({
  date,
  picked,
  afterTarget,
}: {
  date: string
  picked: boolean
  afterTarget: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors',
        picked
          ? 'border-primary/50 bg-primary/10 font-semibold text-primary'
          : afterTarget
            ? 'border-foreground/[0.06] text-muted-foreground/40'
            : 'border-foreground/12 text-muted-foreground',
      )}
      title={
        picked
          ? 'Version the chain picked — in force at the reference date'
          : afterTarget
            ? 'Enacted after the reference date — skipped'
            : 'Earlier version'
      }
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          picked ? 'bg-primary' : afterTarget ? 'bg-foreground/15' : 'bg-foreground/35',
        )}
      />
      <span className="nums whitespace-nowrap">{date || '—'}</span>
      {picked ? (
        <span className="text-[8px] font-semibold uppercase tracking-wide">in force</span>
      ) : null}
    </span>
  )
}

/** The walked version timeline: enactment → amendments, picked node lit. */
function ChainTimeline({
  dates,
  picked,
  targetDate,
}: {
  dates: string[]
  picked: string | null
  targetDate: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-1.5 pt-1.5">
      {dates.map((d, i) => (
        <React.Fragment key={`${d}-${i}`}>
          {i > 0 ? (
            <span className="mx-1 h-px w-3.5 shrink-0 bg-foreground/20" aria-hidden />
          ) : null}
          <ChainVersionNode
            date={d}
            picked={!!picked && d === picked}
            afterTarget={!!targetDate && !!d && d > targetDate}
          />
        </React.Fragment>
      ))}
    </div>
  )
}

/** One stage box of the KG-first funnel. */
function FunnelStage({
  value,
  label,
  accent,
}: {
  value: number
  label: string
  accent?: 'info' | 'success'
}) {
  return (
    <span
      className={cn(
        'flex min-w-[3.25rem] flex-col items-center rounded-lg border px-2 py-1',
        accent === 'info'
          ? 'border-info/25 bg-info/[0.07]'
          : accent === 'success'
            ? 'border-success/25 bg-success/[0.07]'
            : 'border-foreground/[0.08] bg-foreground/[0.02]',
      )}
    >
      <span
        className={cn(
          'nums font-mono text-[13px] font-semibold leading-tight',
          accent === 'info'
            ? 'text-info'
            : accent === 'success'
              ? 'text-success'
              : 'text-foreground/85',
        )}
      >
        {value}
      </span>
      <span className="text-[8px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
    </span>
  )
}

/** kg_chain (TF) → the amendment chains the KG walked (version timelines,
 *  picked node lit against the reference date) + the per-depth KG-first
 *  funnel as stage boxes. */
function KgChainEnrichment({
  chains,
  funnel,
  targetDate,
}: {
  chains: AmendmentChainRow[]
  funnel: KgFirstDepth[]
  targetDate: string | null
}) {
  return (
    <div className="space-y-3">
      {chains.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Caption en="Amendment chains · KG" ar="سلاسل التعديل" />
            {targetDate ? (
              <span
                className="nums rounded-full border border-primary/30 bg-primary/[0.07] px-2 py-0.5 font-mono text-[10px] text-primary"
                title="Reference date resolved from the question — versions are picked against it"
              >
                as of {targetDate}
              </span>
            ) : null}
          </div>
          <ul className="space-y-1.5">
            {chains.map((c, i) =>
              c.doc_id && c.article_ref ? (
                <li
                  key={`${c.doc_id}-${c.article_ref}-${i}`}
                  className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.015] px-2.5 py-2"
                  title={c.uri || undefined}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <KgChipLink docId={c.doc_id} articleRef={c.article_ref} />
                    {(c.chain_len ?? 0) > 0 ? (
                      <span className="nums font-mono text-[10px] text-muted-foreground">
                        {c.chain_len} version{(c.chain_len ?? 0) === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide',
                        c.source === 'kg'
                          ? 'bg-info/15 text-info'
                          : 'bg-foreground/[0.06] text-muted-foreground',
                      )}
                    >
                      {c.source === 'kg'
                        ? 'KG chain'
                        : c.source === 'kg_no_match'
                          ? 'no version at date'
                          : 'fallback'}
                    </span>
                  </div>
                  {(c.chain_dates ?? []).length > 0 ? (
                    <ChainTimeline
                      dates={c.chain_dates ?? []}
                      picked={c.picked ?? null}
                      targetDate={targetDate}
                    />
                  ) : c.source !== 'kg' ? (
                    <p className="pt-1 text-[10px] leading-snug text-muted-foreground/70">
                      No version chain in the KG — answered from the retrieved article text.
                    </p>
                  ) : null}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ) : null}

      {funnel.length > 0 ? (
        <div className="space-y-1.5">
          <Caption en="KG-first funnel · per depth" />
          {funnel.map((d, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  D{d.depth ?? i + 1}
                </span>
                <FunnelStage value={d.hybrid_count ?? 0} label="hybrid" />
                <span className="text-muted-foreground/50" aria-hidden>+</span>
                <FunnelStage value={d.kg_first_count ?? 0} label="KG-first" accent="info" />
                <span className="text-muted-foreground/50" aria-hidden>→</span>
                <FunnelStage value={d.merged_pool_size ?? 0} label="merged" />
                <span className="text-muted-foreground/50" aria-hidden>→</span>
                <FunnelStage value={d.kg_first_in_top_slice ?? 0} label="top-slice" />
                <span className="text-muted-foreground/50" aria-hidden>→</span>
                <FunnelStage value={d.kg_first_uri_resolved ?? 0} label="URI ok" />
                <span className="text-muted-foreground/50" aria-hidden>→</span>
                <FunnelStage
                  value={d.kg_first_in_verified ?? 0}
                  label="verified"
                  accent="success"
                />
              </div>
              {(d.kg_first_hits ?? []).length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {(d.kg_first_hits ?? []).map(([docId, ref], j) =>
                    docId && ref ? (
                      <KgChipLink key={`${docId}-${ref}-${j}`} docId={docId} articleRef={ref} />
                    ) : null,
                  )}
                </span>
              ) : null}
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            How many KG-first hits survived merging, ranking, URI resolution, and
            verification at each retrieval depth.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** candidate_pool (CD) → the articles the KG phrase search actually matched. */
function KgConceptHitsEnrichment({ hits }: { hits: KgHitArticle[] }) {
  return (
    <div className="space-y-2">
      <Caption en="KG concept hits" ar="مطابقات المفاهيم" />
      <ul className="space-y-1.5">
        {hits.map((h, i) =>
          h.doc_id && h.article_ref ? (
            <li
              key={`${h.doc_id}-${h.article_ref}-${i}`}
              className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.015] px-2.5 py-2"
            >
              <div className="flex items-center gap-2">
                <KgChipLink docId={h.doc_id} articleRef={h.article_ref} />
                <span className="nums font-mono text-[10px] text-muted-foreground">
                  {h.phrase_matches ?? 0} phrase{(h.phrase_matches ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              {h.span ? (
                <ArabicText className="mt-1.5 text-[12px] leading-relaxed text-foreground/80">
                  {h.span}
                </ArabicText>
              ) : null}
            </li>
          ) : null,
        )}
      </ul>
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

  // KG retrieval enrichment (SFIX-3): structured keys get dedicated sections
  // below; keep them out of the generic grid. Absent in replay → no-op.
  const detail = event.detail ?? {}
  const kgChains =
    event.step === 'kg_chain' ? asRows<AmendmentChainRow>(detail.amendment_chains) : []
  const kgFunnel = event.step === 'kg_chain' ? asRows<KgFirstDepth>(detail.kg_first) : []
  const kgHits =
    event.step === 'candidate_pool' ? asRows<KgHitArticle>(detail.kg_hit_articles) : []
  const hasKg = kgChains.length > 0 || kgFunnel.length > 0 || kgHits.length > 0
  const gridDetail = hasKg
    ? Object.fromEntries(Object.entries(detail).filter(([k]) => !KG_STRUCT_KEYS.has(k)))
    : detail
  const hasDetail = Object.keys(gridDetail).length > 0

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
  const hasBody = hasDetail || enrichKind !== null || hasKg

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
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-spring motion-reduce:transition-none',
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
            {hasDetail ? <DetailGrid detail={gridDetail} /> : null}

            {/* KG retrieval enrichment (SFIX-3, live runs only) */}
            {kgChains.length > 0 || kgFunnel.length > 0 ? (
              <KgChainEnrichment
                chains={kgChains}
                funnel={kgFunnel}
                targetDate={typeof detail.kg_target_date === 'string' ? detail.kg_target_date : null}
              />
            ) : null}
            {kgHits.length > 0 ? <KgConceptHitsEnrichment hits={kgHits} /> : null}
            {hasKg ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                Live runs only — the locked replay run recorded counts, not items.
              </p>
            ) : null}

            {/* hyde (live-only, backend-injected) — honest framing. The Arabic
                hypothetical answer itself renders RTL via the detail grid. */}
            {event.step === 'hyde' ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                {event.detail?.degraded === true
                  ? 'HyDE call failed — dense ran on the bare query. '
                  : 'Model-generated hypothetical answer used as a dense-retrieval probe — BM25 still sees the bare query. '}
                Not shown in replay (the locked run didn&apos;t record it).
              </p>
            ) : null}

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
