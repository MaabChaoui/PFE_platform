'use client'

import * as React from 'react'

import type { Stats } from '@/lib/types'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FACETS, boolOptionLabel, type Facet } from './utils'

const EASE = 'ease-spring'

interface Row {
  key: string
  label: string
  count: number
  /** Is this option the currently-applied filter for its facet? */
  active: boolean
}

function FacetPanel({
  label,
  rows,
  onPick,
  note,
}: {
  label: string
  rows: Row[]
  onPick?: (key: string) => void
  note?: string
}) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </h3>
        <span className="nums font-mono text-[10px] text-muted-foreground/60">
          {rows.length}
        </span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => {
          const pct = mounted ? Math.max(3, (r.count / max) * 100) : 0
          const rowClass = cn(
            'group grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors',
            onPick &&
              'hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            r.active && 'bg-primary/[0.07]',
          )
          const inner = (
            <>
                <div className="min-w-0">
                  <div
                    className={cn(
                      'truncate text-[12px]',
                      r.active ? 'font-medium text-foreground' : 'text-foreground/80',
                    )}
                  >
                    {r.label}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-inset ring-foreground/[0.04]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-700 will-change-[width] motion-reduce:transition-none',
                        EASE,
                        r.active
                          ? 'bg-gradient-to-r from-primary to-gold'
                          : 'bg-gradient-to-r from-primary/70 to-primary/35 group-hover:from-primary group-hover:to-primary/50',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="nums shrink-0 self-start pt-px font-mono text-[12px] font-semibold tabular-nums text-foreground/90">
                  {r.count}
                </span>
            </>
          )
          return (
            <li key={r.key}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(r.key)}
                  aria-pressed={r.active}
                  className={rowClass}
                >
                  {inner}
                </button>
              ) : (
                <div className={rowClass}>{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
      {note ? (
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground/70">{note}</p>
      ) : null}
    </div>
  )
}

/**
 * Compact distribution panel for the whole benchmark — one bespoke horizontal-bar
 * group per facet (query_type / difficulty / category / answerable / language /
 * split), straight from /benchmark/stats. Matches the Results page's bespoke CSS
 * bars (no recharts) for visual consistency. Bars are clickable when `onPick` is
 * supplied → they double as quick filters; the currently-applied option is lit.
 */
export function BenchStats({
  stats,
  applied,
  onPick,
}: {
  stats: Stats
  applied?: Partial<Record<Facet['key'], string>>
  onPick?: (facet: string, key: string) => void
}) {
  const total = Object.values(stats.query_type ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="nums font-display text-3xl tracking-tight text-foreground">
          {total}
        </span>
        <span className="text-sm text-muted-foreground">
          questions across {FACETS.length} facets — AlgerianLegalBench v3.0
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {FACETS.map((facet) => {
          const map = (stats[facet.key] ?? {}) as Record<string, number>
          const rows: Row[] = Object.entries(map)
            .map(([key, count]) => ({
              key,
              count,
              active: applied?.[facet.key] === key,
              label: facet.boolean ? boolOptionLabel(key) : humanize(key),
            }))
            .sort((a, b) => b.count - a.count)
          if (rows.length === 0) return null
          return (
            <FacetPanel
              key={facet.key}
              label={facet.label}
              rows={rows}
              note={facet.note}
              onPick={onPick ? (key) => onPick(facet.key, key) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
