'use client'

import * as React from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'

import { MetricCard } from '@/components/shared/metric-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fmtInt, fmtLatency, fmtScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnswerResponse, ReplayScores } from '@/lib/types'

/** A 0..1 faithfulness score with its real definition + direction. Values are
 *  shown raw (never colour-coded by magnitude — per-question hcr/jir of 0 is the
 *  *good* case, and aggregate scores like answer_faithfulness can read 0 next to
 *  a perfectly good answer). */
interface ScoreSpec {
  key: keyof ReplayScores
  label: string
  better: 'lower' | 'higher'
  help: string
}

const SCORE_SPECS: ScoreSpec[] = [
  {
    key: 'hcr',
    label: 'HCR',
    better: 'lower',
    help: 'Hallucinated-citation rate — fraction of cited articles not in the registry (0 by construction of the citation-existence gate).',
  },
  {
    key: 'jir',
    label: 'JIR',
    better: 'lower',
    help: 'Jurisdictional-infection rate — fraction of unanswerable questions emitting a foreign-law canary concept.',
  },
  {
    key: 'answer_faithfulness',
    label: 'Answer faithfulness',
    better: 'higher',
    help: 'Fraction of answer claims entailed by ≥1 cited article (aggregate metric, shown per-question).',
  },
  {
    key: 'citation_groundedness',
    label: 'Citation groundedness',
    better: 'higher',
    help: 'Fraction of cited articles that actually participate in the answer.',
  },
  {
    key: 'am_faithfulness_score',
    label: 'AM faithfulness',
    better: 'higher',
    help: 'Avg per-claim NLI entailment against the Toulmin ground span of cited articles.',
  },
]

function ScoreTile({ spec, value }: { spec: ScoreSpec; value: number | null }) {
  return (
    <div
      title={spec.help}
      className="rounded-xl border border-foreground/[0.1] bg-card/50 p-3 shadow-card transition-colors duration-300 ease-spring hover:border-foreground/20 dark:border-foreground/[0.08] dark:shadow-none dark:hover:border-foreground/15"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {spec.label}
        </span>
        <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
          {spec.better === 'lower' ? '↓ better' : '↑ better'}
        </span>
      </div>
      <div className="mt-1.5 nums font-mono text-xl tracking-tight text-foreground">
        {fmtScore(value, 3)}
      </div>
    </div>
  )
}

/**
 * An honest, always-visible caveat for the faithfulness block: these are
 * aggregate / per-claim NLI metrics computed over the whole benchmark, so on a
 * single question they can read ~0 right next to a correct, well-cited answer.
 * The caption is legible (not just a hover) so a juror is never misled; the Info
 * tooltip carries the fuller definition, and the link points at the corpus-level
 * value on Results.
 */
export function MetricCaveat() {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-foreground/[0.1] bg-foreground/[0.04] px-3 py-2 dark:border-foreground/[0.07] dark:bg-foreground/[0.02]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="About the faithfulness metrics"
            className="mt-px shrink-0 rounded text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed">
          Faithfulness scores are aggregate / per-claim NLI metrics measured across the full
          benchmark. On a single question the slice is tiny, so answer- and AM-faithfulness can
          read 0 even when every claim is correctly grounded in a cited article. The reported
          corpus-level values live on the Results page.
        </TooltipContent>
      </Tooltip>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Aggregate / per-claim metric — may read low on a single question.{' '}
        <Link
          href="/results"
          className="rounded font-medium text-foreground/75 underline decoration-foreground/25 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          See Results for the corpus-level value
        </Link>
        .
      </p>
    </div>
  )
}

export function Telemetry({
  answer,
  scores,
  className,
}: {
  answer: AnswerResponse
  scores: ReplayScores | null
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-[1.75rem] bg-foreground/[0.04] p-1.5 ring-1 ring-foreground/[0.09] dark:bg-foreground/[0.025] dark:ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="rounded-[1.4rem] bg-card/60 p-5 shadow-card dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] md:p-6">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-mono text-primary">02</span>
          <span className="h-px w-5 bg-foreground/15" />
          Telemetry
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Latency"
            value={fmtLatency(answer.latency_s)}
            sublabel="locked run, end-to-end"
            explanation="Wall-clock latency of the precomputed locked run for this question."
          />
          <MetricCard
            label="Sub-calls"
            value={fmtInt(answer.sub_call_count)}
            sublabel="LLM sub-calls"
            explanation="Number of LLM sub-calls the dispatcher issued for this run."
          />
          <MetricCard
            label="Max depth"
            value={answer.recursion_depth_max}
            sublabel="recursion reached"
            explanation="Deepest recursive retrieval pass the gap-probe requested (1–3)."
          />
          <MetricCard
            label="Corrective retry"
            value={answer.corrective_retry_fired ? 'Fired' : 'No'}
            sublabel="faithfulness regen"
            accent={answer.corrective_retry_fired ? 'gold' : 'default'}
            explanation="Whether the faithfulness gate triggered a one-shot answer regeneration."
          />
        </div>

        {scores ? (
          <div className="mt-5 border-t border-foreground/[0.07] pt-4">
            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Faithfulness · locked run scores
            </div>
            <MetricCaveat />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {SCORE_SPECS.map((spec) => (
                <ScoreTile
                  key={spec.key}
                  spec={spec}
                  value={(scores[spec.key] as number | null) ?? null}
                />
              ))}
            </div>
          </div>
        ) : answer.am_faithfulness_score != null ? (
          // Live run: the replay-only hcr/jir/groundedness aggregates are absent;
          // only the per-run AM faithfulness comes back on the answer itself.
          <div className="mt-5 border-t border-foreground/[0.07] pt-4">
            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Faithfulness · this live run
            </div>
            <MetricCaveat />
            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <ScoreTile
                spec={{
                  key: 'am_faithfulness_score',
                  label: 'AM faithfulness',
                  better: 'higher',
                  help: 'Avg per-claim NLI entailment against the Toulmin ground span of cited articles. Aggregate metric, shown for this single run.',
                }}
                value={answer.am_faithfulness_score}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
