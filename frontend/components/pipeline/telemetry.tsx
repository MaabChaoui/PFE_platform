'use client'

import * as React from 'react'

import { MetricCard } from '@/components/shared/metric-card'
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
      className="rounded-xl border border-foreground/[0.08] bg-card/50 p-3 transition-colors duration-300 ease-spring hover:border-foreground/15"
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
        'rounded-[1.75rem] bg-foreground/[0.025] p-1.5 ring-1 ring-foreground/[0.06]',
        className,
      )}
    >
      <div className="rounded-[1.4rem] bg-card/60 p-5 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] md:p-6">
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
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Faithfulness · locked run scores
            </div>
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
        ) : null}
      </div>
    </section>
  )
}
