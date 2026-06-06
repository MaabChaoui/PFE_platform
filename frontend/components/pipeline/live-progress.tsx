'use client'

/**
 * S10e — the LIVE running/generation state.
 *
 * The dispatcher blocks 10–60 s before any trajectory step arrives (the run is
 * post-hoc; see S4), so this is what the jury watches while the model reasons.
 * It is an *engineered* progress surface, not a bare spinner: a breathing orbital
 * glyph, a heartbeat-driven elapsed clock, the pipeline's known stage arc with a
 * decorative sweep, and an indeterminate progress bar.
 *
 * Honesty: we do NOT fabricate a percentage or claim the live stage — the backend
 * gives no mid-run position. The stage row is the pipeline's arc (decorative
 * sweep); exact per-step detail streams in once the run lands and the trajectory
 * animates. The clock is driven by the SSE `heartbeat.elapsed_s`, smoothed by a
 * local tick between beats.
 *
 * Reduced-motion safe: every animation degrades to a static state; the clock then
 * advances only on the 5 s heartbeats (no local interpolation).
 */
import * as React from 'react'
import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

/** The pipeline's known stage arc — shown as a legend with a decorative sweep,
 *  NOT a claim about the live position. */
const STAGES = ['Classify', 'Route', 'Retrieve', 'Recurse', 'Verify', 'Synthesise'] as const

function fmtElapsed(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function LiveProgress({
  elapsedS,
  reducedMotion,
  className,
}: {
  /** Latest `heartbeat.elapsed_s` from the live SSE stream. */
  elapsedS: number
  reducedMotion: boolean
  className?: string
}) {
  // Smooth the heartbeat (every ~5 s) into a ticking clock. The heartbeat is the
  // source of truth (take its max); local ticks fill the gaps.
  const [tick, setTick] = React.useState(elapsedS)
  React.useEffect(() => {
    setTick((t) => Math.max(t, elapsedS))
  }, [elapsedS])
  React.useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => setTick((t) => t + 0.1), 100)
    return () => window.clearInterval(id)
  }, [reducedMotion])

  // Decorative stage sweep (one chip warm at a time). Gated for reduced motion.
  const [sweep, setSweep] = React.useState(0)
  React.useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => setSweep((i) => (i + 1) % STAGES.length), 1300)
    return () => window.clearInterval(id)
  }, [reducedMotion])

  return (
    <section
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]',
        className,
      )}
      aria-live="polite"
      aria-label="Running the live pipeline"
    >
      <div className="relative overflow-hidden rounded-[1.4rem] bg-card/60 p-6 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] md:p-8">
        {/* soft warm wash behind the glyph */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative flex flex-col items-center text-center">
          {/* orbital glyph */}
          <div className="relative grid h-20 w-20 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-ping motion-reduce:hidden"
            />
            <span
              aria-hidden
              className="absolute inset-1.5 rounded-full ring-1 ring-primary/25 motion-safe:animate-pulse-ring"
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/70 border-r-primary/30 motion-safe:animate-spin motion-reduce:border-primary/30 [animation-duration:1.4s]"
            />
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Live · running
          </div>
          <h3 className="mt-1.5 font-display text-2xl tracking-tight">
            Reasoning over the corpus<span className="motion-safe:animate-pulse">…</span>
          </h3>
          <p className="mt-2 max-w-md text-balance text-sm text-muted-foreground">
            The model is routing, retrieving and recursing over the Akoma Ntoso corpus.
            The full reasoning trajectory animates here the moment it lands.
          </p>

          {/* elapsed clock */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
            <span className="nums font-mono text-sm tabular-nums text-foreground/90">
              {fmtElapsed(Math.max(tick, 0))}
            </span>
            <span className="text-[11px] text-muted-foreground">elapsed</span>
          </div>

          {/* indeterminate progress bar */}
          <div className="mt-5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-foreground/[0.06]">
            <div
              aria-hidden
              className="h-full w-1/3 rounded-full bg-gradient-brand motion-safe:animate-live-sweep motion-reduce:w-2/5 motion-reduce:opacity-70"
            />
          </div>

          {/* pipeline stage arc (decorative sweep, not a live position) */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
            {STAGES.map((stage, i) => {
              const warm = !reducedMotion && i === sweep
              return (
                <span
                  key={stage}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-all duration-500 ease-spring',
                    warm
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-foreground/10 bg-foreground/[0.02] text-muted-foreground/70',
                  )}
                >
                  {stage}
                </span>
              )
            })}
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground/60">
            Stage arc is illustrative — exact per-step detail streams with the trajectory.
          </p>
        </div>
      </div>
    </section>
  )
}
