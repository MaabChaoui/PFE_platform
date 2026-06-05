'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { fmtPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StepEvent } from '@/lib/types'

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
          <div className="border-t border-foreground/[0.07] bg-background/30 px-3.5 py-3">
            {hasDetail ? (
              <DetailGrid detail={event.detail} />
            ) : (
              <p className="text-xs text-muted-foreground">
                No structured payload for this step.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
