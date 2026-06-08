'use client'

/**
 * S10a — the pipeline-stream + playback hooks for the Main visualizer.
 *
 * `usePipelineStream` wraps `streamAnswer` (lib/sse): it issues ONE run, collects
 * `step` events in arrival order, tracks `status` (idle | running | done | error),
 * and exposes the final `answer` + replay `scores`. It owns an AbortController —
 * re-running or unmounting cancels the in-flight stream cleanly — and ignores
 * late callbacks from a superseded run via a monotonic run nonce.
 *
 * It is deliberately mode-agnostic: `run(req)` takes a full `StreamRequest`, so
 * S10b can call `run({ mode: 'live', query, options })` with no rewrite — the
 * heartbeat → `elapsedS` plumbing for the live wait is already here.
 *
 * `useTrajectoryPlayback` is a SEPARATE concern: it animates a client-side cursor
 * across the collected steps (play / pause / step / restart), decoupled from the
 * ~60 ms network pacing so the subway-map walk is smooth and user-controllable.
 * The answer panel is revealed on *playback* completion, not network `done`, so
 * the answer never pops in while the trajectory is still drawing.
 */
import * as React from 'react'

import { streamAnswer } from './sse'
import type {
  AnswerResponse,
  ReplayScores,
  StepEvent,
  StreamRequest,
} from './types'

// ───────────────────────── stream hook ─────────────────────────

export type PipelineStatus = 'idle' | 'running' | 'done' | 'error'

interface StreamState {
  status: PipelineStatus
  steps: StepEvent[]
  answer: AnswerResponse | null
  scores: ReplayScores | null
  error: string | null
  mode: StreamRequest['mode'] | null
  /** Heartbeat elapsed seconds (live runs); 0 for replay. */
  elapsedS: number
  request: StreamRequest | null
  /** Monotonic per-run nonce — drives playback reset (NOT the question id, so
   *  replaying the SAME question restarts the animation). */
  runId: number
}

type StreamAction =
  | { type: 'RUN'; request: StreamRequest; runId: number }
  | { type: 'STEP'; event: StepEvent }
  | { type: 'HEARTBEAT'; elapsed: number }
  | { type: 'ANSWER'; answer: AnswerResponse; scores: ReplayScores | null }
  | { type: 'DONE' }
  | { type: 'ERROR'; detail: string }
  | { type: 'RECONNECT' }
  | { type: 'RESET' }

const IDLE: StreamState = {
  status: 'idle',
  steps: [],
  answer: null,
  scores: null,
  error: null,
  mode: null,
  elapsedS: 0,
  request: null,
  runId: 0,
}

function reducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'RUN':
      return {
        ...IDLE,
        status: 'running',
        mode: action.request.mode,
        request: action.request,
        runId: action.runId,
      }
    case 'STEP':
      if (state.status !== 'running') return state
      return { ...state, steps: [...state.steps, action.event] }
    case 'HEARTBEAT':
      return { ...state, elapsedS: action.elapsed }
    case 'ANSWER':
      return { ...state, answer: action.answer, scores: action.scores }
    case 'DONE':
      // `error` is stream-terminal with no trailing `done`, so a DONE only ever
      // promotes a running stream to done.
      return state.status === 'running' ? { ...state, status: 'done' } : state
    case 'ERROR':
      return { ...state, status: 'error', error: action.detail }
    case 'RECONNECT':
      // A transient transport drop is being retried: drop the partially-streamed
      // steps so the re-stream renders cleanly, keep the same run (runId/mode).
      return { ...state, steps: [], elapsedS: 0, status: 'running' }
    case 'RESET':
      return { ...IDLE, runId: state.runId }
    default:
      return state
  }
}

export interface UsePipelineStream extends StreamState {
  run: (request: StreamRequest) => void
  reset: () => void
  cancel: () => void
}

export interface UsePipelineStreamOptions {
  /** Notified when a transient transport drop is being retried (1-based attempt)
   *  so the page can toast "Reconnecting…". */
  onReconnect?: (attempt: number) => void
}

export function usePipelineStream(
  opts: UsePipelineStreamOptions = {},
): UsePipelineStream {
  const [state, dispatch] = React.useReducer(reducer, IDLE)
  const abortRef = React.useRef<AbortController | null>(null)
  const runCounter = React.useRef(0)
  // Keep the latest onReconnect in a ref so `run` stays stable (identity-safe).
  const onReconnectRef = React.useRef(opts.onReconnect)
  onReconnectRef.current = opts.onReconnect

  const run = React.useCallback((request: StreamRequest) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const myRun = ++runCounter.current
    const fresh = () => myRun === runCounter.current
    dispatch({ type: 'RUN', request, runId: myRun })

    void streamAnswer(request, {
      signal: controller.signal,
      onStep: (event) => {
        if (fresh()) dispatch({ type: 'STEP', event })
      },
      onHeartbeat: (event) => {
        if (fresh()) dispatch({ type: 'HEARTBEAT', elapsed: event.elapsed_s })
      },
      onAnswer: (event) => {
        if (fresh())
          dispatch({ type: 'ANSWER', answer: event, scores: event.scores ?? null })
      },
      onError: (event) => {
        if (fresh()) dispatch({ type: 'ERROR', detail: event.detail })
      },
      onDone: () => {
        if (fresh()) dispatch({ type: 'DONE' })
      },
      onReconnect: (attempt) => {
        if (fresh()) {
          dispatch({ type: 'RECONNECT' })
          onReconnectRef.current?.(attempt)
        }
      },
    })
  }, [])

  const cancel = React.useCallback(() => {
    runCounter.current += 1 // invalidate in-flight callbacks
    abortRef.current?.abort()
  }, [])

  const reset = React.useCallback(() => {
    cancel()
    dispatch({ type: 'RESET' })
  }, [cancel])

  // Abort any open stream on unmount.
  React.useEffect(() => () => abortRef.current?.abort(), [])

  return { ...state, run, reset, cancel }
}

// ───────────────────────── playback hook ─────────────────────────

export interface TrajectoryPlayback {
  /** Number of revealed steps (0..total). */
  cursor: number
  total: number
  /** Index of the most-recently revealed (active) step, or -1. */
  activeIndex: number
  playing: boolean
  /** Every available step revealed AND the stream finished. */
  isComplete: boolean
  hasStarted: boolean
  play: () => void
  pause: () => void
  stepForward: () => void
  restart: () => void
  jumpToEnd: () => void
}

const DEFAULT_STEP_MS = 620

export function useTrajectoryPlayback(args: {
  /** Per-run nonce from `usePipelineStream` — a change resets playback. */
  runId: number
  total: number
  /** status === 'done'. */
  finished: boolean
  reducedMotion: boolean
  autoPlay?: boolean
  stepMs?: number
}): TrajectoryPlayback {
  const {
    runId,
    total,
    finished,
    reducedMotion,
    autoPlay = true,
    stepMs = DEFAULT_STEP_MS,
  } = args

  const [cursor, setCursor] = React.useState(0)
  const [playing, setPlaying] = React.useState(autoPlay)

  // Reset on every new run (nonce change), not on questionId — replaying the
  // same question must restart the walk.
  React.useEffect(() => {
    setCursor(0)
    setPlaying(autoPlay)
  }, [runId, autoPlay])

  // Advance the cursor. Reduced motion jumps straight to the end (no walk).
  // Reaching the true end (all steps revealed AND stream finished) stops
  // playback so the active card can auto-expand and Play cleanly restarts.
  React.useEffect(() => {
    if (reducedMotion) {
      if (cursor < total) setCursor(total)
      else if (playing && finished) setPlaying(false)
      return
    }
    if (cursor >= total) {
      if (playing && finished) setPlaying(false)
      return
    }
    if (!playing) return
    const id = window.setTimeout(
      () => setCursor((c) => Math.min(c + 1, total)),
      stepMs,
    )
    return () => window.clearTimeout(id)
  }, [playing, cursor, total, finished, reducedMotion, stepMs])

  const isComplete = finished && cursor >= total
  const atEnd = finished && total > 0 && cursor >= total

  const play = React.useCallback(() => {
    if (atEnd) setCursor(0) // re-play a finished walk from the top
    setPlaying(true)
  }, [atEnd])

  const pause = React.useCallback(() => setPlaying(false), [])

  const stepForward = React.useCallback(() => {
    setPlaying(false)
    setCursor((c) => Math.min(c + 1, total))
  }, [total])

  const restart = React.useCallback(() => {
    setCursor(0)
    setPlaying(true)
  }, [])

  const jumpToEnd = React.useCallback(() => {
    setPlaying(false)
    setCursor(total)
  }, [total])

  return {
    cursor,
    total,
    activeIndex: cursor - 1,
    playing,
    isComplete,
    hasStarted: cursor > 0 || total > 0,
    play,
    pause,
    stepForward,
    restart,
    jumpToEnd,
  }
}

// ───────────────────────── reduced motion ─────────────────────────

/** SSR-safe `prefers-reduced-motion`. Initialises `false` (matching the server
 *  render) and resolves the real value after mount to avoid a hydration mismatch. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}
