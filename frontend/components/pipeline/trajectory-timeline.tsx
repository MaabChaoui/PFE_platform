'use client'

import * as React from 'react'
import {
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  StepForward,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { StepEvent } from '@/lib/types'

import { StepCard } from './step-card'
import {
  ACCENT_DOT,
  ACCENT_TEXT,
  PHASE_META,
  stepMeta,
  type Accent,
} from './utils'

// ───────────────────────── small parts ─────────────────────────

type DotState = 'future' | 'past' | 'active'

function StationDot({
  accent,
  state,
}: {
  accent: Accent
  state: DotState
}) {
  return (
    <span className="relative grid h-3.5 w-3.5 place-items-center">
      {state === 'active' ? (
        <span className="absolute inline-flex h-6 w-6 rounded-full bg-primary/25 motion-safe:animate-pulse-ring motion-reduce:hidden" />
      ) : null}
      <span
        className={cn(
          'relative h-3.5 w-3.5 rounded-full transition-all duration-500 ease-spring',
          state === 'future' &&
            'border border-foreground/25 bg-card',
          state === 'past' && cn(ACCENT_DOT[accent], 'scale-90'),
          state === 'active' &&
            'bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]',
        )}
      />
    </span>
  )
}

/** Compact descent meter: `max` ticks, the first `depth` filled. */
function DepthMeter({
  depth,
  max,
  lit,
}: {
  depth: number
  max: number
  lit: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Recursion depth ${depth} of ${max}`}
    >
      <span
        className={cn(
          'font-mono text-[10px] font-semibold tabular-nums',
          lit ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        D{depth}
      </span>
      <span className="flex items-end gap-0.5" aria-hidden>
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-full transition-colors duration-500 ease-spring',
              i < depth
                ? lit
                  ? 'bg-primary'
                  : 'bg-foreground/30'
                : 'bg-foreground/10',
            )}
            style={{ height: `${5 + i * 3}px` }}
          />
        ))}
      </span>
    </span>
  )
}

// ───────────────────────── one row ─────────────────────────

interface RowModel {
  event: StepEvent
  index: number
}

function TimelineRow({
  row,
  activeIndex,
  isFirst,
  isLast,
  indentPx,
  meter,
  open,
  onToggle,
}: {
  row: RowModel
  activeIndex: number
  isFirst: boolean
  isLast: boolean
  indentPx: number
  meter?: { depth: number; max: number }
  open: boolean
  onToggle: () => void
}) {
  const { event, index } = row
  const accent = PHASE_META[stepMeta(event.step).phase].accent
  const reached = index <= activeIndex
  const reachedNext = index < activeIndex
  const state: DotState =
    index === activeIndex ? 'active' : reached ? 'past' : 'future'

  return (
    <li className="relative flex gap-3.5">
      {/* spine column */}
      <div className="relative w-4 shrink-0">
        {!isFirst ? (
          <span
            className={cn(
              'absolute left-1/2 top-0 h-[18px] w-px -translate-x-1/2 transition-colors duration-500 ease-spring',
              reached ? 'bg-primary/55' : 'bg-foreground/12',
            )}
          />
        ) : null}
        {!isLast ? (
          <span
            className={cn(
              'absolute bottom-0 left-1/2 top-[18px] w-px -translate-x-1/2 transition-colors duration-500 ease-spring',
              reachedNext ? 'bg-primary/55' : 'bg-foreground/12',
            )}
          />
        ) : null}
        <span className="absolute left-1/2 top-[11px] -translate-x-1/2">
          <StationDot accent={accent} state={state} />
        </span>
      </div>

      {/* content */}
      <div
        className="min-w-0 flex-1 pb-3 transition-[margin] duration-500 ease-spring"
        style={{ marginInlineStart: indentPx }}
      >
        {meter ? (
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-3 bg-primary/40" aria-hidden />
            <DepthMeter depth={meter.depth} max={meter.max} lit={reached} />
          </div>
        ) : null}
        <StepCard
          event={event}
          open={open}
          onToggle={onToggle}
          dim={index > activeIndex}
        />
      </div>
    </li>
  )
}

// ───────────────────────── recursion bracket ─────────────────────────

function RecursionBracket({
  rows,
  activeIndex,
  maxDepth,
  children,
}: {
  rows: RowModel[]
  activeIndex: number
  maxDepth: number
  children: React.ReactNode
}) {
  const reachedDepth = rows.reduce(
    (acc, r) => (r.index <= activeIndex ? Math.max(acc, r.event.depth) : acc),
    0,
  )
  return (
    <div className="relative my-1 rounded-2xl bg-primary/[0.04] p-2 ring-1 ring-primary/15">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Recursive descent
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: maxDepth }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'rounded px-1 py-0.5 font-mono text-[9px] font-semibold transition-colors duration-500 ease-spring',
                i < reachedDepth
                  ? 'bg-primary/20 text-primary'
                  : 'bg-foreground/[0.05] text-muted-foreground/70',
              )}
            >
              D{i + 1}
            </span>
          ))}
        </span>
      </div>
      <ol className="px-1">{children}</ol>
    </div>
  )
}

// ───────────────────────── controls ─────────────────────────

function ControlButton({
  onClick,
  disabled,
  label,
  children,
  primary,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  children: React.ReactNode
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid place-items-center rounded-lg transition-all duration-300 ease-spring active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40',
        primary
          ? 'h-9 w-9 bg-gradient-brand text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110'
          : 'h-9 w-9 border border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/25 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// ───────────────────────── grouping ─────────────────────────

type Group =
  | { kind: 'step'; row: RowModel }
  | { kind: 'recurse'; rows: RowModel[]; maxDepth: number }

function groupRows(steps: StepEvent[]): Group[] {
  const groups: Group[] = []
  let i = 0
  while (i < steps.length) {
    const isRecurse = stepMeta(steps[i].step).phase === 'recurse'
    if (!isRecurse) {
      groups.push({ kind: 'step', row: { event: steps[i], index: i } })
      i += 1
      continue
    }
    const rows: RowModel[] = []
    while (i < steps.length && stepMeta(steps[i].step).phase === 'recurse') {
      rows.push({ event: steps[i], index: i })
      i += 1
    }
    const maxDepth = Math.max(1, ...rows.map((r) => r.event.depth))
    groups.push({ kind: 'recurse', rows, maxDepth })
  }
  return groups
}

// ───────────────────────── timeline ─────────────────────────

export interface TrajectoryTimelineProps {
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
  className?: string
}

/**
 * THE HERO. An engineered subway-map of the dispatcher trajectory: a continuous
 * spine of stations that lights up as a client-paced cursor walks it, with the
 * gap-driven recursion run rendered as a tinted "descent" bracket — staircase
 * indent + per-step depth meter + a lit depth axis — so recursion depth 1→3 is
 * unmistakable. Steps expand to their raw `detail`. Play / pause / step / restart
 * drive the walk; reduced motion collapses it to an instant, stepped reveal.
 */
export function TrajectoryTimeline({
  steps,
  cursor,
  activeIndex,
  total,
  playing,
  isComplete,
  onPlay,
  onPause,
  onStep,
  onRestart,
  onJumpEnd,
  className,
}: TrajectoryTimelineProps) {
  // A user-pinned step overrides the follow-the-walk auto-expand.
  const [pinned, setPinned] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (cursor === 0) setPinned(null)
  }, [cursor])

  const openIndex =
    pinned !== null ? pinned : !playing && activeIndex >= 0 ? activeIndex : -1
  const toggle = (i: number) =>
    setPinned((p) => (p === i ? null : i))

  const groups = React.useMemo(() => groupRows(steps), [steps])
  const activeMeta = activeIndex >= 0 ? stepMeta(steps[activeIndex]?.step ?? '') : null
  const activePhase = activeMeta ? PHASE_META[activeMeta.phase] : null

  return (
    <div
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="rounded-[1.4rem] bg-card/60 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
        {/* controls header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/[0.07] px-4 py-3 md:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="font-mono text-primary">00</span>
              <span className="h-px w-5 bg-foreground/15" />
              Reasoning trajectory
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="nums font-mono text-sm text-foreground">
                {Math.min(cursor, total)} / {total || '—'}
              </span>
              {activePhase ? (
                <span
                  className={cn(
                    'text-xs font-medium',
                    ACCENT_TEXT[activePhase.accent],
                  )}
                >
                  · {activePhase.label}
                </span>
              ) : isComplete ? (
                <span className="text-xs font-medium text-success">
                  · complete
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ControlButton
              onClick={onRestart}
              disabled={total === 0}
              label="Restart"
            >
              <RotateCcw className="h-4 w-4" />
            </ControlButton>
            <ControlButton
              onClick={onStep}
              disabled={total === 0 || cursor >= total}
              label="Step forward"
            >
              <StepForward className="h-4 w-4" />
            </ControlButton>
            <ControlButton
              onClick={playing ? onPause : onPlay}
              disabled={total === 0}
              label={playing ? 'Pause' : 'Play'}
              primary
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </ControlButton>
            <ControlButton
              onClick={onJumpEnd}
              disabled={total === 0 || cursor >= total}
              label="Skip to end"
            >
              <SkipForward className="h-4 w-4" />
            </ControlButton>
          </div>
        </div>

        {/* the map */}
        <ol className="px-4 py-4 md:px-5 md:py-5">
          {groups.map((group, gi) => {
            if (group.kind === 'step') {
              const { row } = group
              return (
                <TimelineRow
                  key={`s-${row.index}`}
                  row={row}
                  activeIndex={activeIndex}
                  isFirst={row.index === 0}
                  isLast={row.index === steps.length - 1}
                  indentPx={0}
                  open={openIndex === row.index}
                  onToggle={() => toggle(row.index)}
                />
              )
            }
            return (
              <li key={`r-${gi}`} className="relative">
                <RecursionBracket
                  rows={group.rows}
                  activeIndex={activeIndex}
                  maxDepth={group.maxDepth}
                >
                  {group.rows.map((row) => (
                    <TimelineRow
                      key={`s-${row.index}`}
                      row={row}
                      activeIndex={activeIndex}
                      isFirst={row.index === 0}
                      isLast={row.index === steps.length - 1}
                      indentPx={Math.max(0, row.event.depth - 1) * 22}
                      meter={{ depth: row.event.depth, max: group.maxDepth }}
                      open={openIndex === row.index}
                      onToggle={() => toggle(row.index)}
                    />
                  ))}
                </RecursionBracket>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
