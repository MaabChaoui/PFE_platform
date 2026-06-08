'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  GitBranch,
  Loader2,
  MousePointerClick,
  ScrollText,
  X,
} from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { kgNode } from '@/lib/api'
import type { KGMeta } from '@/lib/types'
import { cn } from '@/lib/utils'
import { buildNodeColorRoles, COLOR_CLASS, humanize, isArabic, shortNodeId } from './palette'

export interface ExpandMeta {
  truncated: boolean
  total: number
  added: number
}

/**
 * Right-hand node inspector. Owns its own `kgNode` query (TanStack supplies the
 * AbortSignal so a superseded selection is cancelled). Shows type/label/id,
 * degree, props, text (RTL for Arabic), the `/corpus` deep-link back when the
 * node maps to an article, and the explicit "Expand neighbours" action.
 */
export function NodeInspector({
  nodeId,
  meta,
  expandMeta,
  onExpand,
  onClose,
  className,
}: {
  nodeId: string | null
  meta: KGMeta
  expandMeta?: ExpandMeta
  onExpand: (id: string) => void
  onClose?: () => void
  className?: string
}) {
  const roles = React.useMemo(() => buildNodeColorRoles(meta), [meta])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kg-node', nodeId],
    queryFn: ({ signal }) => kgNode(nodeId as string, signal),
    enabled: !!nodeId,
  })

  if (!nodeId) {
    return (
      <Shell className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <MousePointerClick className="h-6 w-6 text-muted-foreground/70" />
          <p className="text-sm font-medium text-foreground">No node selected</p>
          <p className="max-w-[22ch] text-xs text-muted-foreground">
            Click a node to inspect its type, properties, and citations. Double-click
            to expand its neighbours.
          </p>
        </div>
      </Shell>
    )
  }

  if (isLoading) {
    return (
      <Shell className={className} onClose={onClose}>
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Shell>
    )
  }

  if (isError || !data) {
    return (
      <Shell className={className} onClose={onClose}>
        <div className="p-4">
          <ErrorState error={error} onRetry={() => refetch()} title="Could not load node" />
        </div>
      </Shell>
    )
  }

  const label = data.label?.trim() || shortNodeId(data.id)
  const labelArabic = isArabic(label)
  const total = data.degree.in_count + data.degree.out_count
  const roleKey = data.type ? roles[data.type] ?? 'mutedForeground' : 'mutedForeground'
  const propEntries = Object.entries(data.props ?? {}).filter(
    ([k]) => k !== 'rdf_type' && k !== 'provisionText',
  )

  return (
    <Shell className={className} onClose={onClose}>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          {/* type + title */}
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-foreground/15',
                  COLOR_CLASS[roleKey],
                )}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {humanize(data.type)}
              </span>
            </div>
            {labelArabic ? (
              <ArabicText className="text-lg leading-snug text-foreground" lines={3}>
                {label}
              </ArabicText>
            ) : (
              <h3 className="font-display text-xl leading-tight text-foreground">{label}</h3>
            )}
            <p
              className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground"
              title={data.id}
            >
              {data.id}
            </p>
          </header>

          {/* degree */}
          <div className="grid grid-cols-3 gap-2">
            <DegreeStat label="In" value={data.degree.in_count} />
            <DegreeStat label="Out" value={data.degree.out_count} />
            <DegreeStat label="Total" value={total} accent />
          </div>

          {/* corpus deep-link */}
          {data.corpus_link ? (
            <Link
              href={`/corpus?doc=${encodeURIComponent(
                data.corpus_link.doc_id,
              )}&article=${encodeURIComponent(data.corpus_link.article_ref)}`}
              className="group flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2.5 text-sm transition-colors duration-200 ease-spring hover:border-primary/55 hover:bg-primary/[0.1]"
            >
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Read in corpus
                </span>
                <span className="nums block truncate font-medium text-foreground">
                  art. {data.corpus_link.article_ref} · {data.corpus_link.doc_id}
                </span>
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary transition-transform duration-200 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          ) : null}

          {/* text */}
          {data.text ? (
            <section className="space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <ScrollText className="h-3 w-3" /> Text
              </h4>
              <div className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] p-3">
                <ArabicText className="text-[13px] text-foreground/90">{data.text}</ArabicText>
              </div>
            </section>
          ) : null}

          {/* props */}
          {propEntries.length ? (
            <section className="space-y-1.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Properties
              </h4>
              <dl className="overflow-hidden rounded-lg border border-foreground/[0.08]">
                {propEntries.map(([k, v], i) => (
                  <div
                    key={k}
                    className={cn(
                      'grid grid-cols-[40%_60%] gap-2 px-3 py-1.5 text-xs',
                      i % 2 ? 'bg-foreground/[0.015]' : 'bg-transparent',
                    )}
                  >
                    <dt className="truncate text-muted-foreground" title={k}>
                      {humanize(k)}
                    </dt>
                    <PropValue value={v} />
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* expand */}
          <div className="space-y-2 border-t border-foreground/[0.07] pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full ease-spring active:scale-[0.99]"
              onClick={() => onExpand(data.id)}
            >
              <GitBranch className="h-4 w-4" />
              Expand neighbours
            </Button>
            {expandMeta?.truncated ? (
              <p className="text-[11px] leading-relaxed text-warning">
                Showing a bounded slice — {expandMeta.total.toLocaleString()} neighbours exist in
                total. Raise “Max nodes” to load more.
              </p>
            ) : expandMeta ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {expandMeta.added > 0
                  ? `Added ${expandMeta.added} element(s).`
                  : 'All neighbours are already on the canvas.'}
              </p>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    </Shell>
  )
}

function Shell({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode
  className?: string
  onClose?: () => void
}) {
  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card/60 p-1.5 shadow-card',
        className,
      )}
    >
      <div className="relative h-full overflow-hidden rounded-[calc(1rem-0.375rem)] border border-foreground/[0.05] bg-background/40 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
        {onClose ? (
          <button
            type="button"
            aria-label="Close inspector"
            onClick={onClose}
            className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  )
}

function DegreeStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1.5 text-center',
        accent
          ? 'border-primary/25 bg-primary/[0.06]'
          : 'border-foreground/[0.08] bg-foreground/[0.02]',
      )}
    >
      <div className={cn('nums text-base font-semibold tabular-nums', accent && 'text-primary')}>
        {value.toLocaleString()}
      </div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  )
}

function PropValue({ value }: { value: unknown }) {
  if (typeof value === 'boolean') {
    return (
      <dd>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            value ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
          )}
        >
          {value ? 'true' : 'false'}
        </span>
      </dd>
    )
  }
  if (typeof value === 'number') {
    return <dd className="nums tabular-nums text-foreground/90">{value}</dd>
  }
  const str = String(value ?? '')
  if (isArabic(str)) {
    return (
      <dd>
        <ArabicText className="text-[12px] text-foreground/90" lines={3}>
          {str}
        </ArabicText>
      </dd>
    )
  }
  return (
    <dd className="break-words text-foreground/90" title={str}>
      {str}
    </dd>
  )
}
