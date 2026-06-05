'use client'

import * as React from 'react'
import {
  History,
  Loader2,
  Radio,
  Route as RouteIcon,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'

import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { HealthBadge } from '@/components/shared/health-badge'
import { ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BenchmarkPicker } from '@/components/pipeline/benchmark-picker'
import { TrajectoryTimeline } from '@/components/pipeline/trajectory-timeline'
import { AnswerPanel } from '@/components/pipeline/answer-panel'
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

// ───────────────────────── mode toggle ─────────────────────────

function ModeToggle() {
  return (
    <div className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.03] p-0.5 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 font-medium text-primary-foreground shadow-sm">
        <Radio className="h-3 w-3" />
        Replay
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled
            className="cursor-not-allowed select-none px-3 py-1 font-medium text-muted-foreground/55"
          >
            Live
          </span>
        </TooltipTrigger>
        <TooltipContent>Live mode arrives in S10b</TooltipContent>
      </Tooltip>
    </div>
  )
}

// ───────────────────────── reserved slots ─────────────────────────

function ReservedControlPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-sm font-medium text-foreground/90">
              Run configuration
            </div>
            <div className="text-[11px] text-muted-foreground">
              model · recursion depth · enhancers · live toggle
            </div>
          </div>
        </div>
        <Badge variant="outline" className="border-foreground/15 font-mono text-[10px]">
          S10b
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-hidden>
        {['root model', 'classifier', 'sub-LM', 'recursion', 'HyDE', 'KG'].map(
          (c) => (
            <span
              key={c}
              className="rounded-full border border-foreground/[0.08] bg-foreground/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground/50"
            >
              {c}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

function ReservedHistoryRail() {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-foreground/15 bg-foreground/[0.02] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Session history
        </div>
        <Badge variant="outline" className="border-foreground/15 font-mono text-[10px]">
          S10c
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
        Replayed and live runs will stack here for side-by-side comparison.
      </p>
      <div className="mt-3 space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-2.5 py-2 opacity-60"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
            <span className="h-2 flex-1 rounded-full bg-foreground/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────── idle / pending panels ─────────────────────────

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-h-[220px] items-center justify-center rounded-[1.4rem] bg-card/60 p-6 text-center shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        {children}
      </div>
    </div>
  )
}

// ───────────────────────── page ─────────────────────────

export default function PipelinePage() {
  const stream = usePipelineStream()
  const reducedMotion = usePrefersReducedMotion()
  const [selected, setSelected] = React.useState<QuestionSummary | null>(null)

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

  const queryText = selected?.question ?? null
  const queryRtl = queryText ? isArabic(queryText) : false
  const showAnswer = !!stream.answer && finished && playback.isComplete

  return (
    <div className="relative">
      <AuroraBackdrop soft />

      {/* hero / query header */}
      <section className="relative mx-auto w-full max-w-[1400px] px-6 pt-12 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Pipeline · offline replay
          </div>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
            See how it <span className="text-gradient-brand">reasons.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground">
            Replay any benchmark question and watch AKN-RLM route, retrieve,
            recurse and verify — every claim grounded in the Akoma Ntoso corpus,
            with citations and explicit abstention. No LLM required.
          </p>
        </div>

        {/* command bar — the active query + mode/health region header */}
        <div className="mx-auto mt-7 max-w-3xl">
          <div className="rounded-2xl border border-foreground/10 bg-card/70 p-3 shadow-xl backdrop-blur-xl">
            <div className="flex items-start gap-3 px-1 pt-1">
              <RouteIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {queryText ? (
                <p
                  dir={queryRtl ? 'rtl' : undefined}
                  className={cn(
                    'min-w-0 flex-1 text-[15px] leading-snug text-foreground/90',
                    queryRtl ? 'text-right font-arabic' : 'text-left',
                  )}
                >
                  {queryText}
                </p>
              ) : (
                <p className="min-w-0 flex-1 text-[15px] leading-snug text-muted-foreground/70">
                  Pick a benchmark question from the library to replay its
                  pipeline…
                </p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-foreground/[0.07] px-1 pt-2.5">
              <div className="flex items-center gap-2">
                <ModeToggle />
                {selected ? (
                  <Badge variant="muted" className="font-mono text-[10px]">
                    {humanize(selected.query_type)}
                  </Badge>
                ) : null}
              </div>
              <HealthBadge />
            </div>
          </div>
        </div>
      </section>

      {/* workspace */}
      <section className="relative mx-auto mt-10 w-full max-w-[1400px] px-6 pb-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* left rail: picker (active S10a) + reserved history (S10c) */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:w-[300px] lg:shrink-0">
            <div className="rounded-[1.4rem] border border-foreground/[0.08] bg-card/50 p-4">
              <BenchmarkPicker selectedId={selected?.id ?? null} onPick={onPick} />
            </div>
            <ReservedHistoryRail />
          </aside>

          {/* main column */}
          <div className="min-w-0 flex-1 space-y-6">
            <ReservedControlPanel />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] xl:items-start">
              {/* trajectory hero */}
              <div className="min-w-0">
                {stream.status === 'idle' ? (
                  <PanelShell>
                    <div className="max-w-sm">
                      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <RouteIcon className="h-5 w-5" />
                      </span>
                      <p className="font-display text-xl tracking-tight text-foreground">
                        Pick a question to begin
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        The full reasoning trajectory animates here, step by step
                        — routing, recursion depth, verification and the
                        faithfulness gate.
                      </p>
                    </div>
                  </PanelShell>
                ) : stream.status === 'error' ? (
                  <ErrorState error={errorLike(stream.error)} onRetry={onReplay} />
                ) : stream.steps.length === 0 ? (
                  <PanelShell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Streaming trajectory…
                    </div>
                  </PanelShell>
                ) : (
                  <TrajectoryTimeline
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
                  />
                )}
              </div>

              {/* answer column */}
              <div className="min-w-0 xl:sticky xl:top-20">
                {showAnswer && stream.answer ? (
                  <AnswerPanel answer={stream.answer} />
                ) : stream.status === 'idle' || stream.status === 'error' ? (
                  <PanelShell>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      The grounded answer — Arabic text, citations and the
                      faithfulness scores — appears here once the trajectory
                      completes.
                    </p>
                  </PanelShell>
                ) : (
                  <PanelShell>
                    <div className="max-w-xs">
                      <div className="mx-auto mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:hidden" />
                        Tracing the reasoning…
                      </div>
                      <p className="nums font-mono text-xs text-muted-foreground/70">
                        {Math.min(playback.cursor, playback.total)} /{' '}
                        {playback.total || '—'} steps
                      </p>
                    </div>
                  </PanelShell>
                )}
              </div>
            </div>

            {showAnswer && stream.answer ? (
              <Telemetry answer={stream.answer} scores={stream.scores} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Wrap the stream's error string so `ErrorState` (which understands ApiError /
 *  Error) renders a clean message. A plain string becomes a generic Error. */
function errorLike(detail: string | null): Error {
  return new Error(detail ?? 'The replay stream failed.')
}
