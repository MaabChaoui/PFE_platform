'use client'

import * as React from 'react'
import {
  ChevronDown,
  FlaskConical,
  Loader2,
  Radar,
  Sparkles,
  Star,
} from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { cn } from '@/lib/utils'
import type { Candidate, Channel, CompareResponse } from '@/lib/types'

import { isArabic } from './utils'

export type CompareStatus = 'idle' | 'loading' | 'done' | 'error'

const DISPLAY_TOP = 6

// ───────────────────────── helpers ─────────────────────────

function candKey(c: { doc_id: string; article_ref: string }): string {
  return `${c.doc_id}#${c.article_ref}`
}

function rankMap(channel?: Channel): Map<string, number> {
  const m = new Map<string, number>()
  channel?.candidates.forEach((c) => m.set(candKey(c), c.rank))
  return m
}

/** Retrieval scores span very different ranges per channel (BM25 ≫ cosine ≫
 *  RRF), so format adaptively and never compare across channels. */
function fmtCandScore(s: number): string {
  if (!Number.isFinite(s)) return '—'
  const a = Math.abs(s)
  if (a >= 100) return s.toFixed(0)
  if (a >= 10) return s.toFixed(1)
  return s.toFixed(3)
}

/** Does any candidate across the live channels carry the gold flag? */
function anyGoldShown(channels: Array<Channel | undefined>): boolean {
  return channels.some((ch) => ch?.candidates.some((c) => c.is_gold))
}

interface ChannelMeta {
  label: string
  sub: string
  icon: typeof Radar
}

const CHANNEL_META: Record<string, ChannelMeta> = {
  bm25: { label: 'BM25', sub: 'sparse · lexical', icon: Radar },
  dense: { label: 'Dense', sub: 'semantic · multilingual-e5', icon: Sparkles },
  hybrid: { label: 'Hybrid', sub: 'RRF fusion', icon: Sparkles },
  hybrid_rerank: {
    label: 'Hybrid + Rerank',
    sub: 'cross-encoder re-scoring',
    icon: FlaskConical,
  },
}

// ───────────────────────── one ranked row ─────────────────────────

function RankRow({
  cand,
  maxScore,
  grown,
  contributing,
}: {
  cand: Candidate
  maxScore: number
  grown: boolean
  contributing?: { bm25?: number; dense?: number }
}) {
  const [open, setOpen] = React.useState(false)
  const snippet = cand.snippet?.trim() ?? ''
  const hasSnippet = snippet.length > 0
  const pct = maxScore > 0 ? Math.max(5, Math.round((cand.score / maxScore) * 100)) : 0
  const titleRtl = isArabic(cand.doc_title)

  return (
    <li
      className={cn(
        'overflow-hidden rounded-lg border transition-colors duration-300 ease-spring',
        cand.is_gold
          ? 'border-gold/45 bg-gold/[0.06] shadow-[inset_0_1px_0_0_hsl(var(--gold)/0.18)]'
          : 'border-foreground/[0.06] bg-foreground/[0.015] hover:border-foreground/15',
      )}
    >
      <button
        type="button"
        onClick={() => hasSnippet && setOpen((o) => !o)}
        aria-expanded={hasSnippet ? open : undefined}
        className={cn(
          'flex w-full flex-col gap-1.5 px-2.5 py-2 text-left',
          !hasSnippet && 'cursor-default',
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-semibold tabular-nums',
              cand.is_gold
                ? 'bg-gold/20 text-gold'
                : 'bg-foreground/[0.06] text-muted-foreground',
            )}
          >
            {cand.rank}
          </span>
          <span className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-foreground/85">
            {cand.article_ref}
          </span>
          {cand.is_gold ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-gold/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold">
              <Star className="h-2.5 w-2.5 fill-current" />
              gold
            </span>
          ) : null}
          <span className="ml-auto nums font-mono text-[11px] tabular-nums text-foreground/75">
            {fmtCandScore(cand.score)}
          </span>
          {hasSnippet ? (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-500 ease-spring',
                open && 'rotate-180',
              )}
            />
          ) : null}
        </div>

        {/* normalised score bar (within-channel) */}
        <span className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-700 ease-spring motion-reduce:transition-none',
              cand.is_gold ? 'bg-gold/75' : 'bg-primary/45',
            )}
            style={{ width: `${grown ? pct : 0}%` }}
          />
        </span>

        <div className="flex items-center justify-between gap-2">
          {titleRtl ? (
            <ArabicText as="span" lines={1} className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
              {cand.doc_title}
            </ArabicText>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-muted-foreground">
              {cand.doc_title}
            </span>
          )}
          {contributing ? (
            <span
              className="shrink-0 font-mono text-[10px] text-muted-foreground/70"
              title="Rank in each input channel before fusion"
            >
              BM25 {contributing.bm25 ? `#${contributing.bm25}` : '—'} · Dense{' '}
              {contributing.dense ? `#${contributing.dense}` : '—'}
            </span>
          ) : null}
        </div>
      </button>

      {hasSnippet ? (
        <div
          className={cn(
            'grid transition-all duration-500 ease-spring motion-reduce:transition-none',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <ArabicText className="border-t border-foreground/[0.07] bg-background/30 px-2.5 py-2 text-[12.5px] leading-relaxed text-foreground/80">
              {snippet}
            </ArabicText>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// ───────────────────────── one channel card ─────────────────────────

function ChannelCard({
  channel,
  tone = 'neutral',
  badge,
  bm25Ranks,
  denseRanks,
}: {
  channel: Channel
  tone?: 'neutral' | 'live' | 'baseline'
  badge?: { label: string; className: string }
  /** Provided only for the fused channel → renders contributing input ranks. */
  bm25Ranks?: Map<string, number>
  denseRanks?: Map<string, number>
}) {
  const [showAll, setShowAll] = React.useState(false)
  const [grown, setGrown] = React.useState(false)
  React.useEffect(() => {
    const id = window.requestAnimationFrame(() => setGrown(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const meta = CHANNEL_META[channel.name] ?? {
    label: channel.name,
    sub: '',
    icon: Radar,
  }
  const Icon = meta.icon
  const cands = channel.candidates
  const maxScore = cands.reduce((m, c) => Math.max(m, c.score), 0) || 1
  const shown = showAll ? cands : cands.slice(0, DISPLAY_TOP)

  return (
    <div
      className={cn(
        'rounded-[1.1rem] p-1 ring-1',
        tone === 'live'
          ? 'bg-primary/[0.04] ring-primary/20'
          : tone === 'baseline'
            ? 'bg-foreground/[0.02] ring-foreground/[0.07]'
            : 'bg-foreground/[0.02] ring-foreground/[0.06]',
      )}
    >
      <div className="rounded-[0.8rem] bg-card/60 p-2.5 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-lg',
              tone === 'live'
                ? 'bg-primary/12 text-primary'
                : 'bg-foreground/[0.06] text-muted-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
              {badge ? (
                <span
                  className={cn(
                    'rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em]',
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] text-muted-foreground">{meta.sub}</span>
          </div>
          <span className="shrink-0 text-right font-mono text-[10px] leading-tight text-muted-foreground/70">
            {channel.n} hits
            <br />
            {Math.round(channel.elapsed_ms)} ms
          </span>
        </div>

        {cands.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            {channel.note ?? 'No candidates returned for this channel.'}
          </p>
        ) : (
          <>
            <ol className="space-y-1.5">
              {shown.map((c) => (
                <RankRow
                  key={candKey(c)}
                  cand={c}
                  maxScore={maxScore}
                  grown={grown}
                  contributing={
                    bm25Ranks || denseRanks
                      ? {
                          bm25: bm25Ranks?.get(candKey(c)),
                          dense: denseRanks?.get(candKey(c)),
                        }
                      : undefined
                  }
                />
              ))}
            </ol>
            {cands.length > DISPLAY_TOP ? (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="mt-2 w-full rounded-md py-1 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {showAll ? 'Show fewer' : `Show all ${cands.length}`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

// ───────────────────────── soft states ─────────────────────────

function SoftNote({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-foreground/12 bg-foreground/[0.015] px-3 py-2.5 text-[12px] text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

// ───────────────────────── the renderer ─────────────────────────

/**
 * Renders the ACTUAL retrieved articles for the retrieve station: BM25 + Dense
 * as the input channels, the fused **Hybrid (RRF)** result that the live RLM
 * actually retrieves with (with each article's contributing input ranks shown so
 * the fusion is legible), and **Hybrid + Rerank** as a clearly-labelled BASELINE
 * — re-ranking is NOT in the live RLM retrieve path. Gold-standard articles are
 * highlighted in every channel; Arabic snippets expand RTL. All data comes from
 * `POST /api/retrieval/compare`; the trace renders without it (soft note).
 */
export function RetrievalChannels({
  compare,
  status,
  className,
}: {
  compare: CompareResponse | null
  status: CompareStatus
  className?: string
}) {
  const [baselineOpen, setBaselineOpen] = React.useState(false)

  if (status === 'loading' && !compare) {
    return (
      <SoftNote icon={<Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:hidden" />}>
        Re-running BM25 + dense retrieval over the indices…
      </SoftNote>
    )
  }
  if (!compare || status === 'error') {
    return <SoftNote>Retrieval detail unavailable for this question.</SoftNote>
  }

  const byName = (n: string) => compare.channels.find((c) => c.name === n)
  const bm25 = byName('bm25')
  const dense = byName('dense')
  const hybrid = byName('hybrid')
  const rerank = byName('hybrid_rerank')
  const bm25Ranks = rankMap(bm25)
  const denseRanks = rankMap(dense)

  const hasGoldIds = (compare.gold_article_ids?.length ?? 0) > 0
  const goldShown = anyGoldShown([bm25, dense, hybrid])

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Faithful offline re-run over the same BM25 + dense indices, seeded by the
        question — a reconstruction of what the retriever sees, not a stored log of
        the locked run&apos;s exact candidates.
      </p>

      {/* input channels */}
      {bm25 || dense ? (
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span className="font-mono text-foreground/50">in</span>
            Input channels
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {bm25 ? <ChannelCard channel={bm25} /> : null}
            {dense ? <ChannelCard channel={dense} /> : null}
          </div>
        </div>
      ) : null}

      {/* fused — the live retrieve */}
      {hybrid ? (
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            <span className="font-mono text-primary/60">→</span>
            Fused retrieve · what the live RLM uses
          </div>
          <ChannelCard
            channel={hybrid}
            tone="live"
            badge={{
              label: 'live retrieve',
              className: 'bg-primary/15 text-primary',
            }}
            bm25Ranks={bm25Ranks}
            denseRanks={denseRanks}
          />
        </div>
      ) : null}

      {/* gold-absent honest note */}
      {hasGoldIds && !goldShown ? (
        <SoftNote icon={<Star className="h-3.5 w-3.5 shrink-0 text-gold" />}>
          The gold article isn&apos;t in the top results shown here — the live
          pipeline recovers it downstream via recursive sub-queries (see the
          recursion stations above).
        </SoftNote>
      ) : null}

      {/* rerank — baseline only, collapsed */}
      {rerank ? (
        <div className="rounded-[1.1rem] border border-dashed border-foreground/12 bg-foreground/[0.015] p-1">
          <button
            type="button"
            onClick={() => setBaselineOpen((o) => !o)}
            aria-expanded={baselineOpen}
            className="flex w-full items-center gap-2 rounded-[0.8rem] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.02]"
          >
            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-foreground/90">
                  Hybrid + Rerank
                </span>
                <span className="rounded bg-foreground/[0.08] px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  baseline
                </span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                Re-ranking is <strong className="font-semibold">not</strong> in the
                live RLM retrieve path — full comparison in the Retrieval Lab.
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-500 ease-spring',
                baselineOpen && 'rotate-180',
              )}
            />
          </button>
          <div
            className={cn(
              'grid transition-all duration-500 ease-spring motion-reduce:transition-none',
              baselineOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="px-1 pb-1 pt-1.5">
                <ChannelCard
                  channel={rerank}
                  tone="baseline"
                  badge={{
                    label: 'baseline',
                    className: 'bg-foreground/[0.08] text-muted-foreground',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
