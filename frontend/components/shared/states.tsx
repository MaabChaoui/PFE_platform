'use client'

import * as React from 'react'
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Empty result — neutral, informative. */
export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon,
  action,
  className,
}: {
  title?: string
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 text-muted-foreground">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function errorMessage(error: unknown): { offline: boolean; message: string } {
  if (error instanceof ApiError) {
    return { offline: error.isOffline, message: error.detail }
  }
  if (error instanceof Error) return { offline: false, message: error.message }
  return { offline: false, message: 'Something went wrong.' }
}

/** Error / offline state with an optional retry. Understands ApiError. */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error?: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  const { offline, message } = errorMessage(error)
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 text-destructive">
        {offline ? (
          <WifiOff className="h-8 w-8" />
        ) : (
          <AlertTriangle className="h-8 w-8" />
        )}
      </div>
      <p className="font-medium text-foreground">
        {title ?? (offline ? 'Backend offline' : 'Could not load data')}
      </p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {offline
          ? 'The API at :8000 is unreachable. Start the backend, or explore the offline-rendered pages.'
          : message}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

/** Slim banner for offline mode (e.g. pinned at the top of a data page). */
export function OfflineBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground',
        className,
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0 text-warning" />
      <span>
        Backend offline — live features are unavailable; offline content still
        works.
      </span>
    </div>
  )
}

/** Generic loading block. */
export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/20 px-6 py-12 text-sm text-muted-foreground',
        className,
      )}
    >
      <RefreshCw className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

/** Skeleton shaped like a MetricCard (for dashboard loading). */
export function MetricCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </Card>
  )
}

/** Skeleton block of stacked rows (lists/tables). */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
