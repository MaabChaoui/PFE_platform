import * as React from 'react'

import type { FormatsAvailable } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  FORMAT_KEYS,
  FORMAT_LABEL,
  docTypeMeta,
  type FormatKey,
} from './utils'

/**
 * The four source-format chips (akn / txt / rdf / pdf). Present formats read as
 * solid hairline tokens; absent ones dim to a struck-through ghost so the jury
 * sees exactly which artefacts back each law. LTR (file-format codes).
 */
export function FormatChips({
  formats,
  className,
  size = 'sm',
}: {
  formats: FormatsAvailable
  className?: string
  size?: 'sm' | 'xs'
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} dir="ltr">
      {FORMAT_KEYS.map((key: FormatKey) => {
        const on = formats[key]
        return (
          <span
            key={key}
            title={`${FORMAT_LABEL[key]} ${on ? 'available' : 'not available'}`}
            className={cn(
              'rounded-md border font-mono uppercase tracking-wide transition-colors',
              size === 'xs' ? 'px-1 py-px text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
              on
                ? 'border-foreground/15 bg-foreground/[0.05] text-foreground/75'
                : 'border-dashed border-foreground/10 text-muted-foreground/40 line-through',
            )}
          >
            {FORMAT_LABEL[key]}
          </span>
        )
      })}
    </div>
  )
}

/** A small, tone-coded badge for a document's legal type (constitution/order/…). */
export function DocTypeBadge({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  const meta = docTypeMeta(type)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide',
        meta.tone,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
