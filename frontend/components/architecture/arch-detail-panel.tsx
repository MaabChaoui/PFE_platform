'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Check, Copy, ArrowRight } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  GROUP_META,
  formatMetric,
  type ArchNode,
} from '@/lib/architecture'

function CodePath({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = React.useCallback(() => {
    void navigator.clipboard?.writeText(path).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    })
  }, [path])

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2 text-left ring-1 ring-foreground/[0.07] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-foreground/[0.04] hover:ring-primary/40"
    >
      <code className="min-w-0 break-all font-mono text-[11.5px] leading-relaxed text-foreground/85">
        {path}
      </code>
      <span className="shrink-0 text-muted-foreground group-hover:text-primary">
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  )
}

function IOList({
  title,
  items,
  icon: Icon,
}: {
  title: string
  items: string[]
  icon: typeof ArrowDownLeft
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li
            key={it}
            className="rounded-md bg-background/40 px-2.5 py-1 text-xs text-foreground/85 ring-1 ring-foreground/[0.06]"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ArchDetailPanel({
  node,
  overall,
  onClose,
}: {
  node: ArchNode | undefined
  /** Live `metrics.overall` for metric enrichment (optional). */
  overall: Record<string, unknown> | null
  onClose: () => void
}) {
  const group = node ? GROUP_META[node.group] : null

  // Enriched metric value: prefer the live overall.<key> when present & numeric.
  const metricValue = React.useMemo(() => {
    if (!node?.metric) return null
    const m = node.metric
    if (m.overallKey && overall) {
      const raw = overall[m.overallKey]
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return { value: formatMetric(raw, m.kind ?? 'ratio', m.digits), live: true }
      }
    }
    return { value: m.value, live: false }
  }, [node, overall])

  return (
    <Sheet open={!!node} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 scrollbar-thin sm:max-w-md"
      >
        {node && group ? (
          <>
            <SheetHeader className="space-y-3 border-b border-border p-6 text-left">
              <div className={cn('flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]', group.tone)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', group.dot)} />
                {group.label}
              </div>
              <SheetTitle className="font-display text-2xl font-normal leading-tight tracking-tight">
                {node.title}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">{node.short}</p>
            </SheetHeader>

            <div className="space-y-6 p-6">
              <section>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What it does
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {node.what}
                </p>
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IOList title="Inputs" items={node.inputs} icon={ArrowDownLeft} />
                <IOList title="Outputs" items={node.outputs} icon={ArrowUpRight} />
              </section>

              {metricValue ? (
                <section>
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Metric
                  </h3>
                  <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/[0.06] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground/85">
                        {node.metric!.label}
                      </span>
                      {metricValue.live ? (
                        <Badge variant="muted" className="gap-1 px-1.5 py-0 text-[9px]">
                          <span className="h-1 w-1 animate-pulse-ring rounded-full bg-success" />
                          live
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="nums font-mono text-lg font-semibold text-gold">
                        {metricValue.value}
                      </span>
                      {node.metric!.href ? (
                        <Link
                          href={node.metric!.href}
                          className="text-muted-foreground transition-colors hover:text-primary"
                          aria-label="Go to metric source"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  In the code
                </h3>
                <div className="space-y-1.5">
                  {node.code.map((p) => (
                    <CodePath key={p} path={p} />
                  ))}
                </div>
              </section>

              {node.links?.length ? (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Related
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {node.links.map((l) => (
                      <Link
                        key={l.href + l.label}
                        href={l.href}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        {l.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
