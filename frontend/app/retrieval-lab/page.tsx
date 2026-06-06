'use client'

/**
 * S11 — Retrieval Lab (`/retrieval-lab`). A standalone, fully-OFFLINE instrument
 * for exploring retrieval: per-retriever ranked lists, RRF fusion weights, the
 * re-ranking baseline, and depth — with gold-hit highlighting when seeded from a
 * benchmark question. All data comes from `POST /api/retrieval/compare`; the
 * channel renderer is reused from the Main pipeline (S10c), not reimplemented.
 *
 * Honesty (plan.md §5): the live RLM retrieve path is Hybrid (RRF) of BM25 +
 * Dense at EQUAL weights. Re-ranking and tunable fusion weights are NOT in the
 * live path — this page is their honest home, labelled throughout.
 */
import * as React from 'react'
import { FlaskConical, Info, Loader2, Search, Sparkles, Star } from 'lucide-react'

import { LabControlsPanel } from '@/components/retrieval-lab/controls'
import type { SeedSelection } from '@/components/retrieval-lab/seed-input'
import { RetrievalChannels } from '@/components/pipeline/retrieval-channels'
import { isArabic } from '@/components/pipeline/utils'
import { ArabicText } from '@/components/shared/arabic-text'
import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  DEFAULT_CONTROLS,
  useRetrievalLab,
  type LabControls,
} from '@/lib/use-retrieval-lab'

export default function RetrievalLabPage() {
  const [controls, setControls] = React.useState<LabControls>(DEFAULT_CONTROLS)
  const [seed, setSeed] = React.useState<SeedSelection | null>(null)

  const patch = React.useCallback(
    (p: Partial<LabControls>) => setControls((c) => ({ ...c, ...p })),
    [],
  )
  const onSeedSelect = React.useCallback((sel: SeedSelection) => {
    setSeed(sel)
    setControls((c) => ({ ...c, mode: 'seed', query: '', questionId: sel.id }))
  }, [])
  const onSeedClear = React.useCallback(() => {
    setSeed(null)
    setControls((c) => ({ ...c, questionId: null }))
  }, [])
  const onReset = React.useCallback(() => {
    setSeed(null)
    setControls(DEFAULT_CONTROLS)
  }, [])

  const { compare, status, error, isValid, isStale, runNow } = useRetrievalLab(controls)

  const denseFamily = controls.retrievers.some(
    (r) => r === 'dense' || r === 'hybrid' || r === 'hybrid_rerank',
  )

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Retrieval"
        title="Retrieval Lab"
        description="Re-run retrieval over the same offline BM25 + dense indices and compare every channel side by side — BM25, Dense, their fused Hybrid (RRF), and a re-ranking baseline. Tune fusion weights and depth, or seed a benchmark question to light up the gold target articles. Fully offline: no LLM."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* ── controls (sticky on desktop) ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <LabControlsPanel
            controls={controls}
            seed={seed}
            onChange={patch}
            onSeedSelect={onSeedSelect}
            onSeedClear={onSeedClear}
            onReset={onReset}
            onRun={runNow}
            status={status}
            isValid={isValid}
          />
        </aside>

        {/* ── output ── */}
        <section className="min-w-0 space-y-4">
          <HonestyCard />

          {!isValid ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="Compare retrievers"
              description="Type a free-form query, or seed a benchmark question to light up its gold target articles, then run."
            />
          ) : !compare ? (
            status === 'error' ? (
              <ErrorState error={error} onRetry={runNow} className="py-10" />
            ) : (
              <WarmingState denseFamily={denseFamily} />
            )
          ) : (
            <div className="space-y-3">
              <ResultSummary
                query={compare.query}
                seededFrom={compare.seeded_from_question}
                goldCount={compare.gold_article_ids?.length ?? 0}
                stale={isStale}
              />
              {status === 'error' ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-[12px] text-foreground/80">
                  <Info className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  The last change couldn’t be run — showing the previous result.
                </div>
              ) : null}
              <div
                className={cn(
                  'transition-opacity duration-300',
                  isStale && 'opacity-55',
                )}
              >
                <RetrievalChannels compare={compare} status="done" />
              </div>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  )
}

// ───────────────────────── honesty + explainer ─────────────────────────

function HonestyCard() {
  return (
    <div className="rounded-[1.1rem] p-1 ring-1 ring-primary/20 bg-primary/[0.03]">
      <div className="rounded-[0.8rem] bg-card/70 p-3.5 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]">
        <div className="flex items-start gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[12.5px] leading-relaxed text-foreground/85">
              The live RLM retrieves with{' '}
              <span className="font-semibold text-primary">Hybrid (RRF)</span> of BM25 +
              Dense at <span className="font-semibold">equal weights (1.0 / 1.0)</span>.
              The fusion-weight sliders and the{' '}
              <FlaskConical className="inline h-3 w-3 -translate-y-px" /> re-ranking
              baseline are a <span className="font-medium">Lab-only</span> exploration —{' '}
              <span className="font-medium text-foreground">not</span> part of the live
              retrieve path.
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground/85">
              <span className="font-medium text-foreground/70">How RRF fuses:</span> each
              article scores{' '}
              <span className="font-mono text-[10.5px]">Σ wᵢ · 1 / (60 + rankᵢ)</span> across
              the input retrievers — raising a weight pulls that retriever’s ranking forward
              and visibly reorders the Hybrid list.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultSummary({
  query,
  seededFrom,
  goldCount,
  stale,
}: {
  query: string
  seededFrom: string | null
  goldCount: number
  stale: boolean
}) {
  const rtl = isArabic(query)
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
      {seededFrom ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/[0.1] px-2.5 py-1 font-medium text-gold">
          <Star className="h-3 w-3 fill-current" />
          Seeded · {seededFrom}
          {goldCount > 0 ? (
            <span className="font-mono text-[10px] text-gold/80">
              {goldCount} gold
            </span>
          ) : null}
        </span>
      ) : (
        <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1 font-medium text-muted-foreground">
          Free query
        </span>
      )}
      {rtl ? (
        <ArabicText lines={1} className="min-w-0 flex-1 text-[12.5px] text-foreground/70">
          {query}
        </ArabicText>
      ) : (
        <span className="min-w-0 flex-1 truncate text-foreground/70">“{query}”</span>
      )}
      {stale ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-info">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          re-running
        </span>
      ) : null}
    </div>
  )
}

function WarmingState({ denseFamily }: { denseFamily: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.015] px-4 py-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground/90">
            {denseFamily
              ? 'Warming the multilingual-e5 encoder…'
              : 'Running retrieval over the indices…'}
          </p>
          {denseFamily ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              The first dense/hybrid call lazy-loads the encoder (~7–14s). Subsequent runs
              are fast.
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-[1.1rem] p-1 ring-1 ring-foreground/[0.07] bg-foreground/[0.02]"
          >
            <div className="space-y-2.5 rounded-[0.8rem] bg-card/60 p-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-10" />
              </div>
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
