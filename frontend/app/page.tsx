'use client'

import * as React from 'react'
import { Loader2, MessagesSquare, Plus, Sparkles } from 'lucide-react'

import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AnswerPanel } from '@/components/pipeline/answer-panel'
import { Composer } from '@/components/pipeline/composer'
import { ReasoningTrace } from '@/components/pipeline/reasoning-trace'
import { Telemetry } from '@/components/pipeline/telemetry'
import { isArabic } from '@/components/pipeline/utils'
import {
  usePipelineStream,
  usePrefersReducedMotion,
  useTrajectoryPlayback,
} from '@/lib/use-pipeline-stream'
import { cn } from '@/lib/utils'
import { humanize } from '@/lib/format'
import type { QuestionSummary } from '@/lib/types'

// ───────────────────────── reserved chat-history rail (S10d) ─────────────────────────

/** An intentional, in-page "Sessions" slot reserved for the S10d chat-history
 *  rail. The GLOBAL app sidebar (layout.tsx) stays the product nav; conversation
 *  history is page-local, so it lives here next to the conversation column. */
function SessionsRail({ activeLabel }: { activeLabel: string | null }) {
  return (
    <aside className="hidden w-[252px] shrink-0 lg:block">
      <div className="sticky top-20 rounded-[1.4rem] border border-foreground/[0.08] bg-card/50 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5" />
            Sessions
          </span>
          <Badge variant="outline" className="border-foreground/15 font-mono text-[10px]">
            S10d
          </Badge>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-foreground/15 px-3 py-2 text-xs font-medium text-muted-foreground/70"
            >
              <Plus className="h-3.5 w-3.5" />
              New session
            </button>
          </TooltipTrigger>
          <TooltipContent>Multi-session history arrives in S10d</TooltipContent>
        </Tooltip>

        <div className="mt-3 space-y-1.5">
          {activeLabel ? (
            <div className="rounded-lg border border-primary/40 bg-primary/[0.06] px-2.5 py-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary/90">
                Current
              </div>
              <div className="mt-0.5 truncate text-[12px] text-foreground/85">{activeLabel}</div>
            </div>
          ) : null}
          {[0, 1].map((i) => (
            <div
              key={i}
              aria-hidden
              className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-2.5 py-2.5 opacity-50"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
              <span className="h-2 flex-1 rounded-full bg-foreground/[0.06]" />
            </div>
          ))}
        </div>

        <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground/80">
          Your replays and live runs will stack here for side-by-side comparison.
        </p>
      </div>
    </aside>
  )
}

// ───────────────────────── conversation parts ─────────────────────────

function UserTurn({ question, queryType }: { question: string; queryType: string }) {
  const rtl = isArabic(question)
  return (
    <div className="flex justify-end motion-safe:animate-fade-up motion-reduce:animate-none">
      <div className="max-w-[86%] rounded-[1.25rem] rounded-tr-md border border-foreground/10 bg-foreground/[0.04] px-4 py-3 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          You
          <Badge variant="muted" className="font-mono text-[9px]">
            {humanize(queryType)}
          </Badge>
        </div>
        <p
          dir={rtl ? 'rtl' : undefined}
          className={cn(
            'text-[15px] leading-relaxed text-foreground/90',
            rtl ? 'text-right font-arabic' : 'text-left',
          )}
        >
          {question}
        </p>
      </div>
    </div>
  )
}

function PendingAnswer({ cursor, total }: { cursor: number; total: number }) {
  return (
    <div className="rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[1.4rem] bg-card/60 p-6 text-center shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:hidden" />
          Synthesising the grounded answer…
        </div>
        <p className="mt-1.5 nums font-mono text-xs text-muted-foreground/70">
          {Math.min(cursor, total)} / {total || '—'} steps traced
        </p>
      </div>
    </div>
  )
}

function StreamingState() {
  return (
    <div className="rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-h-[160px] items-center justify-center gap-2 rounded-[1.4rem] bg-card/60 text-sm text-muted-foreground shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Streaming the reasoning trajectory…
      </div>
    </div>
  )
}

// ───────────────────────── page ─────────────────────────

export default function PipelinePage() {
  const stream = usePipelineStream()
  const reducedMotion = usePrefersReducedMotion()
  const [selected, setSelected] = React.useState<QuestionSummary | null>(null)
  const turnRef = React.useRef<HTMLDivElement>(null)

  const finished = stream.status === 'done'
  const playback = useTrajectoryPlayback({
    runId: stream.runId,
    total: stream.steps.length,
    finished,
    reducedMotion,
  })

  const onPick = React.useCallback(
    (q: QuestionSummary) => {
      setSelected(q)
      stream.run({ mode: 'replay', question_id: q.id })
    },
    [stream],
  )

  const onReplay = React.useCallback(() => {
    if (selected) stream.run({ mode: 'replay', question_id: selected.id })
  }, [selected, stream])

  // Keep the newest turn (its top — the query) in view when a run starts.
  React.useEffect(() => {
    if (stream.runId > 0) {
      turnRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }
  }, [stream.runId, reducedMotion])

  const active = stream.status !== 'idle'
  const hasSteps = stream.steps.length > 0
  const showAnswer = !!stream.answer && finished && playback.isComplete

  // ── empty state: centered hero composer ──
  if (!active) {
    return (
      <div className="relative">
        <AuroraBackdrop soft />
        <section className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-16">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Pipeline · offline replay
          </div>
          <h1 className="text-center font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            See how it <span className="text-gradient-brand">reasons.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-center text-sm text-muted-foreground">
            Replay any benchmark question and watch AKN-RLM route, retrieve, recurse and
            verify — every claim grounded in the Akoma Ntoso corpus, with citations and
            explicit abstention. No LLM required.
          </p>

          <Composer
            variant="hero"
            selectedId={null}
            onPick={onPick}
            className="mt-8 w-full"
          />

          <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
            Live answering arrives soon — for now, “Try an example” replays the locked run.
          </p>
        </section>
      </div>
    )
  }

  // ── active state: conversation column + docked composer ──
  return (
    <div className="relative">
      <AuroraBackdrop soft />
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 md:px-6">
        <SessionsRail activeLabel={selected?.question ?? null} />

        <div className="relative min-w-0 flex-1">
          <div className="mx-auto max-w-3xl">
            <div className="min-h-[58vh] space-y-5 pb-44 pt-8">
              <div ref={turnRef} className="space-y-5 scroll-mt-20">
                {selected ? (
                  <UserTurn question={selected.question} queryType={selected.query_type} />
                ) : null}

                {stream.status === 'error' ? (
                  <ErrorState error={errorLike(stream.error)} onRetry={onReplay} />
                ) : !hasSteps ? (
                  <StreamingState />
                ) : (
                  <div className="space-y-5 motion-safe:animate-fade-up motion-reduce:animate-none">
                    <ReasoningTrace
                      steps={stream.steps}
                      cursor={playback.cursor}
                      activeIndex={playback.activeIndex}
                      total={playback.total}
                      playing={playback.playing}
                      isComplete={playback.isComplete}
                      onPlay={playback.play}
                      onPause={playback.pause}
                      onStep={playback.stepForward}
                      onRestart={playback.restart}
                      onJumpEnd={playback.jumpToEnd}
                      answer={stream.answer}
                    />

                    {showAnswer && stream.answer ? (
                      <AnswerPanel answer={stream.answer} />
                    ) : (
                      <PendingAnswer cursor={playback.cursor} total={playback.total} />
                    )}

                    {showAnswer && stream.answer ? (
                      <Telemetry answer={stream.answer} scores={stream.scores} />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* docked composer — sticks to the bottom of the view, content scrolls under */}
          <div className="sticky bottom-0 z-20 pt-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent"
            />
            <div className="relative mx-auto max-w-3xl pb-4 motion-safe:animate-fade-up motion-reduce:animate-none">
              <Composer variant="docked" selectedId={selected?.id ?? null} onPick={onPick} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Wrap the stream's error string so `ErrorState` (which understands ApiError /
 *  Error) renders a clean message. A plain string becomes a generic Error. */
function errorLike(detail: string | null): Error {
  return new Error(detail ?? 'The replay stream failed.')
}
