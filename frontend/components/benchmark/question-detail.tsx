'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarClock,
  ChevronLeft,
  GitCompareArrows,
  ListChecks,
  ScanSearch,
  ScrollText,
  Sparkles,
  Workflow,
} from 'lucide-react'

import { ResultsSection } from '@/components/results/section'
import { ArabicText } from '@/components/shared/arabic-text'
import { CitationChip } from '@/components/shared/citation-chip'
import { MetricCard } from '@/components/shared/metric-card'
import { ErrorState } from '@/components/shared/states'
import { ToulminBlock, hasToulmin } from '@/components/pipeline/toulmin'
import { MetricCaveat } from '@/components/pipeline/telemetry'
import { isArabic } from '@/components/pipeline/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getQuestion } from '@/lib/api'
import { fmtInt, fmtLatency, fmtScore, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExpectedArticle, PredictionView, QuestionDetail } from '@/lib/types'
import { GoldVsPred } from './gold-vs-pred'
import { OutcomeBadge } from './outcome-badge'
import { TrajectoryMini } from './trajectory-mini'
import { asNum, asObj, asStr, computeOutcome } from './utils'

// ───────────────────────── small parts ─────────────────────────

function BackBar({ id }: { id: string }) {
  const router = useRouter()
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to questions
      </button>
      <Link
        href={`/?replay=${encodeURIComponent(id)}`}
        className="group inline-flex items-center gap-2 rounded-full bg-gradient-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all duration-300 ease-spring hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Open in pipeline visualizer
        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-foreground/15 transition-transform duration-300 ease-spring group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  )
}

function MetaChip({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 py-1 text-[11px]">
      <span className="uppercase tracking-[0.12em] text-muted-foreground/70">{label}</span>
      <span className={cn('font-medium text-foreground', mono && 'font-mono')}>{value}</span>
    </span>
  )
}

/** RTL-aware paragraph: Arabic → ArabicText, otherwise plain. */
function SmartText({
  children,
  className,
  lines,
}: {
  children: string
  className?: string
  lines?: number
}) {
  if (isArabic(children)) {
    return (
      <ArabicText lines={lines} className={className}>
        {children}
      </ArabicText>
    )
  }
  return <p className={className}>{children}</p>
}

// ───────────────────────── gold articles ─────────────────────────

function GoldArticle({ article }: { article: ExpectedArticle }) {
  const title = article.doc_title ?? article.law_name_ar ?? article.document_id
  const text = article.text
  return (
    <div className="rounded-xl border border-foreground/[0.07] bg-card/40 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CitationChip
          docId={article.document_id}
          articleRef={article.article_ref}
          docTitle={title}
        />
        {!article.in_dataset ? (
          <Badge variant="muted" className="text-[9px]">
            outside corpus
          </Badge>
        ) : !article.resolved ? (
          <Badge variant="warning" className="text-[9px]">
            unresolved
          </Badge>
        ) : null}
      </div>
      {title ? (
        <ArabicText className="mb-1.5 text-[12px] font-medium text-muted-foreground">
          {title}
        </ArabicText>
      ) : null}
      {text ? (
        <ArabicText className="text-[14px] leading-relaxed text-foreground/90">
          {text}
        </ArabicText>
      ) : (
        <p className="text-[12px] text-muted-foreground/70">
          Full text unavailable — the article is outside the corpus or could not be resolved.
        </p>
      )}
    </div>
  )
}

// ───────────────────────── prediction ─────────────────────────

function PredictedCitation({ cit }: { cit: Record<string, unknown> }) {
  const docId = asStr(cit.doc_id)
  const articleRef = asStr(cit.article_ref)
  const docTitle = asStr(cit.doc_title)
  const span = asStr(cit.supporting_span)
  const confidence = asNum(cit.confidence)
  const arg = asObj(cit.argumentation)

  return (
    <div className="rounded-xl border border-foreground/[0.07] bg-card/40 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {docId && articleRef ? (
          <CitationChip docId={docId} articleRef={articleRef} docTitle={docTitle} />
        ) : (
          <span className="text-xs text-muted-foreground">{docTitle ?? 'Citation'}</span>
        )}
        {confidence !== null ? (
          <span className="nums rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            conf {fmtScore(confidence, 2)}
          </span>
        ) : null}
      </div>
      {span ? (
        <ArabicText className="text-[13px] leading-relaxed text-foreground/85">
          {span}
        </ArabicText>
      ) : null}
      {hasToulmin(arg) ? <ToulminBlock arg={arg} className="mt-2.5" /> : null}
    </div>
  )
}

type FaithKey =
  | 'hcr'
  | 'jir'
  | 'answer_faithfulness'
  | 'citation_groundedness'
  | 'am_faithfulness_score'

const FAITH_SPECS: Array<{
  key: FaithKey
  label: string
  better: 'lower' | 'higher'
  help: string
}> = [
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

function PredictionBlock({ prediction }: { prediction: PredictionView }) {
  const answer = prediction.answer_text
  const citations = prediction.predicted_citations ?? []
  const trajectory = prediction.trajectory ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {prediction.dispatched_handler ? (
          <MetaChip
            label="Handler"
            value={
              <span className="inline-flex items-center gap-1">
                <Workflow className="h-3 w-3 text-primary" />
                {prediction.dispatched_handler}
              </span>
            }
          />
        ) : null}
        {prediction.predicted_abstain ? (
          <Badge variant="info" className="text-[10px]">
            Abstained
          </Badge>
        ) : null}
      </div>

      {/* Answer */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Answer · الإجابة
        </div>
        {answer ? (
          <ArabicText className="rounded-xl border border-foreground/[0.07] bg-card/40 p-4 text-[15px] leading-relaxed text-foreground/90">
            {answer}
          </ArabicText>
        ) : (
          <p className="text-sm text-muted-foreground">
            {prediction.predicted_abstain
              ? 'The system abstained — no answer was produced.'
              : 'No answer text recorded.'}
          </p>
        )}
      </div>

      {/* Citations + Toulmin */}
      {citations.length > 0 ? (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Grounded citations · {citations.length}
          </div>
          <div className="space-y-2.5">
            {citations.map((cit, i) => (
              <PredictedCitation key={i} cit={cit} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Trajectory */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <ScanSearch className="h-3.5 w-3.5" />
          Trajectory · {trajectory.length} steps
        </div>
        <TrajectoryMini trajectory={trajectory} />
      </div>

      {/* Per-question scores */}
      <div>
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Run metrics
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Latency"
            value={fmtLatency(prediction.latency_s)}
            sublabel="locked run"
            explanation="Wall-clock latency of the precomputed locked run for this question."
          />
          <MetricCard
            label="Sub-calls"
            value={fmtInt(prediction.sub_call_count)}
            sublabel="LLM sub-calls"
            explanation="Number of LLM sub-calls the dispatcher issued for this run."
          />
          <MetricCard
            label="Retries"
            value={prediction.retry_count ?? '—'}
            sublabel="corrective regen"
            accent={prediction.retry_count ? 'gold' : 'default'}
            explanation="Corrective faithfulness-gate regenerations triggered during the run."
          />
        </div>

        <div className="mt-4">
          <MetricCaveat />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FAITH_SPECS.map((spec) => (
              <MetricCard
                key={spec.key}
                label={spec.label}
                value={fmtScore(prediction[spec.key] as number | null, 3)}
                sublabel={spec.better === 'lower' ? '↓ better' : '↑ better'}
                explanation={spec.help}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── page ─────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}

function Header({ q }: { q: QuestionDetail }) {
  const outcome = computeOutcome(
    q.prediction?.correctness,
    q.prediction?.predicted_abstain,
    !!q.prediction,
  )
  return (
    <div className="mb-7">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="nums font-mono text-xs text-muted-foreground">{q.id}</span>
        <OutcomeBadge outcome={outcome} />
        <Badge variant="muted" className="font-mono text-[10px]">
          {humanize(q.query_type)}
        </Badge>
      </div>
      <SmartText className="font-display text-2xl leading-snug tracking-tight text-foreground md:text-3xl">
        {q.question}
      </SmartText>
      <div className="mt-4 flex flex-wrap gap-2">
        <MetaChip label="Difficulty" value={humanize(q.difficulty)} />
        <MetaChip label="Category" value={humanize(q.category)} />
        <MetaChip label="Language" value={q.language} mono />
        {q.split ? <MetaChip label="Split" value={q.split} mono /> : null}
        <MetaChip
          label="Answerable"
          value={q.answerable ? 'Yes' : q.partially_answerable ? 'Partial' : 'No'}
        />
        {q.query_type === 'unanswerable' ? (
          <MetaChip label="Abstention" value="positive set" />
        ) : null}
      </div>
      {q.temporal_note ? (
        <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-info/30 bg-info/[0.06] px-3 py-2 text-[12px] text-muted-foreground">
          <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0 text-info" />
          <SmartText className="leading-relaxed">{q.temporal_note}</SmartText>
        </div>
      ) : null}
    </div>
  )
}

export function QuestionDetailView({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['benchmark-question', id],
    queryFn: ({ signal }) => getQuestion(id, signal),
  })

  if (query.isError) {
    return (
      <div>
        <BackBar id={id} />
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Could not load this question"
        />
      </div>
    )
  }

  if (!query.data) {
    return (
      <div>
        <BackBar id={id} />
        <DetailSkeleton />
      </div>
    )
  }

  const q = query.data
  const prediction = q.prediction
  const hasReasoning = q.reasoning_chain && q.reasoning_chain.length > 0

  return (
    <div className="animate-fade-up">
      <BackBar id={id} />
      <Header q={q} />

      <div className="space-y-6">
        {/* Gold target articles */}
        <ResultsSection
          index="01"
          eyebrow="Gold"
          title="Target articles"
          lede="The ground-truth articles a faithful answer must cite — with their full Akoma Ntoso text."
        >
          {q.expected_articles.length > 0 ? (
            <div className="space-y-3">
              {q.expected_articles.map((a, i) => (
                <GoldArticle key={`${a.document_id}-${a.article_ref}-${i}`} article={a} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No expected articles — this question is unanswerable from the corpus (the gold
              behaviour is to abstain).
            </p>
          )}
        </ResultsSection>

        {/* Gold reasoning + answer */}
        {hasReasoning || q.ground_truth_answer ? (
          <ResultsSection
            index="02"
            eyebrow="Gold"
            title="Reasoning & answer"
            lede="The annotated reasoning chain and ground-truth answer."
          >
            <div className="space-y-5">
              {hasReasoning ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" />
                    Reasoning chain
                  </div>
                  <ol className="space-y-2">
                    {q.reasoning_chain.map((step, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="nums mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-foreground/[0.06] font-mono text-[10px] font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                        <SmartText className="flex-1 text-[14px] leading-relaxed text-foreground/85">
                          {step}
                        </SmartText>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {q.ground_truth_answer ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    Ground-truth answer · الإجابة المرجعية
                  </div>
                  <ArabicText className="rounded-xl border border-foreground/[0.07] bg-card/40 p-4 text-[14px] leading-relaxed text-foreground/90">
                    {q.ground_truth_answer}
                  </ArabicText>
                </div>
              ) : null}
            </div>
          </ResultsSection>
        ) : null}

        {/* AKN-RLM prediction */}
        <ResultsSection
          index="03"
          eyebrow="AKN-RLM"
          title="Precomputed prediction"
          lede="What the system produced on the locked run — answer, grounded citations with argument structure, trajectory and per-question metrics."
        >
          {prediction ? (
            <PredictionBlock prediction={prediction} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No precomputed prediction is joined for this question.
            </p>
          )}
        </ResultsSection>

        {/* Gold vs Pred diff */}
        {prediction ? (
          <ResultsSection
            index="04"
            eyebrow="Verdict"
            title="Gold vs predicted"
            lede="Where the prediction matched, missed or over-cited the gold articles — and the abstention verdict for unanswerable questions."
            actions={<GitCompareArrows className="h-5 w-5 text-muted-foreground" />}
          >
            <GoldVsPred prediction={prediction} queryType={q.query_type} />
          </ResultsSection>
        ) : null}
      </div>
    </div>
  )
}
