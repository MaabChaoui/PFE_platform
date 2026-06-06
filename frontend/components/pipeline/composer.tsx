'use client'

import * as React from 'react'
import { ArrowUp, Loader2, Lock, Radio, Sparkles, Zap } from 'lucide-react'

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
import { isArabic } from '@/components/pipeline/utils'
import type { QuestionSummary } from '@/lib/types'

export type Mode = 'replay' | 'live'

// ───────────────────────── replay / live mode toggle ─────────────────────────

function ModeToggle({
  mode,
  onModeChange,
  reachable,
  checking,
  onRecheck,
}: {
  mode: Mode
  onModeChange: (m: Mode) => void
  reachable: boolean
  checking: boolean
  onRecheck: () => void
}) {
  const segment = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-all duration-300 ease-spring',
      active
        ? 'bg-gradient-brand text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.03] p-0.5 text-xs">
      <button type="button" onClick={() => onModeChange('replay')} className={segment(mode === 'replay')}>
        <Radio className="h-3 w-3" />
        Replay
      </button>
      {reachable ? (
        <button type="button" onClick={() => onModeChange('live')} className={segment(mode === 'live')}>
          <Zap className="h-3 w-3" />
          Live
        </button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRecheck}
              aria-disabled
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-muted-foreground/55 transition-colors hover:text-muted-foreground/80"
            >
              {checking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              Live
            </button>
          </TooltipTrigger>
          <TooltipContent>Live LLM unavailable — replaying precomputed runs. Click to re-check.</TooltipContent>
        </Tooltip>
      )}
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
  mode: Mode
  onModeChange: (m: Mode) => void
  reachable: boolean
  checkingHealth: boolean
  onRecheck: () => void
  /** Run-config state (lifted to the page so it survives the hero↔active swap). */
  liveActive: boolean
  overrides: Record<string, unknown>
  onOverrideChange: (key: string, value: unknown) => void
  /** Replay path (the example picker). */
  selectedId: string | null
  onPick: (q: QuestionSummary) => void
  /** Live path — submit the typed query. */
  onSubmitLive: (query: string) => void
  className?: string
}

/**
 * The command bar. In LIVE mode the typed query + Send/Enter run the real
 * pipeline over SSE; in REPLAY mode the "Try an example" picker streams a
 * precomputed run (the typed field is inert — replay needs a question id). The
 * mode toggle is health-gated: Live is disabled (re-checkable) until the backend
 * reports a reachable LLM.
 */
export function Composer({
  variant,
  mode,
  onModeChange,
  reachable,
  checkingHealth,
  onRecheck,
  liveActive,
  overrides,
  onOverrideChange,
  selectedId,
  onPick,
  onSubmitLive,
  className,
}: ComposerProps) {
  const [query, setQuery] = React.useState('')
  const hero = variant === 'hero'
  const live = mode === 'live'
  const canSend = live && reachable && query.trim().length > 0
  const rtl = isArabic(query)

  const submit = () => {
    if (!canSend) return
    const q = query.trim()
    onSubmitLive(q)
    setQuery('')
  }

  const placeholder = live
    ? 'Ask a question about Algerian law…  (Enter to run live)'
    : 'Replaying precomputed runs — “Try an example”, or switch to Live to ask your own.'

  return (
    <div
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="rounded-[1.4rem] border border-foreground/[0.1] bg-card/80 shadow-card dark:border-foreground/[0.06] dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
        <div className={cn('px-4', hero ? 'pt-4' : 'pt-3')}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (live) submit()
              }
            }}
            dir={rtl ? 'rtl' : undefined}
            rows={hero ? 2 : 1}
            placeholder={placeholder}
            className={cn(
              'w-full resize-none bg-transparent leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none',
              hero ? 'min-h-[3.25rem] text-[15px]' : 'min-h-[1.75rem] text-sm',
              rtl && 'text-right font-arabic',
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
            <ModeToggle
              mode={mode}
              onModeChange={onModeChange}
              reachable={reachable}
              checking={checkingHealth}
              onRecheck={onRecheck}
            />
            <RunConfig
              liveActive={liveActive}
              overrides={overrides}
              onChange={onOverrideChange}
            />
          </div>

          <div className="flex items-center gap-2">
            {!live ? <ExamplePicker selectedId={selectedId} onPick={onPick} /> : null}
            <span className="hidden sm:inline-flex">
              <HealthBadge />
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label={live ? 'Run live answer' : 'Switch to Live to ask your own question'}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-sm transition-all duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    canSend
                      ? 'hover:brightness-110 active:scale-95'
                      : 'opacity-45 disabled:pointer-events-none',
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {live
                  ? query.trim()
                    ? 'Run the live pipeline'
                    : 'Type a question to run it live'
                  : 'Switch to Live to ask your own question'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
