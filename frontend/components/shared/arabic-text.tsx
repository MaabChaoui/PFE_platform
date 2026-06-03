import * as React from 'react'

import { cn } from '@/lib/utils'

type ArabicTextProps = {
  children: React.ReactNode
  /** Element to render (default <p>). */
  as?: React.ElementType
  /** Clamp to N lines with an ellipsis. */
  lines?: number
  className?: string
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>

/**
 * Renders Arabic legal text right-to-left with the Arabic font and generous
 * line-height (the `.arabic` rule in globals.css). The app chrome stays LTR —
 * only the wrapped block is mirrored. `lines` enables a line-clamp.
 */
export function ArabicText({
  children,
  as,
  lines,
  className,
  style,
  ...props
}: ArabicTextProps) {
  const Comp = (as ?? 'p') as React.ElementType
  const clampStyle: React.CSSProperties | undefined = lines
    ? {
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }
    : undefined

  return (
    <Comp
      dir="rtl"
      lang="ar"
      className={cn('arabic text-right', className)}
      style={{ ...clampStyle, ...style }}
      {...props}
    >
      {children}
    </Comp>
  )
}
