'use client'

import * as React from 'react'
import {
  Library,
  Network,
  Database,
  FlaskConical,
  MessageSquareText,
  Tags,
  Signpost,
  Split,
  Boxes,
  Search,
  ScanSearch,
  GitBranch,
  Repeat,
  Workflow,
  Sparkles,
  ShieldCheck,
  Globe2,
  ScrollText,
  RotateCcw,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { GROUP_META, type ArchNode } from '@/lib/architecture'

/** Icon per node — kept here (presentation) so the content module stays pure. */
const NODE_ICON: Record<string, LucideIcon> = {
  corpus: Library,
  kg: Network,
  indices: Database,
  benchmark: FlaskConical,
  entry: MessageSquareText,
  classifier: Tags,
  router: Signpost,
  dispatcher: Split,
  handlers: Boxes,
  retrieval: Search,
  verifier: ScanSearch,
  kg_chain: GitBranch,
  recursion: Repeat,
  adu: Workflow,
  summarizer: Sparkles,
  gate_citation: ShieldCheck,
  gate_jurisdiction: Globe2,
  gate_faithfulness: ScrollText,
  corrective_retry: RotateCcw,
  output: FileCheck2,
}

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

/**
 * A single pipeline node, rendered as a machined "double-bezel" tile (outer
 * hairline shell → inner core with an inset top-highlight). The group tone
 * (cool/blue, green, or neutral) carries the icon at rest; the WARM orange→gold
 * accent is held back for the selected state only. Hover lifts the whole tile on
 * a spring curve and nudges the icon (magnetic micro-interaction).
 */
export function ArchNodeCard({
  node,
  selected,
  onSelect,
  className,
}: {
  node: ArchNode
  selected: boolean
  onSelect: (id: string) => void
  className?: string
}) {
  const Icon = NODE_ICON[node.id] ?? Boxes
  const group = GROUP_META[node.group]

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      data-node={node.id}
      className={cn(
        'group relative block w-full rounded-2xl p-[3px] text-left outline-none',
        'ring-1 transition-all duration-500 will-change-transform',
        EASE,
        'hover:-translate-y-1 active:scale-[0.985]',
        'focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'bg-gradient-to-b from-primary/35 to-primary/5 ring-primary/45 shadow-[0_18px_44px_-18px_hsl(var(--primary)/0.55)]'
          : 'bg-gradient-to-b from-foreground/[0.09] to-transparent ring-foreground/[0.06] hover:from-primary/25',
        className,
      )}
    >
      <span
        className={cn(
          'relative block overflow-hidden rounded-[13px] p-3.5',
          'bg-card/90 backdrop-blur-sm',
          'shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.07)]',
          selected && 'bg-primary/[0.07]',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
              'bg-background/70 ring-1 ring-foreground/[0.07]',
              'shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.08)]',
              'transition-transform duration-500 will-change-transform',
              EASE,
              'group-hover:-translate-y-px group-hover:translate-x-px',
              selected ? 'text-primary' : group.tone,
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
              {node.title}
            </span>
            <span className="mt-1 block truncate text-[11px] leading-snug text-muted-foreground">
              {node.short}
            </span>
          </span>
        </div>

        {node.metric ? (
          <span className="mt-3 flex items-center justify-between border-t border-foreground/[0.06] pt-2">
            <span className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground">
              {node.metric.label}
            </span>
            <span className="nums font-mono text-[11px] font-semibold text-gold">
              {node.metric.value}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  )
}
