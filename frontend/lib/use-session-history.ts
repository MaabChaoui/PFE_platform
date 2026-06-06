'use client'

/**
 * S10d — localStorage-backed chat-session history for the Main visualizer.
 *
 * Persists an ordered list of conversation sessions so the page can behave like a
 * real chatbot side panel: each replayed (and, later, live) question becomes a
 * row you can return to. The newest session sits at the top.
 *
 * Offline-first + SSR-safe:
 *  - Server and the FIRST client render both start from an empty list, so there
 *    is never a hydration mismatch; the stored list is read only AFTER mount.
 *  - Corrupt/absent JSON falls back to an empty list instead of throwing.
 *  - `activeId` is deliberately RUNTIME-only (not persisted): a fresh load shows
 *    the empty hero with no row highlighted, matching the "new chat" feel. The
 *    list itself persists; clicking a row re-runs (restores) that session.
 *
 * The `mode`/`query` fields are forward-design for live answering (S10e); this
 * session only ever creates `mode:'replay'` sessions, so no rework is needed
 * later.
 *
 * A `ref` mirror of the list is the synchronous source of truth for the mutators
 * — React's state updater may run lazily (and twice under StrictMode), so reading
 * `ref.current` keeps `createOrTouch` correct and lets it return the resolved
 * session id without depending on a flushed render.
 */
import * as React from 'react'

export interface Session {
  id: string
  mode: 'replay' | 'live'
  /** Benchmark question id (replay) — the de-dupe / restore key. */
  questionId?: string
  /** Free-text query (live; forward-design). */
  query?: string
  /** Display label — the question text (RTL-aware at render). */
  label: string
  /** Predicted/gold query type, for the row subtitle. */
  queryType?: string
  /** Dispatched handler, for the row subtitle. */
  handler?: string
  createdAt: number
  lastRunAt: number
}

/** The caller-supplied shape; ids + timestamps are managed by the store. */
export type SessionInput = {
  mode: 'replay' | 'live'
  label: string
  questionId?: string
  query?: string
  queryType?: string
  handler?: string
  /** Optional explicit id (otherwise generated). */
  id?: string
}

const STORAGE_KEY = 'lexalgeria.sessions.v1'

interface PersistShape {
  v: 1
  sessions: Session[]
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    (s.mode === 'replay' || s.mode === 'live') &&
    typeof s.createdAt === 'number' &&
    typeof s.lastRunAt === 'number'
  )
}

function readStore(): Session[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<PersistShape> | null
    if (!parsed || !Array.isArray(parsed.sessions)) return []
    return parsed.sessions.filter(isSession)
  } catch {
    return []
  }
}

function writeStore(sessions: Session[]): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistShape = { v: 1, sessions }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private-mode — keep working in-memory */
  }
}

export interface SessionHistory {
  sessions: Session[]
  activeId: string | null
  /** True once the stored list has been read (post-mount). */
  hydrated: boolean
  /** Upsert by `questionId` (replay): existing → touch + move to top; else create. */
  createOrTouch: (input: SessionInput) => Session
  select: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  rename: (id: string, label: string) => void
  /** Clear the active selection (the page also resets the stream → empty hero). */
  newSession: () => void
}

export function useSessionHistory(): SessionHistory {
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)
  const ref = React.useRef<Session[]>([])

  // Hydrate from localStorage AFTER mount — server + first client render are
  // both empty (no mismatch); the real list resolves on the next paint.
  React.useEffect(() => {
    const stored = readStore()
    ref.current = stored
    setSessions(stored)
    setHydrated(true)
  }, [])

  // Keep the ref (synchronous truth), the rendered state, and localStorage in
  // lockstep on every mutation.
  const commit = React.useCallback((next: Session[]) => {
    ref.current = next
    setSessions(next)
    writeStore(next)
  }, [])

  const createOrTouch = React.useCallback(
    (input: SessionInput): Session => {
      const now = Date.now()
      const prev = ref.current
      const idx =
        input.questionId != null
          ? prev.findIndex(
              (s) => s.mode === input.mode && s.questionId === input.questionId,
            )
          : -1

      let session: Session
      let next: Session[]
      if (idx >= 0) {
        const existing = prev[idx]
        session = {
          ...existing,
          ...input,
          id: existing.id,
          createdAt: existing.createdAt,
          lastRunAt: now,
        }
        next = [session, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
      } else {
        session = {
          ...input,
          id: input.id ?? makeId(),
          createdAt: now,
          lastRunAt: now,
        }
        next = [session, ...prev]
      }
      commit(next)
      setActiveId(session.id)
      return session
    },
    [commit],
  )

  const select = React.useCallback((id: string) => setActiveId(id), [])

  const remove = React.useCallback(
    (id: string) => {
      commit(ref.current.filter((s) => s.id !== id))
      setActiveId((cur) => (cur === id ? null : cur))
    },
    [commit],
  )

  const clear = React.useCallback(() => {
    commit([])
    setActiveId(null)
  }, [commit])

  const rename = React.useCallback(
    (id: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      commit(ref.current.map((s) => (s.id === id ? { ...s, label: trimmed } : s)))
    },
    [commit],
  )

  const newSession = React.useCallback(() => setActiveId(null), [])

  return {
    sessions,
    activeId,
    hydrated,
    createOrTouch,
    select,
    remove,
    clear,
    rename,
    newSession,
  }
}
