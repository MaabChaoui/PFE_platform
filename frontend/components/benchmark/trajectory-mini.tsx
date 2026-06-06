'use client'

import * as React from 'react'

import { ArabicText } from '@/components/shared/arabic-text'
import {
  ACCENT_SOFT_BG,
  ACCENT_TEXT,
  PHASE_META,
  gapDecisionLabel,
  isArabic,
  stepMeta,
} from '@/components/pipeline/utils'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { asArr, asBool, asNum, asStr } from './utils'

/** Keys handled specially or not worth a chip. */
const SKIP = new Set(['step', 'depth', 'sub_question', 'gap_decision'])

/** One compact, factual chip per remaining detail key (numbers / booleans /
 *  array-lengths). No hardcoding — it reflects whatever keys the step carries. */
function GlossChips({ item }: { item: Record<string, unknown> }) {
  const chips: React.ReactNode[] = []

  const gap = asStr(item.gap_decision)
  if (gap) {
    chips.push(
      <span
        key="gap"
        className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
      >
        {gapDecisionLabel(gap)}
      </span>,
    )
  }

  for (const [key, value] of Object.entries(item)) {
    if (SKIP.has(key)) continue
    const b = asBool(value)
    if (b !== null) {
      chips.push(
        <span
          key={key}
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            b ? 'bg-success/10 text-success' : 'bg-foreground/[0.06] text-muted-foreground',
          )}
        >
          {humanize(key)} {b ? '✓' : '✗'}
        </span>,
      )
      continue
    }
    if (Array.isArray(value)) {
      const n = asArr(value).length
      if (n > 0) {
        chips.push(
          <span
            key={key}
            className="nums rounded-full bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {humanize(key)} {n}
          </span>,
        )
      }
      continue
    }
    const num = asNum(value)
    if (num !== null && typeof value !== 'boolean') {
      const shown = Number.isInteger(num) ? String(num) : num.toFixed(2)
      chips.push(
        <span
          key={key}
          className="nums rounded-full bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {humanize(key)} {shown}
        </span>,
      )
    }
  }

  if (chips.length === 0) return null
  return <div className="mt-1 flex flex-wrap items-center gap-1">{chips}</div>
}

/**
 * A lightweight, static list of the precomputed prediction.trajectory steps —
 * step · depth · a factual gloss of the step's payload. Deliberately NOT the
 * animated S10 timeline: this is a compact at-a-glance record on the benchmark
 * detail. Step labels come from the shared `stepMeta` so the two never drift; the
 * raw trajectory carries no Arabic summary (only step-specific keys), so the
 * recursion `sub_question` is surfaced RTL and the rest as compact chips.
 */
export function TrajectoryMini({
  trajectory,
}: {
  trajectory: Array<Record<string, unknown>>
}) {
  if (!trajectory || trajectory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No trajectory recorded for this prediction.
      </p>
    )
  }

  return (
    <ol className="space-y-1.5">
      {trajectory.map((item, i) => {
        const step = asStr(item.step) ?? 'step'
        const depth = asNum(item.depth) ?? 0
        const meta = stepMeta(step)
        const accent = PHASE_META[meta.phase].accent
        const Icon = meta.icon
        const subQ = asStr(item.sub_question)
        return (
          <li
            key={`${step}-${i}`}
            className="flex items-start gap-2.5 rounded-lg border border-foreground/[0.06] bg-card/40 px-2.5 py-2"
            style={depth > 0 ? { marginLeft: `${Math.min(depth, 3) * 14}px` } : undefined}
          >
            <span
              className={cn(
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full',
                ACCENT_SOFT_BG[accent],
                ACCENT_TEXT[accent],
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">
                  {meta.label}
                </span>
                {depth > 0 ? (
                  <span className="nums rounded bg-primary/10 px-1 py-px font-mono text-[9px] font-semibold text-primary">
                    D{depth}
                  </span>
                ) : null}
              </div>
              {subQ ? (
                <ArabicText className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  ↳ {subQ}
                </ArabicText>
              ) : null}
              <GlossChips item={item} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
