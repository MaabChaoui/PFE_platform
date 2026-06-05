'use client'

import * as React from 'react'
import { ArrowUp, Radio, Sparkles } from 'lucide-react'

import { HealthBadge } from '@/components/shared/health-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BenchmarkPicker } from '@/components/pipeline/benchmark-picker'
import { RunConfig } from '@/components/pipeline/run-config'
import { cn } from '@/lib/utils'
import type { QuestionSummary } from '@/lib/types'

// ───────────────────────── replay / live mode toggle ─────────────────────────

function ModeToggle() {
  return (
    <div className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.03] p-0.5 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-2.5 py-1 font-medium text-primary-foreground shadow-sm">
        <Radio className="h-3 w-3" />
        Replay
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled
            className="cursor-not-allowed select-none px-2.5 py-1 font-medium text-muted-foreground/55"
          >
            Live
          </span>
        </TooltipTrigger>
        <TooltipContent>Live answering — arriving soon</TooltipContent>
      </Tooltip>
    </div>
  )
}

// ───────────────────────── example picker dialog ─────────────────────────

function ExamplePicker({
  selectedId,
  onPick,
}: {
  selectedId: string | null
  onPick: (q: QuestionSummary) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] py-1 pl-3 pr-1 text-xs font-medium text-foreground/85 transition-all duration-300 ease-spring hover:border-primary/40 hover:bg-foreground/[0.07] active:scale-[0.98]"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Try an example
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-sm transition-transform duration-300 ease-spring group-hover:translate-x-0.5">
            <ArrowUp className="h-3.5 w-3.5 rotate-90" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Replay a benchmark question
          </DialogTitle>
          <DialogDescription>
            Pick any precomputed question — its full pipeline streams back from the locked
            run, no LLM required.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <BenchmarkPicker
            selectedId={selectedId}
            onPick={(q) => {
              onPick(q)
              setOpen(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ───────────────────────── composer ─────────────────────────

export interface ComposerProps {
  variant: 'hero' | 'docked'
  selectedId: string | null
  onPick: (q: QuestionSummary) => void
  className?: string
}

/**
 * The command bar. ChatGPT/Claude-style: a query field with the run-config and
 * mode controls attached to it, plus a "Try an example" affordance that opens
 * the benchmark picker for replay. In the empty state it is the centered hero;
 * once a run starts the page docks it to the bottom (`variant='docked'`).
 *
 * The typed input is the FUTURE live path — present, but its send action stays
 * gated (live answering ships later). Replay is the only path that runs now.
 */
export function Composer({ variant, selectedId, onPick, className }: ComposerProps) {
  const [query, setQuery] = React.useState('')
  const hero = variant === 'hero'

  return (
    <div
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="rounded-[1.4rem] border border-foreground/[0.06] bg-card/80 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
        <div className={cn('px-4', hero ? 'pt-4' : 'pt-3')}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Send is gated this session — never submit.
              if (e.key === 'Enter' && !e.shiftKey) e.preventDefault()
            }}
            rows={hero ? 2 : 1}
            placeholder="Ask a question about Algerian law…  (live answering arrives soon — try an example to replay)"
            className={cn(
              'w-full resize-none bg-transparent leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none',
              hero ? 'min-h-[3.25rem] text-[15px]' : 'min-h-[1.75rem] text-sm',
            )}
          />
        </div>

        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 px-3',
            hero ? 'pb-3 pt-1' : 'pb-2.5 pt-0.5',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ModeToggle />
            <RunConfig />
          </div>

          <div className="flex items-center gap-2">
            <ExamplePicker selectedId={selectedId} onPick={onPick} />
            <span className="hidden sm:inline-flex">
              <HealthBadge />
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  aria-label="Send (live answering arrives soon)"
                  className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-primary-foreground opacity-45 shadow-sm transition-transform disabled:pointer-events-none"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Live answering arrives soon — use “Try an example” to replay
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
