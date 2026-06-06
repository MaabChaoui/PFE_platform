'use client'

import * as React from 'react'
import { Quote } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { cn } from '@/lib/utils'

/**
 * Toulmin / argument-mining (ADU) triplet fields, in argument order. All FIVE
 * fields are surfaced — `backing` (the 4th) is emitted by the extractor and was
 * previously dropped. Field labels stay bilingual (English chrome + an Arabic
 * gloss) to match the Answer·الإجابة rhythm; the *values* are Arabic legal text.
 */
export const TOULMIN_FIELDS: Array<{ key: string; label: string; labelAr: string }> = [
  { key: 'claim', label: 'Claim', labelAr: 'الادعاء' },
  { key: 'ground', label: 'Ground', labelAr: 'المعطى' },
  { key: 'warrant', label: 'Warrant', labelAr: 'المسوّغ' },
  { key: 'backing', label: 'Backing', labelAr: 'السند' },
  { key: 'rebuttal', label: 'Rebuttal', labelAr: 'الدحض' },
]

export interface ToulminRow {
  label: string
  labelAr: string
  value: string
}

/** Non-empty Toulmin rows for an `argumentation` payload (string fields only). */
export function toulminRows(
  arg: Record<string, unknown> | null | undefined,
): ToulminRow[] {
  if (!arg || typeof arg !== 'object') return []
  return TOULMIN_FIELDS.map((f) => ({
    label: f.label,
    labelAr: f.labelAr,
    value: typeof arg[f.key] === 'string' ? (arg[f.key] as string).trim() : '',
  })).filter((r) => r.value.length > 0)
}

export function hasToulmin(arg: Record<string, unknown> | null | undefined): boolean {
  return toulminRows(arg).length > 0
}

/**
 * The shared Toulmin/ADU block: claim · ground · warrant · backing · rebuttal,
 * each value rendered RTL (Arabic) while the field labels stay LTR. Used by the
 * answer-panel (grounded sources) AND the reasoning trace's argue station
 * (argument mining) so the two presentations never drift.
 */
export function ToulminBlock({
  arg,
  title = 'Toulmin structure',
  className,
}: {
  arg: Record<string, unknown> | null | undefined
  title?: string
  className?: string
}) {
  const rows = toulminRows(arg)
  if (rows.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-foreground/[0.08] bg-background/40 p-3',
        className,
      )}
    >
      <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Quote className="h-3 w-3" />
        {title}
      </div>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[78px_1fr] gap-2">
            <dt className="pt-0.5">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-primary/90">
                {r.label}
              </span>
              <span className="font-arabic text-[11px] leading-none text-muted-foreground/70">
                {r.labelAr}
              </span>
            </dt>
            <dd>
              <ArabicText className="text-[13px] leading-relaxed text-foreground/85">
                {r.value}
              </ArabicText>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
