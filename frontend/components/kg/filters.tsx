'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, Loader2, Network, Search, Target, X } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useDebounced } from '@/components/corpus/corpus-search'
import { kgSearch } from '@/lib/api'
import type { KGMeta, KGSearchHit } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  buildNodeColorRoles,
  COLOR_CLASS,
  edgeStyleFor,
  humanize,
  isArabic,
  nodeDisplayLabel,
  shortNodeId,
  type NodeColorMap,
} from './palette'

export type GraphMode = 'overview' | 'drill'

export interface FiltersValue {
  mode: GraphMode
  docId: string | null
  nodeTypes: string[]
  edgeTypes: string[]
  depth: number
  limit: number
}

const ALL_LAWS = '__all__'

export function FiltersPanel({
  meta,
  value,
  seedLabel,
  onChange,
  onSearchPick,
  className,
}: {
  meta: KGMeta
  value: FiltersValue
  seedLabel?: string | null
  onChange: (patch: Partial<FiltersValue>) => void
  onSearchPick: (hit: KGSearchHit) => void
  className?: string
}) {
  const roles = React.useMemo(() => buildNodeColorRoles(meta), [meta])
  const sortedDocs = React.useMemo(
    () => [...meta.documents].sort((a, b) => b.nodes - a.nodes),
    [meta],
  )

  return (
    <div className={cn('space-y-5', className)}>
          {/* mode */}
          <Section label="Mode" icon={<Target className="h-3 w-3" />}>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] p-1">
              <ModeBtn
                active={value.mode === 'overview'}
                onClick={() => onChange({ mode: 'overview' })}
              >
                Law overview
              </ModeBtn>
              <ModeBtn
                active={value.mode === 'drill'}
                onClick={() => onChange({ mode: 'drill' })}
              >
                Drill-down
              </ModeBtn>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {value.mode === 'overview'
                ? 'Scope to one law and see its structure + amendment / reference links.'
                : 'Seed on a node (search or click) and expand its neighbourhood.'}
            </p>
          </Section>

          {/* search */}
          <Section label="Find an entity" icon={<Search className="h-3 w-3" />}>
            <EntitySearch onPick={onSearchPick} roles={roles} />
            {value.mode === 'drill' && seedLabel ? (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/[0.06] px-2.5 py-1.5 text-xs">
                <Network className="h-3 w-3 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-foreground/90" title={seedLabel}>
                  Seed: {seedLabel}
                </span>
              </div>
            ) : null}
          </Section>

          {/* law scope */}
          <Section label={value.mode === 'overview' ? 'Law' : 'Scope to law'} icon={<Layers className="h-3 w-3" />}>
            <Select
              value={value.docId ?? ALL_LAWS}
              onValueChange={(v) => onChange({ docId: v === ALL_LAWS ? null : v })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select a law" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {value.mode === 'drill' ? (
                  <SelectItem value={ALL_LAWS} className="text-xs">
                    All laws
                  </SelectItem>
                ) : null}
                {sortedDocs.map((d) => (
                  <SelectItem key={d.doc_id} value={d.doc_id} className="text-xs">
                    <span className="nums">{d.doc_id}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {d.nodes.toLocaleString()} nodes
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          {/* depth + limit */}
          <Section label="Reach">
            <SliderRow
              label="Depth"
              value={value.depth}
              min={1}
              max={2}
              step={1}
              suffix={value.depth === 1 ? 'hop' : 'hops'}
              onChange={(v) => onChange({ depth: v })}
            />
            <SliderRow
              label="Max nodes"
              value={value.limit}
              min={50}
              max={600}
              step={50}
              onChange={(v) => onChange({ limit: v })}
            />
          </Section>

          {/* node + edge type filters */}
          <Accordion type="multiple" defaultValue={['nodes']} className="border-t border-foreground/[0.07] pt-1">
            <AccordionItem value="nodes" className="border-foreground/[0.07]">
              <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:no-underline">
                Node types ({value.nodeTypes.length}/{meta.node_types.length})
              </AccordionTrigger>
              <AccordionContent>
                <ToggleList
                  options={meta.node_types.map((t) => ({
                    key: t.type,
                    label: humanize(t.type),
                    count: t.count,
                    colorClass: COLOR_CLASS[roles[t.type] ?? 'mutedForeground'],
                  }))}
                  selected={value.nodeTypes}
                  onChange={(next) => onChange({ nodeTypes: next })}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="edges" className="border-b-0 border-foreground/[0.07]">
              <AccordionTrigger className="py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:no-underline">
                Relationship types ({value.edgeTypes.length}/{meta.edge_types.length})
              </AccordionTrigger>
              <AccordionContent>
                <ToggleList
                  options={meta.edge_types.map((e) => ({
                    key: e.predicate,
                    label: humanize(e.predicate),
                    count: e.count,
                    lineStyle: edgeStyleFor(e.predicate).lineStyle,
                  }))}
                  selected={value.edgeTypes}
                  onChange={(next) => onChange({ edgeTypes: next })}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
    </div>
  )
}

// ───────────────────────── entity search ─────────────────────────

function EntitySearch({
  onPick,
  roles,
}: {
  onPick: (hit: KGSearchHit) => void
  roles: NodeColorMap
}) {
  const [q, setQ] = React.useState('')
  const debounced = useDebounced(q.trim(), 300)
  const enabled = debounced.length >= 2
  const { data, isFetching } = useQuery({
    queryKey: ['kg-search', debounced],
    queryFn: ({ signal }) => kgSearch({ q: debounced, limit: 12 }, signal),
    enabled,
  })

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search nodes (Arabic or id)…"
          aria-label="Search the knowledge graph"
          className="h-9 rounded-lg border-foreground/15 bg-background/60 pl-8 pr-8 text-xs"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
          ) : q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      {enabled && data ? (
        data.length ? (
          <ul className="max-h-56 space-y-1 overflow-auto rounded-lg border border-foreground/[0.08] bg-background/40 p-1 scrollbar-thin">
            {data.map((hit) => {
              const label = nodeDisplayLabel(hit)
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(hit)
                      setQ('')
                    }}
                    className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-spring hover:bg-foreground/[0.05]"
                  >
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full ring-1 ring-foreground/15',
                        COLOR_CLASS[hit.type ? roles[hit.type] ?? 'mutedForeground' : 'mutedForeground'],
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        {isArabic(label) ? (
                          <ArabicText className="truncate text-xs text-foreground" lines={1}>
                            {label}
                          </ArabicText>
                        ) : (
                          <span className="truncate text-xs text-foreground">
                            {shortNodeId(hit.id)}
                          </span>
                        )}
                        <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                          {humanize(hit.type)}
                        </span>
                      </span>
                      {hit.text_snippet ? (
                        <ArabicText className="mt-0.5 truncate text-[11px] text-muted-foreground" lines={1}>
                          {hit.text_snippet}
                        </ArabicText>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">No matches.</p>
        )
      ) : null}
    </div>
  )
}

// ───────────────────────── primitives ─────────────────────────

function Section({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </h4>
      {children}
    </section>
  )
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-spring active:scale-[0.98]',
        active
          ? 'bg-primary/15 text-primary shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]'
          : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-foreground/80">{label}</span>
        <span className="nums text-xs font-medium tabular-nums text-foreground">
          {value}
          {suffix ? <span className="ml-1 text-muted-foreground">{suffix}</span> : null}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      />
    </div>
  )
}

interface ToggleOption {
  key: string
  label: string
  count: number
  colorClass?: string
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

function ToggleList({
  options,
  selected,
  onChange,
}: {
  options: ToggleOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const set = React.useMemo(() => new Set(selected), [selected])
  const toggle = (key: string) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(options.filter((o) => next.has(o.key)).map((o) => o.key))
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <QuickBtn onClick={() => onChange(options.map((o) => o.key))}>All</QuickBtn>
        <QuickBtn onClick={() => onChange([])}>None</QuickBtn>
      </div>
      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-auto pr-1 scrollbar-thin">
        {options.map((o) => {
          const on = set.has(o.key)
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              aria-pressed={on}
              title={`${o.label} · ${o.count.toLocaleString()}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-all duration-150 ease-spring active:scale-[0.97]',
                on
                  ? 'border-primary/40 bg-primary/[0.08] text-foreground'
                  : 'border-foreground/[0.08] bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              {o.colorClass ? (
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full ring-1 ring-foreground/15',
                    o.colorClass,
                    !on && 'opacity-50',
                  )}
                />
              ) : o.lineStyle ? (
                <span
                  className="h-0 w-3 shrink-0 border-muted-foreground"
                  style={{ borderBottomStyle: o.lineStyle, borderBottomWidth: 1.5 }}
                />
              ) : null}
              <span className="max-w-[10rem] truncate">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function QuickBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-foreground/[0.1] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      {children}
    </button>
  )
}
