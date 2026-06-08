'use client'

import * as React from 'react'
import { Info } from 'lucide-react'

import type { KGMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  buildNodeColorRoles,
  COLOR_CLASS,
  EDGE_LEGEND_CATEGORIES,
  humanize,
} from './palette'

/**
 * Legend for the node-type colours + edge-type styles in play, with live counts
 * and the perf/cap note. Node-type rows are derived from kgMeta (most frequent
 * first) and coloured by the exact same role map the canvas uses.
 */
export function Legend({
  meta,
  visibleTypes,
  className,
}: {
  meta: KGMeta
  /** Types currently on the canvas — those get a subtle highlight. */
  visibleTypes?: Set<string>
  className?: string
}) {
  const roles = React.useMemo(() => buildNodeColorRoles(meta), [meta])
  const topTypes = React.useMemo(
    () => [...meta.node_types].sort((a, b) => b.count - a.count).slice(0, 10),
    [meta],
  )

  return (
    <div className={cn('space-y-4 text-xs', className)}>
      <section>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Node types
        </h4>
        <ul className="space-y-1.5">
          {topTypes.map((t) => {
            const on = visibleTypes ? visibleTypes.has(t.type) : true
            return (
              <li
                key={t.type}
                className={cn(
                  'flex items-center gap-2 transition-opacity',
                  on ? 'opacity-100' : 'opacity-40',
                )}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-foreground/15',
                    COLOR_CLASS[roles[t.type] ?? 'mutedForeground'],
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-foreground/85">
                  {humanize(t.type)}
                </span>
                <span className="nums shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {t.count.toLocaleString()}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Relationships
        </h4>
        <ul className="space-y-1.5">
          {EDGE_LEGEND_CATEGORIES.map((cat) => (
            <li key={cat.label} className="flex items-center gap-2">
              <EdgeSwatch
                role={cat.style.role}
                lineStyle={cat.style.lineStyle}
                width={cat.style.width}
              />
              <span className="min-w-0 flex-1 truncate text-foreground/85">
                {cat.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-start gap-1.5 rounded-md border border-foreground/[0.07] bg-foreground/[0.02] px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <Info className="mt-px h-3 w-3 shrink-0 text-info" />
        <span>
          Bounded view — at most a few hundred nodes are loaded at once. A dashed
          gold ring marks a node with more neighbours than shown; double-click (or
          use the inspector) to expand. The full graph holds{' '}
          {meta.totals.nodes.toLocaleString()} nodes /{' '}
          {meta.totals.edges.toLocaleString()} edges and is never loaded whole.
        </span>
      </p>
    </div>
  )
}

// Literal border-colour classes (Tailwind JIT needs them spelled out, not
// derived at runtime). Only the roles used by the edge legend are needed.
const EDGE_BORDER_CLASS: Record<string, string> = {
  primary: 'border-primary',
  info: 'border-info',
  success: 'border-success',
  mutedForeground: 'border-muted-foreground',
  border: 'border-border',
}

function EdgeSwatch({
  role,
  lineStyle,
  width,
}: {
  role: keyof typeof COLOR_CLASS
  lineStyle: 'solid' | 'dashed' | 'dotted'
  width: number
}) {
  // Render the line via a bottom border so dashed/dotted styles read accurately.
  return (
    <span className="grid h-2.5 w-6 shrink-0 place-items-center">
      <span
        className={cn('w-full', EDGE_BORDER_CLASS[role] ?? 'border-muted-foreground')}
        style={{
          borderBottomStyle: lineStyle,
          borderBottomWidth: Math.max(1, Math.round(width)),
        }}
      />
    </span>
  )
}
