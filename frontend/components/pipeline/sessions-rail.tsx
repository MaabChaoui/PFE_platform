'use client'

/**
 * S10d — the conversation history side panel for the Main visualizer.
 *
 * This replaces the S10b placeholder `SessionsRail` (ghost rows) with a real,
 * contractible chat-history panel backed by `useSessionHistory` (localStorage).
 * It is page-local on purpose: the GLOBAL `AppSidebar` (layout.tsx) stays product
 * nav; conversation history lives next to the conversation column.
 *
 *  - `SessionsRail`  — the desktop (lg+) sticky column. Collapses to a slim icon
 *    rail; the collapsed state is persisted to localStorage and the width
 *    animates with the shared `ease-spring` token (reduced-motion → instant).
 *  - `SessionsSheet` — the < lg drawer: a trigger button + a left `Sheet` that
 *    renders the same list (reuses the existing Sheet, NOT react-popover).
 *
 * Labels are auto-dir (Arabic → RTL + Arabic font, Latin → LTR), mirroring the
 * benchmark picker. Motion is GPU-safe and `motion-reduce:` gated throughout.
 */
import * as React from 'react'
import {
  History,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { humanize } from '@/lib/format'
import type { Session } from '@/lib/use-session-history'
import { cn } from '@/lib/utils'

import { isArabic } from './utils'

const COLLAPSE_KEY = 'lexalgeria.sessions.collapsed.v1'

// ───────────────────────── persisted collapse flag ─────────────────────────

/** SSR-safe persisted boolean: starts from `initial` (matching the server),
 *  resolves the stored value after mount, and writes through on change. */
function usePersistentBoolean(
  key: string,
  initial: boolean,
): readonly [boolean, (value: boolean) => void] {
  const [value, setValue] = React.useState(initial)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw != null) setValue(raw === '1')
    } catch {
      /* ignore */
    }
  }, [key])

  const set = React.useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    [key],
  )

  return [value, set] as const
}

// ───────────────────────── relative time ─────────────────────────

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.round(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ───────────────────────── shared view props ─────────────────────────

export interface SessionsViewProps {
  sessions: Session[]
  activeId: string | null
  onSelect: (session: Session) => void
  onNew: () => void
  onRemove: (id: string) => void
  onClear: () => void
}

// ───────────────────────── a single row ─────────────────────────

function SessionRow({
  session,
  active,
  onSelect,
  onRemove,
}: {
  session: Session
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const rtl = isArabic(session.label)
  const subtitle = [
    session.queryType ? humanize(session.queryType) : null,
    session.handler ? humanize(session.handler) : null,
  ].filter(Boolean) as string[]

  return (
    <div className="group/row relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'w-full rounded-xl border px-3 py-2.5 pr-9 text-left transition-all duration-300 ease-spring motion-reduce:transition-none',
          active
            ? 'border-primary/50 bg-primary/[0.07] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]'
            : 'border-foreground/[0.08] bg-card/40 hover:-translate-y-px hover:border-foreground/20',
        )}
      >
        <p
          dir={rtl ? 'rtl' : undefined}
          className={cn(
            'line-clamp-2 text-[13px] leading-snug text-foreground/85',
            rtl ? 'text-right font-arabic' : 'text-left',
          )}
        >
          {session.label}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}
          {subtitle.length ? (
            <span className="truncate font-mono uppercase tracking-[0.08em]">
              {subtitle.join(' · ')}
            </span>
          ) : null}
          <span className="nums ml-auto shrink-0">{formatRelative(session.lastRunAt)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Delete session"
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-muted-foreground/45 opacity-0 transition-opacity duration-200 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ───────────────────────── the expanded panel body ─────────────────────────

function PanelInner({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRemove,
  onClear,
  onCollapse,
  hideHeader,
}: SessionsViewProps & {
  onCollapse?: () => void
  hideHeader?: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {hideHeader ? null : (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <MessagesSquare className="h-3.5 w-3.5" />
            Sessions
          </span>
          <div className="flex items-center gap-1.5">
            {sessions.length > 0 ? (
              <Badge variant="muted" className="nums font-mono text-[10px]">
                {sessions.length}
              </Badge>
            ) : null}
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                aria-label="Collapse sessions"
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onNew}
        className="group mt-3 flex w-full items-center gap-2 rounded-xl border border-foreground/12 bg-foreground/[0.03] px-3 py-2 text-xs font-medium text-foreground/85 transition-all duration-300 ease-spring hover:border-primary/40 hover:bg-foreground/[0.06] active:scale-[0.99] motion-reduce:transition-none"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-sm transition-transform duration-300 ease-spring group-hover:scale-105 motion-reduce:transition-none">
          <Plus className="h-3 w-3" />
        </span>
        New session
      </button>

      <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-3 py-8 text-center">
            <MessagesSquare className="mx-auto h-5 w-5 text-muted-foreground/40" />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
              No sessions yet. Replay a benchmark question and it will stack here for
              side-by-side comparison.
            </p>
          </div>
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={() => onSelect(s)}
              onRemove={() => onRemove(s.id)}
            />
          ))
        )}
      </div>

      {sessions.length > 0 ? (
        <div className="mt-2 border-t border-foreground/[0.07] pt-2">
          <button
            type="button"
            onClick={onClear}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ───────────────────────── collapsed icon rail ─────────────────────────

function CollapsedRail({
  count,
  onExpand,
  onNew,
}: {
  count: number
  onExpand: () => void
  onNew: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sessions"
        className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <PanelLeftOpen className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onNew}
        aria-label="New session"
        className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-sm transition-transform duration-300 ease-spring hover:scale-105 active:scale-95 motion-reduce:transition-none"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="mt-1 flex flex-col items-center gap-1 text-muted-foreground/50">
        <MessagesSquare className="h-4 w-4" />
        {count > 0 ? <span className="nums font-mono text-[10px]">{count}</span> : null}
      </div>
    </div>
  )
}

// ───────────────────────── desktop sticky rail ─────────────────────────

export function SessionsRail(props: SessionsViewProps) {
  const [collapsed, setCollapsed] = usePersistentBoolean(COLLAPSE_KEY, false)

  return (
    <aside
      className={cn(
        'hidden shrink-0 transition-[width] duration-500 ease-spring motion-reduce:transition-none lg:block',
        collapsed ? 'w-[3.25rem]' : 'w-[252px]',
      )}
    >
      <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-[1.4rem] border border-foreground/[0.08] bg-card/50 p-3">
        {collapsed ? (
          <CollapsedRail
            count={props.sessions.length}
            onExpand={() => setCollapsed(false)}
            onNew={props.onNew}
          />
        ) : (
          <PanelInner {...props} onCollapse={() => setCollapsed(true)} />
        )}
      </div>
    </aside>
  )
}

// ───────────────────────── mobile drawer ─────────────────────────

export function SessionsSheet(props: SessionsViewProps & { className?: string }) {
  const { className, ...view } = props
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] py-1.5 pl-3 pr-3 text-xs font-medium text-foreground/85 transition-all duration-300 ease-spring hover:border-primary/40 hover:bg-foreground/[0.07] active:scale-[0.98] motion-reduce:transition-none',
            className,
          )}
        >
          <History className="h-3.5 w-3.5 text-primary" />
          Sessions
          {view.sessions.length > 0 ? (
            <Badge variant="muted" className="nums font-mono text-[10px]">
              {view.sessions.length}
            </Badge>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[88vw] max-w-[330px] flex-col gap-4 p-4">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
            <MessagesSquare className="h-4 w-4 text-primary" />
            Sessions
          </SheetTitle>
          <SheetDescription>
            Your replayed conversations — pick one to restore it.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          <PanelInner
            {...view}
            hideHeader
            onSelect={(s) => {
              view.onSelect(s)
              setOpen(false)
            }}
            onNew={() => {
              view.onNew()
              setOpen(false)
            }}
          />
        </div>
        <SheetClose className="sr-only">Close</SheetClose>
      </SheetContent>
    </Sheet>
  )
}
