'use client'

import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Accent = 'default' | 'gold' | 'success' | 'info' | 'destructive'

export interface MetricDelta {
  label: string
  direction?: 'up' | 'down' | 'neutral'
  /** Whether the direction is a good thing (controls colour). */
  positive?: boolean
}

export interface MetricCardProps {
  label: string
  value: React.ReactNode
  sublabel?: React.ReactNode
  /** Hover explanation (e.g. a metric definition). */
  explanation?: string
  delta?: MetricDelta
  accent?: Accent
  className?: string
}

const ACCENT_BAR: Record<Accent, string> = {
  default: 'bg-primary',
  gold: 'bg-gold',
  success: 'bg-success',
  info: 'bg-info',
  destructive: 'bg-destructive',
}

/**
 * Headline metric: label, big tabular value, optional sublabel, delta chip and
 * an info-tooltip explanation. Reused by Results + Main telemetry.
 */
export function MetricCard({
  label,
  value,
  sublabel,
  explanation,
  delta,
  accent = 'default',
  className,
}: MetricCardProps) {
  const DeltaIcon =
    delta?.direction === 'up'
      ? ArrowUpRight
      : delta?.direction === 'down'
        ? ArrowDownRight
        : Minus

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-5 transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          ACCENT_BAR[accent],
        )}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {explanation ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">
              {explanation}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="nums text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              delta.positive === undefined
                ? 'text-muted-foreground'
                : delta.positive
                  ? 'text-success'
                  : 'text-destructive',
            )}
          >
            <DeltaIcon className="h-3 w-3" />
            {delta.label}
          </span>
        ) : null}
      </div>

      {sublabel ? (
        <div className="mt-1 text-sm text-muted-foreground">{sublabel}</div>
      ) : null}
    </Card>
  )
}
