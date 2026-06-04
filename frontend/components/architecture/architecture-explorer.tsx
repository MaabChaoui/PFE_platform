'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { getMetrics } from '@/lib/api'
import {
  ARCH_MODELS,
  HEADLINE_METRICS,
  formatMetric,
  getArchNode,
} from '@/lib/architecture'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ArchDiagram } from './arch-diagram'
import { ArchDetailPanel } from './arch-detail-panel'

const TONE_CLASS: Record<'gold' | 'success' | 'foreground', string> = {
  gold: 'text-gold',
  success: 'text-success',
  foreground: 'text-foreground',
}

/* Diagram legend — phase poles (colour = identity) + edge kinds (shape = role). */
const PHASES: { label: string; dot: string }[] = [
  { label: 'Data / I/O', dot: 'bg-info' },
  { label: 'Processing', dot: 'bg-foreground/40' },
  { label: 'Gates', dot: 'bg-success' },
]

function EdgeSample({
  variant,
}: {
  variant: 'flow' | 'feed' | 'loop'
}) {
  const stroke =
    variant === 'flow'
      ? 'hsl(var(--primary))'
      : variant === 'feed'
        ? 'hsl(var(--info))'
        : 'hsl(var(--gold))'
  const dash = variant === 'feed' ? '1 4' : variant === 'loop' ? '4 4' : '5 5'
  return (
    <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden className="overflow-visible">
      {variant === 'loop' ? (
        <path
          d="M 3 9 C 3 0, 27 0, 27 9"
          fill="none"
          stroke={stroke}
          strokeWidth="1.6"
          strokeDasharray={dash}
          strokeLinecap="round"
        />
      ) : (
        <line
          x1="2"
          y1="6"
          x2="24"
          y2="6"
          stroke={stroke}
          strokeWidth={variant === 'flow' ? 2 : 1.4}
          strokeDasharray={dash}
          strokeLinecap="round"
          opacity={variant === 'feed' ? 0.55 : 1}
        />
      )}
      <path d="M 24 3 L 29 6 L 24 9 z" fill={stroke} opacity={variant === 'feed' ? 0.55 : 1} />
    </svg>
  )
}

export function ArchitectureExplorer() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('node')
  const selectedNode = getArchNode(selectedId)

  // Optional, non-blocking enrichment from the locked metrics endpoint.
  const [overall, setOverall] = React.useState<Record<string, unknown> | null>(
    null,
  )
  React.useEffect(() => {
    const ctrl = new AbortController()
    getMetrics(ctrl.signal)
      .then((m) => {
        const o = (m as { overall?: Record<string, unknown> }).overall
        if (o && typeof o === 'object') setOverall(o)
      })
      .catch(() => {
        /* offline-first: static values already shown */
      })
    return () => ctrl.abort()
  }, [])

  const select = React.useCallback(
    (id: string) => {
      router.replace(`${pathname}?node=${encodeURIComponent(id)}`, {
        scroll: false,
      })
    },
    [router, pathname],
  )
  const close = React.useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return (
    <div className="space-y-12">
      {/* Headline metric strip — machined tiles */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Locked evaluation
          {overall ? (
            <span className="inline-flex items-center gap-1.5 text-success">
              <span className="h-1 w-1 animate-pulse-ring rounded-full bg-success" />
              synced
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {HEADLINE_METRICS.map((m) => {
            const raw = overall?.[m.overallKey]
            const live =
              typeof raw === 'number' && Number.isFinite(raw as number)
            const value = live
              ? formatMetric(raw as number, m.kind, m.digits)
              : m.value
            return (
              <div
                key={m.id}
                className="rounded-2xl bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.05]"
              >
                <div className="rounded-[0.85rem] bg-card/70 px-3.5 py-3 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {m.label}
                  </div>
                  <div
                    className={cn(
                      'nums mt-1.5 font-mono text-xl font-semibold tracking-tight',
                      TONE_CLASS[m.tone],
                    )}
                  >
                    {value}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* The system map */}
      <ArchDiagram selectedId={selectedId} onSelect={select} />

      {/* Legend — colour = phase identity, shape = edge role */}
      <div className="flex flex-col gap-4 rounded-2xl bg-foreground/[0.02] p-4 ring-1 ring-foreground/[0.05] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Phase
          </span>
          {PHASES.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80"
            >
              <span className={cn('h-2 w-2 rounded-full', p.dot)} />
              {p.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Flow
          </span>
          {(
            [
              ['flow', 'Primary'],
              ['feed', 'Feed'],
              ['loop', 'Loop'],
            ] as const
          ).map(([v, label]) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80"
            >
              <EdgeSample variant={v} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Models legend */}
      <div className="rounded-2xl bg-foreground/[0.02] p-1.5 ring-1 ring-foreground/[0.05]">
        <div className="rounded-[1.4rem] bg-card/30 p-5 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Models · thesis Table 3.6
          </div>
          <div className="flex flex-wrap gap-2">
            {ARCH_MODELS.map((model) => (
              <Tooltip key={model.id}>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 font-mono text-xs text-foreground/85 ring-1 ring-foreground/[0.07] transition-colors hover:ring-primary/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                    {model.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{model.role}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      <ArchDetailPanel node={selectedNode} overall={overall} onClose={close} />
    </div>
  )
}
