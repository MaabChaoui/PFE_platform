'use client'

import * as React from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { OUTCOME_META, OUTCOME_TONE, type Outcome } from './utils'

/**
 * The per-question AKN-RLM verdict pill — icon + label, toned by outcome, with a
 * tooltip carrying the rule. Shared by the list rows and the detail header so the
 * badge logic never drifts. `size="icon"` renders just the toned dot+glyph for the
 * dense list; `size="full"` renders the labelled pill for the detail.
 */
export function OutcomeBadge({
  outcome,
  size = 'full',
  className,
}: {
  outcome: Outcome
  size?: 'full' | 'icon'
  className?: string
}) {
  const meta = OUTCOME_META[outcome]
  const tone = OUTCOME_TONE[meta.tone]
  const Icon = meta.icon

  const body =
    size === 'icon' ? (
      <span
        className={cn(
          'inline-grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ring-inset',
          tone.soft,
          tone.ring,
          tone.text,
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    ) : (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
          tone.soft,
          tone.ring,
          tone.text,
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${meta.label}: ${meta.description}`}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {body}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">
        <span className="font-medium text-foreground">{meta.label}</span>
        {' — '}
        {meta.description}
      </TooltipContent>
    </Tooltip>
  )
}
