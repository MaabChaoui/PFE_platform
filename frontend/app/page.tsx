'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CloudOff, Loader2, RotateCcw, Sparkles } from 'lucide-react'

import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { AnswerPanel } from '@/components/pipeline/answer-panel'
import { Composer, type Mode } from '@/components/pipeline/composer'
import { LiveProgress } from '@/components/pipeline/live-progress'
import { ReasoningTrace } from '@/components/pipeline/reasoning-trace'
import { SessionsRail, SessionsSheet } from '@/components/pipeline/sessions-rail'
import { Telemetry } from '@/components/pipeline/telemetry'
import { buildAnswerOptions, isArabic, isLlmReachable } from '@/components/pipeline/utils'
import { getHealth } from '@/lib/api'
import {
  usePipelineStream,
  usePrefersReducedMotion,
  useTrajectoryPlayback,
} from '@/lib/use-pipeline-stream'
import { useRetrievalCompare } from '@/lib/use-retrieval-compare'
import { useSessionHistory, type Session } from '@/lib/use-session-history'
import { cn } from '@/lib/utils'
import { humanize } from '@/lib/format'
import type { QuestionSummary } from '@/lib/types'

/** Minimal question shape the conversation needs (UserTurn + retrieval seed). For
 *  replay `id` is the benchmark question id; for live it is the session id. */
type ActiveQuestion = { id: string; question: string; query_type: string }

/** What's currently running — read fresh (via ref) by the post-answer enrich
 *  effect so a superseded run can never write the wrong session. */
type Running = { id: string; mode: Mode; label: string; questionId?: string; query?: string }

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
    <div className="rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]">
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[1.4rem] bg-card/60 p-6 text-center shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
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
    <div className="rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]">
      <div className="flex min-h-[160px] items-center justify-center gap-2 rounded-[1.4rem] bg-card/60 text-sm text-muted-foreground shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:hidden" />
        Streaming the reasoning trajectory…
      </div>
    </div>
  )
}

/** Graceful "this can't run live" surface (live error, or restoring a live
 *  session while the LLM is unreachable). Always offers the offline replay path. */
function LiveUnavailable({
  title,
  detail,
  onRetry,
  retryLabel,
  onReplayInstead,
}: {
  title: string
  detail: string
  onRetry: () => void
  retryLabel: string
  onReplayInstead: () => void
}) {
  return (
    <div className="rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06] motion-safe:animate-fade-up motion-reduce:animate-none">
      <div className="flex flex-col items-center rounded-[1.4rem] bg-card/60 p-7 text-center shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-warning/10 text-warning">
          <CloudOff className="h-5 w-5" />
        </span>
        <h3 className="mt-3 font-display text-xl tracking-tight">{title}</h3>
        <p className="mt-1.5 max-w-md text-balance text-sm text-muted-foreground">{detail}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-4 py-2 text-xs font-medium text-foreground/85 transition-all duration-300 ease-spring hover:border-foreground/30 active:scale-[0.97]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={onReplayInstead}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all duration-300 ease-spring hover:brightness-110 active:scale-[0.97]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Replay an example instead
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── page ─────────────────────────

export default function PipelinePage() {
  const stream = usePipelineStream()
  const reducedMotion = usePrefersReducedMotion()
  const sessions = useSessionHistory()
  const { createOrTouch, select, remove, clear, newSession, activeId } = sessions

  const [mode, setMode] = React.useState<Mode>('replay')
  const [overrides, setOverrides] = React.useState<Record<string, unknown>>({})
  const [selected, setSelected] = React.useState<ActiveQuestion | null>(null)
  const [liveBlocked, setLiveBlocked] = React.useState<{ question: string } | null>(null)

  const turnRef = React.useRef<HTMLDivElement>(null)
  const runningRef = React.useRef<Running | null>(null)
  const enrichedRunRef = React.useRef(0)

  // Health → live reachability gate (shares the ['health'] cache w/ the nav badge).
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
  })
  const reachable = isLlmReachable(health.data)
  const liveActive = mode === 'live' && reachable

  const finished = stream.status === 'done'
  const playback = useTrajectoryPlayback({
    runId: stream.runId,
    total: stream.steps.length,
    finished,
    reducedMotion,
  })

  // ONE offline retrieval-compare per replayed question (replay-only; live runs
  // carry rich step detail already, no question_id to seed compare).
  const retrieval = useRetrievalCompare(
    stream.mode === 'replay' ? (selected?.id ?? null) : null,
  )

  const onOverrideChange = React.useCallback((key: string, value: unknown) => {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Re-probe health on a Live-switch attempt while unreachable.
  const recheckLive = React.useCallback(async () => {
    try {
      const { data } = await health.refetch()
      if (isLlmReachable(data)) {
        setMode('live')
        toast.success('Live LLM reachable', { description: 'Switched to live answering.' })
      } else {
        toast.message('Live LLM unavailable', {
          description: 'Replaying precomputed runs — the live endpoint isn’t reachable yet.',
        })
      }
    } catch {
      toast.error('Couldn’t reach the backend to check live availability.')
    }
  }, [health])

  const onModeChange = React.useCallback(
    (m: Mode) => {
      if (m === mode) return
      if (m === 'live' && !reachable) {
        void recheckLive()
        return
      }
      if (stream.status === 'running') {
        stream.reset()
        setSelected(null)
        runningRef.current = null
      }
      setLiveBlocked(null)
      setMode(m)
    },
    [mode, reachable, stream, recheckLive],
  )

  // Bounce out of Live if the LLM becomes unreachable in the background.
  React.useEffect(() => {
    if (mode === 'live' && health.data && !reachable) {
      setMode('replay')
      toast.message('Live LLM became unavailable', { description: 'Switched back to replay.' })
    }
  }, [mode, reachable, health.data])

  // Replay a freshly picked benchmark question + record the session.
  const onPick = React.useCallback(
    (q: QuestionSummary) => {
      setLiveBlocked(null)
      const s = createOrTouch({
        mode: 'replay',
        questionId: q.id,
        label: q.question,
        queryType: q.query_type,
        handler: q.dispatched_handler ?? undefined,
      })
      runningRef.current = { id: s.id, mode: 'replay', label: q.question, questionId: q.id }
      setSelected({ id: q.id, question: q.question, query_type: q.query_type })
      stream.run({ mode: 'replay', question_id: q.id })
    },
    [createOrTouch, stream],
  )

  // Submit a typed query as a LIVE run + record the session.
  const onSubmitLive = React.useCallback(
    (q: string) => {
      setLiveBlocked(null)
      const s = createOrTouch({ mode: 'live', query: q, label: q })
      runningRef.current = { id: s.id, mode: 'live', label: q, query: q }
      setSelected({ id: s.id, question: q, query_type: 'auto' })
      stream.run({ mode: 'live', query: q, options: buildAnswerOptions(overrides) })
    },
    [createOrTouch, stream, overrides],
  )

  // Restore a stored session (replay re-streams; live re-runs if reachable).
  const onSelectSession = React.useCallback(
    (s: Session) => {
      select(s.id)
      setLiveBlocked(null)
      if (s.mode === 'live') {
        const q = s.query ?? s.label
        setSelected({ id: s.id, question: q, query_type: s.queryType ?? 'auto' })
        if (!reachable) {
          stream.reset()
          setLiveBlocked({ question: q })
          return
        }
        setMode('live')
        runningRef.current = { id: s.id, mode: 'live', label: s.label, query: q }
        stream.run({ mode: 'live', query: q, options: buildAnswerOptions(overrides) })
        return
      }
      if (!s.questionId) return
      setMode('replay')
      runningRef.current = { id: s.id, mode: 'replay', label: s.label, questionId: s.questionId }
      setSelected({ id: s.questionId, question: s.label, query_type: s.queryType ?? 'unknown' })
      stream.run({ mode: 'replay', question_id: s.questionId })
    },
    [select, reachable, stream, overrides],
  )

  const onReplay = React.useCallback(() => {
    if (selected && stream.mode === 'replay') {
      stream.run({ mode: 'replay', question_id: selected.id })
    }
  }, [selected, stream])

  const onRetryLive = React.useCallback(() => {
    const r = runningRef.current
    if (r?.mode === 'live' && r.query) {
      setLiveBlocked(null)
      stream.run({ mode: 'live', query: r.query, options: buildAnswerOptions(overrides) })
    }
  }, [stream, overrides])

  // Fall back to the offline replay path (from a live error / unavailable state).
  const onReplayInstead = React.useCallback(() => {
    stream.reset()
    setMode('replay')
    setSelected(null)
    setLiveBlocked(null)
    runningRef.current = null
  }, [stream])

  const handleNewSession = React.useCallback(() => {
    stream.reset()
    newSession()
    setSelected(null)
    setLiveBlocked(null)
    runningRef.current = null
  }, [stream, newSession])

  const handleRemove = React.useCallback(
    (id: string) => {
      if (id === activeId) handleNewSession()
      remove(id)
    },
    [activeId, remove, handleNewSession],
  )

  const handleClear = React.useCallback(() => {
    clear()
    handleNewSession()
  }, [clear, handleNewSession])

  // Refine the active session's subtitle from the AnswerResponse once it lands
  // (predicted type + handler). Keyed on runId, read from a ref → a superseded
  // run can never write the wrong values.
  React.useEffect(() => {
    if (stream.status === 'done' && stream.answer && stream.runId !== enrichedRunRef.current) {
      enrichedRunRef.current = stream.runId
      const r = runningRef.current
      const ans = stream.answer
      if (r) {
        createOrTouch({
          id: r.id,
          mode: r.mode,
          questionId: r.questionId,
          query: r.query,
          label: r.label,
          queryType: ans.query_type_predicted,
          handler: ans.handler_used,
        })
        if (r.mode === 'live') {
          setSelected((prev) =>
            prev && prev.id === r.id ? { ...prev, query_type: ans.query_type_predicted } : prev,
          )
        }
      }
    }
  }, [stream.status, stream.runId, stream.answer, createOrTouch])

  // Keep the newest turn (its query) in view when a run starts.
  React.useEffect(() => {
    if (stream.runId > 0) {
      turnRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }
  }, [stream.runId, reducedMotion])

  const active = stream.status !== 'idle' || liveBlocked !== null
  const hasHistory = sessions.sessions.length > 0
  const hasSteps = stream.steps.length > 0
  const showAnswer = !!stream.answer && finished && playback.isComplete
  const liveRunning = stream.mode === 'live'

  const railProps = {
    sessions: sessions.sessions,
    activeId,
    onSelect: onSelectSession,
    onNew: handleNewSession,
    onRemove: handleRemove,
    onClear: handleClear,
  }

  const composerProps = {
    mode,
    onModeChange,
    reachable,
    checkingHealth: health.isFetching,
    onRecheck: () => void recheckLive(),
    liveActive,
    overrides,
    onOverrideChange,
    selectedId: selected?.id ?? null,
    onPick,
    onSubmitLive,
  }

  return (
    <div className="relative">
      <AuroraBackdrop soft />
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 md:px-6">
        {hasHistory ? <SessionsRail {...railProps} /> : null}

        <div className="relative min-w-0 flex-1">
          {hasHistory ? (
            <div className="flex items-center justify-start pt-4 lg:hidden">
              <SessionsSheet {...railProps} />
            </div>
          ) : null}

          {!active ? (
            // ── empty state: centered hero composer ──
            <section className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-3xl flex-col items-center justify-center px-2 py-16">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                {mode === 'live' ? 'Pipeline · live answering' : 'Pipeline · offline replay'}
              </div>
              <h1 className="text-center font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
                See how it <span className="text-gradient-brand">reasons.</span>
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-balance text-center text-sm text-muted-foreground">
                {mode === 'live'
                  ? 'Ask your own question and watch AKN-RLM route, retrieve, recurse and verify it live — every claim grounded in the Akoma Ntoso corpus.'
                  : 'Replay any benchmark question and watch AKN-RLM route, retrieve, recurse and verify — every claim grounded in the Akoma Ntoso corpus, with citations and explicit abstention. No LLM required.'}
              </p>

              <Composer variant="hero" {...composerProps} className="mt-8 w-full" />

              <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
                {reachable
                  ? mode === 'live'
                    ? 'Live answering runs the real pipeline — 10–60s per query.'
                    : 'Switch to Live to ask your own question, or “Try an example” to replay the locked run.'
                  : 'Live LLM unavailable — replaying precomputed runs. “Try an example” needs no LLM.'}
              </p>
            </section>
          ) : (
            // ── active state: conversation column + docked composer ──
            <>
              <div className="mx-auto max-w-3xl">
                <div className="min-h-[58vh] space-y-5 pb-44 pt-8">
                  <div ref={turnRef} className="space-y-5 scroll-mt-20">
                    {selected ? (
                      <UserTurn question={selected.question} queryType={selected.query_type} />
                    ) : null}

                    {stream.status === 'error' ? (
                      liveRunning ? (
                        <LiveUnavailable
                          title="The live run failed"
                          detail={
                            stream.error ??
                            'The live pipeline hit an error. You can retry, or replay a precomputed example.'
                          }
                          onRetry={onRetryLive}
                          retryLabel="Retry live"
                          onReplayInstead={onReplayInstead}
                        />
                      ) : (
                        <ErrorState error={errorLike(stream.error)} onRetry={onReplay} />
                      )
                    ) : liveBlocked ? (
                      <LiveUnavailable
                        title="Live answering is unavailable"
                        detail="The live LLM endpoint isn’t reachable, so this conversation can’t be re-run live right now. Replay a precomputed example instead, or re-check availability."
                        onRetry={() => void recheckLive()}
                        retryLabel="Re-check live"
                        onReplayInstead={onReplayInstead}
                      />
                    ) : !hasSteps ? (
                      liveRunning ? (
                        <LiveProgress elapsedS={stream.elapsedS} reducedMotion={reducedMotion} />
                      ) : (
                        <StreamingState />
                      )
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
                          compare={retrieval.compare}
                          compareStatus={retrieval.status}
                        />

                        {showAnswer && stream.answer ? (
                          <div id="grounded-answer" className="scroll-mt-20">
                            <AnswerPanel answer={stream.answer} />
                          </div>
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
                  <Composer variant="docked" {...composerProps} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Wrap the stream's error string so `ErrorState` renders a clean message. */
function errorLike(detail: string | null): Error {
  return new Error(detail ?? 'The replay stream failed.')
}
