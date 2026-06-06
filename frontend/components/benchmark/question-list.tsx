'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, Workflow } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { Badge } from '@/components/ui/badge'
import { isArabic } from '@/components/pipeline/utils'
import { fmtLatency, fmtScore, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuestionPage, QuestionSummary } from '@/lib/types'
import { OutcomeBadge } from './outcome-badge'
import { computeOutcome } from './utils'

function CorrectnessReadout({ q }: { q: QuestionSummary }) {
  const c = q.correctness
  if (!q.has_prediction) {
    return <span className="text-[11px] text-muted-foreground/60">no run</span>
  }
  if (c.abstention_scored) {
    return (
      <span className="nums text-[11px] text-muted-foreground">
        {q.predicted_abstain ? 'abstained' : 'answered'}
      </span>
    )
  }
  return (
    <div className="text-right">
      <div className="nums font-mono text-[13px] font-semibold tabular-nums text-foreground">
        {fmtScore(c.f1, 2)}
      </div>
      <div className="nums text-[10px] text-muted-foreground/70">
        {c.n_correct}/{c.n_gold} gold · F1
      </div>
    </div>
  )
}

function QuestionRow({ q }: { q: QuestionSummary }) {
  const outcome = computeOutcome(q.correctness, q.predicted_abstain, q.has_prediction)
  const rtl = isArabic(q.question)

  return (
    <Link
      href={`/benchmark/${encodeURIComponent(q.id)}`}
      className="group grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border border-foreground/[0.07] bg-card/40 p-3 transition-all duration-300 ease-spring hover:-translate-y-px hover:border-primary/30 hover:bg-card/70 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-3.5 dark:border-foreground/[0.06]"
    >
      <div className="pt-0.5">
        <OutcomeBadge outcome={outcome} size="icon" />
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="nums font-mono text-[10px] text-muted-foreground/70">
            {q.id}
          </span>
          <Badge variant="muted" className="font-mono text-[9px]">
            {humanize(q.query_type)}
          </Badge>
          <Badge variant="outline" className="border-foreground/15 text-[9px] font-normal">
            {humanize(q.difficulty)}
          </Badge>
          <span className="truncate text-[10px] text-muted-foreground/70">
            {humanize(q.category)}
          </span>
          <span className="rounded bg-foreground/[0.06] px-1 py-px font-mono text-[9px] uppercase text-muted-foreground">
            {q.language}
          </span>
        </div>

        {rtl ? (
          <ArabicText
            lines={2}
            className="text-[14px] leading-relaxed text-foreground/90"
          >
            {q.question}
          </ArabicText>
        ) : (
          <p className="line-clamp-2 text-[14px] leading-relaxed text-foreground/90">
            {q.question}
          </p>
        )}

        {q.has_prediction && (q.dispatched_handler || q.latency_s != null) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/70">
            {q.dispatched_handler ? (
              <span className="inline-flex items-center gap-1">
                <Workflow className="h-3 w-3" />
                {q.dispatched_handler}
              </span>
            ) : null}
            {q.latency_s != null ? (
              <span className="nums inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmtLatency(q.latency_s)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 self-center pl-1">
        <CorrectnessReadout q={q} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-300 ease-spring group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
      </div>
    </Link>
  )
}

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs">
      <span className="nums text-muted-foreground">
        {from}–{to} of <span className="font-semibold text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-3 py-1.5 font-medium transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <span className="nums px-1 font-mono text-muted-foreground">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-3 py-1.5 font-medium transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/** The paginated question list. Pure presentation — the explorer owns fetching,
 *  URL state and the loading/empty/error chrome above it. */
export function QuestionList({
  data,
  onPageChange,
  dimmed,
}: {
  data: QuestionPage
  onPageChange: (p: number) => void
  /** Subtly fade the list while a superseding fetch is in flight. */
  dimmed?: boolean
}) {
  return (
    <div>
      <ol
        className={cn(
          'space-y-2 transition-opacity duration-200',
          dimmed && 'opacity-60',
        )}
      >
        {data.items.map((q) => (
          <li key={q.id}>
            <QuestionRow q={q} />
          </li>
        ))}
      </ol>
      <Pagination
        page={data.page}
        pageSize={data.page_size}
        total={data.total}
        onPageChange={onPageChange}
      />
    </div>
  )
}
