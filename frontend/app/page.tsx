'use client'

import * as React from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { ErrorState } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { AnswerPanel } from '@/components/pipeline/answer-panel'
import { Composer } from '@/components/pipeline/composer'
import { ReasoningTrace } from '@/components/pipeline/reasoning-trace'
import { SessionsRail, SessionsSheet } from '@/components/pipeline/sessions-rail'
import { Telemetry } from '@/components/pipeline/telemetry'
import { isArabic } from '@/components/pipeline/utils'
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

/** Minimal question shape the conversation needs (UserTurn + retrieval seed). It
 *  is reconstructable from a stored Session on restore, so it carries no fields
 *  the history can't provide. */
type ActiveQuestion = { id: string; question: string; query_type: string }

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
  const sessions = useSessionHistory()
  const { createOrTouch, select, remove, clear, newSession, activeId } = sessions

  const [selected, setSelected] = React.useState<ActiveQuestion | null>(null)
  const turnRef = React.useRef<HTMLDivElement>(null)
  // The question currently being run — read fresh by the post-answer enrich
  // effect (no ESLint exhaustive-deps here, so closures must not be trusted).
  const runningRef = React.useRef<{ id: string; label: string } | null>(null)
  const enrichedRunRef = React.useRef(0)

  const finished = stream.status === 'done'
  const playback = useTrajectoryPlayback({
    runId: stream.runId,
    total: stream.steps.length,
    finished,
    reducedMotion,
  })

  // ONE offline retrieval-compare per replayed question (cached, abortable) →
  // feeds the trace's retrieve station with the REAL ranked articles.
  const retrieval = useRetrievalCompare(
    stream.mode === 'replay' ? (selected?.id ?? null) : null,
  )

  // Start a replay for a freshly picked benchmark question + record the session.
  const onPick = React.useCallback(
    (q: QuestionSummary) => {
      runningRef.current = { id: q.id, label: q.question }
      setSelected({ id: q.id, question: q.question, query_type: q.query_type })
      createOrTouch({
        mode: 'replay',
        questionId: q.id,
        label: q.question,
        queryType: q.query_type,
        handler: q.dispatched_handler ?? undefined,
      })
      stream.run({ mode: 'replay', question_id: q.id })
    },
    [createOrTouch, stream],
  )

  // Restore a stored session: re-run its replay and mark it active.
  const onSelectSession = React.useCallback(
    (s: Session) => {
      select(s.id)
      if (!s.questionId) return // forward-design: live sessions (S10e)
      runningRef.current = { id: s.questionId, label: s.label }
      setSelected({ id: s.questionId, question: s.label, query_type: s.queryType ?? 'unknown' })
      stream.run({ mode: 'replay', question_id: s.questionId })
    },
    [select, stream],
  )

  const onReplay = React.useCallback(() => {
    if (selected) stream.run({ mode: 'replay', question_id: selected.id })
  }, [selected, stream])

  // "New session" → empty hero. reset() aborts any in-flight run + returns the
  // stream to idle; clearing the active selection un-highlights the rail.
  const handleNewSession = React.useCallback(() => {
    stream.reset()
    newSession()
    setSelected(null)
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
  // (predicted type + handler actually used). Keyed on runId + read from a ref so
  // a superseded run can never write the wrong values.
  React.useEffect(() => {
    if (
      stream.status === 'done' &&
      stream.answer &&
      stream.runId !== enrichedRunRef.current
    ) {
      enrichedRunRef.current = stream.runId
      const running = runningRef.current
      if (running) {
        createOrTouch({
          mode: 'replay',
          questionId: running.id,
          label: running.label,
          queryType: stream.answer.query_type_predicted,
          handler: stream.answer.handler_used,
        })
      }
    }
  }, [stream.status, stream.runId, stream.answer, createOrTouch])

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
  const hasHistory = sessions.sessions.length > 0
  const hasSteps = stream.steps.length > 0
  const showAnswer = !!stream.answer && finished && playback.isComplete

  const railProps = {
    sessions: sessions.sessions,
    activeId,
    onSelect: onSelectSession,
    onNew: handleNewSession,
    onRemove: handleRemove,
    onClear: handleClear,
  }

  return (
    <div className="relative">
      <AuroraBackdrop soft />
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 md:px-6">
        {hasHistory ? <SessionsRail {...railProps} /> : null}

        <div className="relative min-w-0 flex-1">
          {/* mobile history trigger (the rail is lg-only; this opens the drawer) */}
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

              <Composer variant="hero" selectedId={null} onPick={onPick} className="mt-8 w-full" />

              <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
                Live answering arrives soon — for now, “Try an example” replays the locked run.
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
                  <Composer variant="docked" selectedId={selected?.id ?? null} onPick={onPick} />
                </div>
              </div>
            </>
          )}
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
