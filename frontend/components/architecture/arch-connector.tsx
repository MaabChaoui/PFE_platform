'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { ARCH_EDGES, type ArchEdgeKind } from '@/lib/architecture'

/**
 * The diagram's edge layer — an absolutely-positioned SVG overlay whose paths
 * are derived ENTIRELY from `ARCH_EDGES` against measured node boxes. Three edge
 * classes read distinctly by SHAPE + the cool/warm poles (never gold-vs-orange
 * as a category):
 *   · flow — straight-ish bezier, warm primary, a slow flowing dash (the spine)
 *   · feed — faint cool/blue dashed curve (data layer → pipeline); lifts when its
 *            source data node is selected
 *   · loop — a pronounced warm arc that bows clear of the lanes, so the recursion
 *            and corrective-retry back-edges are plainly VISIBLE
 * A decorative self-loop on `recursion` signals its Phase-D depth-2/3 iteration.
 * Every motion (`arch-dash`) is disabled under `prefers-reduced-motion`.
 */

export interface NodeBox {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

interface RenderEdge {
  id: string
  from: string
  to: string
  kind: ArchEdgeKind
  label?: string
  d: string
  /** mid-point for an optional label chip */
  mid: { x: number; y: number }
}

function edgePath(a: NodeBox, b: NodeBox, kind: ArchEdgeKind) {
  // Loop / back-edge: bow well above both anchors so it never hides behind cards.
  if (kind === 'loop') {
    const sx = a.cx
    const sy = a.y
    const ex = b.cx
    const ey = b.y
    const topY = Math.min(a.y, b.y) - 64
    return {
      d: `M ${sx} ${sy} C ${sx} ${topY}, ${ex} ${topY}, ${ex} ${ey}`,
      mid: { x: (sx + ex) / 2, y: topY + 10 },
    }
  }
  const dx = b.cx - a.cx
  const dy = b.cy - a.cy
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sgn = dx >= 0 ? 1 : -1
    const sx = a.cx + sgn * (a.w / 2)
    const sy = a.cy
    const ex = b.cx - sgn * (b.w / 2)
    const ey = b.cy
    const k = Math.max(22, Math.abs(ex - sx) * 0.4)
    return {
      d: `M ${sx} ${sy} C ${sx + sgn * k} ${sy}, ${ex - sgn * k} ${ey}, ${ex} ${ey}`,
      mid: { x: (sx + ex) / 2, y: (sy + ey) / 2 },
    }
  }
  const sgn = dy >= 0 ? 1 : -1
  const sx = a.cx
  const sy = a.cy + sgn * (a.h / 2)
  const ex = b.cx
  const ey = b.cy - sgn * (b.h / 2)
  const k = Math.max(22, Math.abs(ey - sy) * 0.5)
  return {
    d: `M ${sx} ${sy} C ${sx} ${sy + sgn * k}, ${ex} ${ey - sgn * k}, ${ex} ${ey}`,
    mid: { x: (sx + ex) / 2, y: (sy + ey) / 2 },
  }
}

function selfLoop(a: NodeBox) {
  const x = a.cx
  const y = a.y
  const r = 24
  // a hump rising from the top edge and curling back into the node
  return {
    d: `M ${x - 14} ${y} C ${x - 14 - r} ${y - r * 1.7}, ${x + 14 + r} ${y - r * 1.7}, ${x + 14} ${y}`,
    mid: { x, y: y - r * 1.4 },
  }
}

export function buildEdges(boxes: Record<string, NodeBox>): RenderEdge[] {
  const out: RenderEdge[] = []
  for (const e of ARCH_EDGES) {
    const a = boxes[e.from]
    const b = boxes[e.to]
    if (!a || !b) continue
    const { d, mid } = edgePath(a, b, e.kind ?? 'flow')
    out.push({
      id: `${e.from}__${e.to}`,
      from: e.from,
      to: e.to,
      kind: e.kind ?? 'flow',
      label: e.label,
      d,
      mid,
    })
  }
  // Decorative: recursion's own iterative depth (not an ARCH_EDGES content change).
  const rec = boxes['recursion']
  if (rec) {
    const { d, mid } = selfLoop(rec)
    out.push({
      id: 'recursion__self',
      from: 'recursion',
      to: 'recursion',
      kind: 'loop',
      label: '×2–3',
      d,
      mid,
    })
  }
  return out
}

const STROKE: Record<ArchEdgeKind, string> = {
  flow: 'hsl(var(--primary))',
  feed: 'hsl(var(--info))',
  loop: 'hsl(var(--gold))',
}

export function EdgeLayer({
  boxes,
  size,
  selectedId,
}: {
  boxes: Record<string, NodeBox>
  size: { w: number; h: number }
  selectedId: string | null
}) {
  const edges = React.useMemo(() => buildEdges(boxes), [boxes])
  if (!size.w || !size.h) return null

  return (
    <svg
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      className="pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden
    >
      <defs>
        {(['flow', 'feed', 'loop'] as ArchEdgeKind[]).map((k) => (
          <marker
            key={k}
            id={`arch-arrow-${k}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill={STROKE[k]} />
          </marker>
        ))}
      </defs>

      {edges.map((e) => {
        const touches = selectedId
          ? e.from === selectedId || e.to === selectedId
          : null
        const active = touches === true
        const dimmed = touches === false
        const isFeed = e.kind === 'feed'

        // Opacity: feeds stay faint until their data node is selected; the spine
        // and loops are always present, brightening on selection.
        const opacity = active
          ? 1
          : dimmed
            ? isFeed
              ? 0.06
              : 0.16
            : isFeed
              ? 0.22
              : e.kind === 'loop'
                ? 0.85
                : 0.6
        const width = active
          ? e.kind === 'feed'
            ? 1.6
            : 2.6
          : e.kind === 'flow'
            ? 1.8
            : e.kind === 'loop'
              ? 1.6
              : 1.2
        const dash = e.kind === 'feed' ? '1 7' : e.kind === 'loop' ? '5 6' : '7 8'
        // The spine flows by default; everything flows when it is the active path.
        const animate = e.kind === 'flow' || active

        return (
          <path
            key={e.id}
            d={e.d}
            fill="none"
            stroke={STROKE[e.kind]}
            strokeWidth={width}
            strokeLinecap="round"
            strokeOpacity={opacity}
            strokeDasharray={dash}
            markerEnd={`url(#arch-arrow-${e.kind})`}
            className={cn(animate && 'animate-arch-dash motion-reduce:animate-none')}
            style={{ transition: 'stroke-opacity 350ms cubic-bezier(0.32,0.72,0,1)' }}
          />
        )
      })}
    </svg>
  )
}
