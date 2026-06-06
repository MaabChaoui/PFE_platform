'use client'

import * as React from 'react'
import {
  CircleCheckBig,
  CircleSlash,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

import { fmtScore } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PredictionView } from '@/lib/types'
import { parseArticleId } from './utils'

function ArticleChip({ id, tone }: { id: string; tone: 'success' | 'destructive' | 'warning' }) {
  const { docId, ref } = parseArticleId(id)
  const lawNum = docId.split('_')[0] || docId
  const toneCls =
    tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : tone === 'destructive'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-warning/40 bg-warning/10 text-warning'
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]',
        toneCls,
      )}
      title={id}
    >
      <span className="nums whitespace-nowrap">{ref ? `art. ${ref}` : 'art.'}</span>
      <span className="opacity-50">·</span>
      <span className="truncate opacity-80">{lawNum}</span>
    </span>
  )
}

function DiffColumn({
  title,
  icon: Icon,
  tone,
  ids,
}: {
  title: string
  icon: typeof CircleCheckBig
  tone: 'success' | 'destructive' | 'warning'
  ids: string[]
}) {
  const toneText =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : 'text-warning'
  return (
    <div className="rounded-xl border border-foreground/[0.07] bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', toneText)} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </span>
        <span className="nums ml-auto font-mono text-xs font-semibold text-foreground">
          {ids.length}
        </span>
      </div>
      {ids.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/60">none</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <ArticleChip key={id} id={id} tone={tone} />
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/[0.08] bg-card/50 px-3 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="nums mt-0.5 font-mono text-lg tracking-tight text-foreground">
        {value}
      </div>
    </div>
  )
}

function AbstentionVerdict({
  goldAbstain,
  predAbstain,
}: {
  goldAbstain: boolean
  predAbstain: boolean
}) {
  const spec = goldAbstain
    ? predAbstain
      ? {
          icon: ShieldCheck,
          tone: 'text-success',
          ring: 'ring-success/30',
          bg: 'bg-success/[0.06]',
          title: 'Correctly abstained',
          detail: 'This question is unanswerable from the corpus, and AKN-RLM abstained — the desired behaviour.',
        }
      : {
          icon: ShieldX,
          tone: 'text-destructive',
          ring: 'ring-destructive/30',
          bg: 'bg-destructive/[0.06]',
          title: 'Failed to abstain',
          detail: 'This question is unanswerable, but the system produced an answer instead of abstaining.',
        }
    : {
        icon: ShieldAlert,
        tone: 'text-warning',
        ring: 'ring-warning/40',
        bg: 'bg-warning/[0.06]',
        title: 'Over-abstained',
        detail: 'The question is answerable, but the system abstained.',
      }
  const Icon = spec.icon
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset',
        spec.bg,
        spec.ring,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', spec.tone)} />
      <div>
        <div className={cn('text-sm font-semibold', spec.tone)}>{spec.title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{spec.detail}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">
            gold: {goldAbstain ? 'abstain' : 'answer'}
          </span>
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">
            predicted: {predAbstain ? 'abstain' : 'answer'}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Gold-vs-Pred diff — the heart of the benchmark detail. For citation questions it
 * shows matched / missing / extra articles (set overlap of gold_article_ids vs
 * pred_article_ids) with the Correctness P/R/F1. For unanswerable questions it
 * shows the abstention verdict (predicted_abstain vs gold_abstain) instead — the
 * positive abstention set is `query_type==='unanswerable'`, per plan §6.
 */
export function GoldVsPred({
  prediction,
  queryType,
}: {
  prediction: PredictionView
  queryType: string
}) {
  const gold = prediction.gold_article_ids ?? []
  const pred = prediction.pred_article_ids ?? []
  const goldSet = new Set(gold)
  const predSet = new Set(pred)
  const matched = gold.filter((x) => predSet.has(x)).sort()
  const missing = gold.filter((x) => !predSet.has(x)).sort()
  const extra = pred.filter((x) => !goldSet.has(x)).sort()

  const goldAbstain = prediction.gold_abstain ?? queryType === 'unanswerable'
  const predAbstain = prediction.predicted_abstain ?? false
  const isAbstention =
    prediction.correctness?.abstention_scored || goldAbstain || queryType === 'unanswerable'

  if (isAbstention) {
    return (
      <div className="space-y-3">
        <AbstentionVerdict goldAbstain={goldAbstain} predAbstain={predAbstain} />
        {/* If the system answered (didn't abstain), still surface what it cited. */}
        {!predAbstain && pred.length > 0 ? (
          <DiffColumn
            title="Articles cited despite unanswerable"
            icon={Plus}
            tone="warning"
            ids={extra.length ? extra : pred}
          />
        ) : null}
      </div>
    )
  }

  const c = prediction.correctness
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <DiffColumn title="Matched" icon={CircleCheckBig} tone="success" ids={matched} />
        <DiffColumn title="Missing" icon={CircleSlash} tone="destructive" ids={missing} />
        <DiffColumn title="Extra" icon={Plus} tone="warning" ids={extra} />
      </div>
      {c ? (
        <div className="grid grid-cols-3 gap-2.5 sm:max-w-md">
          <Stat label="Precision" value={fmtScore(c.precision, 2)} />
          <Stat label="Recall" value={fmtScore(c.recall, 2)} />
          <Stat label="F1" value={fmtScore(c.f1, 2)} />
        </div>
      ) : null}
    </div>
  )
}
