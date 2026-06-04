import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Consistent page scaffolding used by all 7 routes: a centered container and a
 * standard header (eyebrow → title → description, optional actions). Pure /
 * server-safe — no client hooks.
 */

export function PageContainer({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1400px] px-6 py-8 md:py-10',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('mb-8 animate-fade-up', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-4xl tracking-tight text-foreground md:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-prose text-balance text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** A small "coming in Sxx" placeholder note for routes built in later sessions. */
export function ComingSoon({ session, note }: { session: string; note?: string }) {
  return (
    <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
      <span className="inline-block h-2 w-2 animate-pulse-ring rounded-full bg-primary" />
      <span>
        Built in <span className="font-semibold text-foreground">{session}</span>
        {note ? ` — ${note}` : ''}
      </span>
    </div>
  )
}
