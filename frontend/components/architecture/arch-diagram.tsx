'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { getArchNode, type ArchNode } from '@/lib/architecture'
import { ArchNodeCard } from './arch-node-card'
import { EdgeLayer, type NodeBox } from './arch-connector'

/* Lanes — a serpentine flow that uses the full content width on ≥lg:
 *   data rail (feeders)
 *   lane 1  entry → classifier → router → dispatcher → handlers      (L→R)
 *   lane 2  retrieval → … → summarizer                              (R→L, reversed)
 *   lane 3  citation → jurisdiction → NLI gate → output             (L→R)
 *           corrective_retry hangs below the NLI gate (the "on fail" branch)
 * Every connector is drawn by EdgeLayer from ARCH_EDGES against measured boxes. */
const DATA = ['corpus', 'kg', 'indices', 'benchmark']
const LANE1 = ['entry', 'classifier', 'router', 'dispatcher', 'handlers']
const LANE2 = ['retrieval', 'verifier', 'kg_chain', 'recursion', 'adu', 'summarizer']
const LANE3: { id: string; place: string }[] = [
  { id: 'gate_citation', place: 'lg:col-start-1 lg:row-start-1' },
  { id: 'gate_jurisdiction', place: 'lg:col-start-2 lg:row-start-1' },
  { id: 'gate_faithfulness', place: 'lg:col-start-3 lg:row-start-1' },
  { id: 'corrective_retry', place: 'lg:col-start-3 lg:row-start-2' },
  { id: 'output', place: 'lg:col-start-4 lg:row-start-1' },
]

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

function LaneTag({
  index,
  label,
  tone,
}: {
  index: string
  label: string
  tone: string
}) {
  return (
    <span
      className={cn(
        'absolute -top-2.5 left-5 z-10 inline-flex items-center gap-2 rounded-full px-3 py-1',
        'bg-background ring-1 ring-foreground/10',
        'text-[10px] font-medium uppercase tracking-[0.2em]',
        tone,
      )}
    >
      <span className="font-mono text-foreground/40">{index}</span>
      {label}
    </span>
  )
}

/** Double-bezel lane enclosure: hairline outer shell → recessed inner core. */
function Lane({
  index,
  label,
  tone,
  children,
  className,
}: {
  index: string
  label: string
  tone: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="rounded-[1.75rem] bg-foreground/[0.02] p-2 ring-1 ring-foreground/[0.05]">
      <div
        className={cn(
          'relative rounded-[1.4rem] bg-card/30 px-5 pb-5 pt-9',
          'shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]',
          className,
        )}
      >
        <LaneTag index={index} label={label} tone={tone} />
        {children}
      </div>
    </div>
  )
}

export function ArchDiagram({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const node = (id: string) => getArchNode(id) as ArchNode
  const contentRef = React.useRef<HTMLDivElement>(null)
  const nodeRefs = React.useRef<Map<string, HTMLElement>>(new Map())
  const [boxes, setBoxes] = React.useState<Record<string, NodeBox>>({})
  const [size, setSize] = React.useState({ w: 0, h: 0 })

  const setNodeRef = React.useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) nodeRefs.current.set(id, el)
      else nodeRefs.current.delete(id)
    },
    [],
  )

  const measure = React.useCallback(() => {
    const content = contentRef.current
    if (!content) return
    const cr = content.getBoundingClientRect()
    const next: Record<string, NodeBox> = {}
    nodeRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect()
      const x = r.left - cr.left
      const y = r.top - cr.top
      next[id] = { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2 }
    })
    setBoxes(next)
    setSize({ w: content.clientWidth, h: content.clientHeight })
  }, [])

  React.useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => measure())
    if (contentRef.current) ro.observe(contentRef.current)
    nodeRefs.current.forEach((el) => ro.observe(el))
    window.addEventListener('resize', measure)
    const t = window.setTimeout(measure, 80)
    // Re-measure once webfonts settle (Instrument Serif / Inter shift metrics).
    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(measure)
    }
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.clearTimeout(t)
    }
  }, [measure])

  const Card = (id: string) => (
    <div ref={(el) => setNodeRef(id, el)} className="min-w-0 flex-1">
      <ArchNodeCard
        node={node(id)}
        selected={selectedId === id}
        onSelect={onSelect}
      />
    </div>
  )

  return (
    <div ref={contentRef} className="relative">
      <div className="relative z-0 space-y-14 px-1 pt-6">
        {/* DATA RAIL */}
        <Lane index="00" label="Data layer · feeders" tone="text-info">
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:gap-5">
            {DATA.map((id) => Card(id))}
          </div>
        </Lane>

        {/* LANE 1 — INGRESS */}
        <Lane index="01" label="Ingress · classify & route" tone="text-foreground/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
            {LANE1.map((id) => Card(id))}
          </div>
        </Lane>

        {/* LANE 2 — HANDLER PIPELINE (reversed on lg for serpentine flow) */}
        <Lane
          index="02"
          label="Handler pipeline · per typed handler"
          tone="text-foreground/70"
        >
          <div className="flex flex-col gap-4 lg:flex-row-reverse lg:gap-5">
            {LANE2.map((id) => Card(id))}
          </div>
        </Lane>

        {/* LANE 3 — TRIPLE FAITHFULNESS GATE (in series) + retry branch */}
        <Lane index="03" label="Triple faithfulness gate" tone="text-success">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-12">
            {LANE3.map(({ id, place }) => (
              <div
                key={id}
                ref={(el) => setNodeRef(id, el)}
                className={cn('min-w-0', place)}
              >
                <ArchNodeCard
                  node={node(id)}
                  selected={selectedId === id}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        </Lane>
      </div>

      {/* Edge overlay — above the cards, click-through. */}
      <div
        className={cn('pointer-events-none absolute inset-0 z-10 transition-opacity duration-700', EASE)}
        style={{ opacity: size.w ? 1 : 0 }}
      >
        <EdgeLayer boxes={boxes} size={size} selectedId={selectedId} />
      </div>
    </div>
  )
}
