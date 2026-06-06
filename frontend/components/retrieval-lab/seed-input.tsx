'use client'

/**
 * Seed-from-benchmark input for the Retrieval Lab. Seeding by `question_id` lets
 * the backend AUTO-RESOLVE the query AND the gold article ids, so the gold
 * highlights light up across the channels.
 *
 * Reuses the existing `BenchmarkPicker` (filters + paginated list + RTL) inside a
 * Dialog — no Radix Popover (per the stack constraints). The chosen question is
 * surfaced as a chip carrying its id + RTL question text, with a clear control.
 */
import * as React from 'react'
import { ListChecks, Star, X } from 'lucide-react'

import { BenchmarkPicker } from '@/components/pipeline/benchmark-picker'
import { isArabic } from '@/components/pipeline/utils'
import { ArabicText } from '@/components/shared/arabic-text'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { QuestionSummary } from '@/lib/types'

export interface SeedSelection {
  id: string
  question: string
  queryType: string
}

export function SeedInput({
  selected,
  onSelect,
  onClear,
}: {
  selected: SeedSelection | null
  onSelect: (sel: SeedSelection) => void
  onClear: () => void
}) {
  const [open, setOpen] = React.useState(false)

  const handlePick = (q: QuestionSummary) => {
    onSelect({ id: q.id, question: q.question, queryType: q.query_type })
    setOpen(false)
  }

  const rtl = selected ? isArabic(selected.question) : false

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              'group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-medium transition-all duration-300 ease-spring active:scale-[0.99]',
              selected
                ? 'border-primary/40 bg-primary/[0.06] text-foreground'
                : 'border-foreground/12 bg-foreground/[0.02] text-muted-foreground hover:border-foreground/25 hover:text-foreground',
            )}
          >
            <ListChecks className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {selected ? `Question ${selected.id}` : 'Choose a benchmark question…'}
            </span>
            <span className="shrink-0 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors group-hover:text-foreground">
              {selected ? 'change' : 'browse'}
            </span>
          </button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[80vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b border-foreground/[0.07] p-5 text-left">
            <DialogTitle className="font-display text-xl tracking-tight">
              Seed from a benchmark question
            </DialogTitle>
            <DialogDescription>
              Picking a question lets the backend resolve its query and{' '}
              <span className="text-gold">gold target articles</span> — gold hits
              are highlighted across every channel.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <BenchmarkPicker selectedId={selected?.id ?? null} onPick={handlePick} />
          </div>
        </DialogContent>
      </Dialog>

      {selected ? (
        <div className="flex items-start gap-2 rounded-xl border border-gold/35 bg-gold/[0.05] px-3 py-2.5">
          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current text-gold" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <Badge variant="muted" className="px-1.5 py-0 font-mono text-[9px]">
                {humanize(selected.queryType)}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                {selected.id}
              </span>
            </div>
            {rtl ? (
              <ArabicText lines={2} className="text-[12.5px] leading-snug text-foreground/85">
                {selected.question}
              </ArabicText>
            ) : (
              <p className="line-clamp-2 text-[12.5px] leading-snug text-foreground/85">
                {selected.question}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear seeded question"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
          Seeding turns on{' '}
          <span className="font-medium text-gold">gold-hit highlighting</span> — see
          whether each retriever surfaces the annotated articles.
        </p>
      )}
    </div>
  )
}
