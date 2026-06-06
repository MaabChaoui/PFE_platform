'use client'

import * as React from 'react'
import { Brain, ChevronDown, Loader2 } from 'lucide-react'

import { TrajectoryTimeline } from '@/components/pipeline/trajectory-timeline'
import { fmtLatency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnswerResponse, CompareResponse, StepEvent } from '@/lib/types'

import type { CompareStatus } from './retrieval-channels'
import { TraceEnrichmentProvider, retrievalHostIndex } from './trace-context'

export interface ReasoningTraceProps {
  steps: StepEvent[]
  cursor: number
  activeIndex: number
  total: number
  playing: boolean
  isComplete: boolean
  onPlay: () => void
  onPause: () => void
  onStep: () => void
  onRestart: () => void
  onJumpEnd: () => void
  /** Final answer (for the collapsed one-line summary + verify/argue/route
   *  station enrichment); null while streaming. */
  answer: AnswerResponse | null
  /** Real retrieved articles for the retrieve station (POST /retrieval/compare). */
  compare: CompareResponse | null
  compareStatus: CompareStatus
  className?: string
}

/** "Reasoned through 9 steps · recursion depth 3 · 30 sub-calls · 1m 18s" */
function summarize(answer: AnswerResponse | null, total: number): string {
  const parts: string[] = [`Reasoned through ${total} step${total === 1 ? '' : 's'}`]
  if (answer) {
    if (answer.recursion_depth_max > 0) parts.push(`recursion depth ${answer.recursion_depth_max}`)
    if (answer.sub_call_count > 0) parts.push(`${answer.sub_call_count} sub-calls`)
    parts.push(fmtLatency(answer.latency_s))
  }
  return parts.join(' · ')
}

/**
 * The S10a animated trajectory, demoted to a collapsible "reasoning trace"
 * (Claude extended-thinking style). It is EXPANDED while the walk animates, then
 * auto-collapses to a one-line summary once playback completes — the answer is
 * the hero, this is the secondary trace. Re-expands on the next run; manual
 * toggles persist between runs.
 */
export function ReasoningTrace({
  answer,
  compare,
  compareStatus,
  className,
  ...timeline
}: ReasoningTraceProps) {
  const { total, cursor, isComplete } = timeline
  const [open, setOpen] = React.useState(true)

  const enrichment = React.useMemo(
    () => ({
      answer,
      compare,
      compareStatus,
      retrievalHostIndex: retrievalHostIndex(timeline.steps),
    }),
    [answer, compare, compareStatus, timeline.steps],
  )

  // Expand during the walk; collapse once (on the isComplete transition).
  React.useEffect(() => {
    setOpen(!isComplete)
  }, [isComplete])

  const summary = isComplete
    ? summarize(answer, total)
    : `Reasoning… ${Math.min(cursor, total)} / ${total || '—'} steps`

  return (
    <section
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.4rem] bg-card/60 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.02] md:px-5"
        >
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
              isComplete ? 'bg-foreground/[0.05] text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            {isComplete ? (
              <Brain className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Reasoning trace
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-foreground/80">{summary}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-spring motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>

        <div
          className={cn(
            'grid transition-all duration-500 ease-spring motion-reduce:transition-none',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-foreground/[0.07] p-1.5">
              <TraceEnrichmentProvider value={enrichment}>
                <TrajectoryTimeline
                  {...timeline}
                  className="!bg-transparent p-0 ring-0"
                />
              </TraceEnrichmentProvider>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
