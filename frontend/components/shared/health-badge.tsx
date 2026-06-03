'use client'

import { useQuery } from '@tanstack/react-query'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getHealth } from '@/lib/api'
import { cn } from '@/lib/utils'

type Status = 'checking' | 'ok' | 'offline'

const DOT: Record<Status, string> = {
  checking: 'bg-muted-foreground',
  ok: 'bg-success',
  offline: 'bg-destructive',
}

const LABEL: Record<Status, string> = {
  checking: 'checking',
  ok: 'online',
  offline: 'offline',
}

/** Live backend health pill in the nav — polls /api/health every 15s. */
export function HealthBadge() {
  const { data, isError, isLoading, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 15_000,
    retry: false,
  })

  const status: Status = isLoading
    ? 'checking'
    : isError || !data
      ? 'offline'
      : 'ok'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Backend ${LABEL[status]}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          <span className="relative flex h-2 w-2">
            {status === 'ok' && (
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success/60" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                DOT[status],
                isFetching && status !== 'ok' && 'animate-pulse',
              )}
            />
          </span>
          <span className="hidden sm:inline">{LABEL[status]}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {status === 'offline' ? (
          <div>Backend unreachable at :8000</div>
        ) : status === 'checking' ? (
          <div>Checking backend…</div>
        ) : (
          <div className="space-y-0.5">
            <div className="font-medium">Backend online</div>
            <div className="text-muted-foreground">
              indices {data?.indices_present ? '✓' : '✗'} · dataset{' '}
              {data?.dataset_present ? '✓' : '✗'} · llm {data?.llm}
            </div>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
