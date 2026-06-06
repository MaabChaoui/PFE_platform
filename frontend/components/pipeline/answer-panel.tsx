'use client'

import * as React from 'react'
import { BadgeCheck, ChevronDown, ShieldAlert } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { CitationChip } from '@/components/shared/citation-chip'
import { Badge } from '@/components/ui/badge'
import { fmtPct, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnswerResponse, Citation } from '@/lib/types'

import { ToulminBlock, hasToulmin } from './toulmin'

// ───────────────────────── one citation ─────────────────────────

function CitationItem({ citation, index }: { citation: Citation; index: number }) {
  const [open, setOpen] = React.useState(false)
  const arg = citation.argumentation as Record<string, unknown> | null | undefined
  const hasArg = hasToulmin(arg)
  const hasBody =
    !!citation.supporting_span || !!citation.text || hasArg

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card/50 transition-colors duration-300 ease-spring hover:border-foreground/15">
      <button
        type="button"
        onClick={() => hasBody && setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2.5 text-left',
          !hasBody && 'cursor-default',
        )}
      >
        <CitationChip
          index={index}
          docId={citation.doc_id}
          articleRef={citation.article_ref}
          docTitle={citation.doc_title}
          versionDate={citation.version_date}
        />
        <span className="ml-auto flex items-center gap-2">
          {citation.verifier_relevant ? (
            <span
              title="Passed the supervisor verifier"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-success"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">verified</span>
            </span>
          ) : null}
          <span className="nums font-mono text-[11px] text-muted-foreground">
            {fmtPct(citation.confidence, 0)}
          </span>
          {hasBody ? (
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-500 ease-spring',
                open && 'rotate-180',
              )}
            />
          ) : null}
        </span>
      </button>

      <div
        className={cn(
          'grid transition-all duration-500 ease-spring motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-foreground/[0.07] px-3 py-3">
            {citation.supporting_span ? (
              <div className="mb-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Supporting span
                </div>
                <ArabicText className="rounded-md bg-primary/[0.06] p-2.5 text-[13px] leading-relaxed text-foreground/90">
                  {citation.supporting_span}
                </ArabicText>
              </div>
            ) : null}
            {citation.text ? (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Article text
                </div>
                <ArabicText
                  lines={6}
                  className="text-[13px] leading-relaxed text-foreground/75"
                >
                  {citation.text}
                </ArabicText>
              </div>
            ) : null}
            {hasArg ? <ToulminBlock arg={arg} className="mt-3" /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── abstention ─────────────────────────

function AbstentionNotice({ reason }: { reason: string | null }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/[0.07] p-5">
      <div className="flex items-center gap-2 text-warning">
        <ShieldAlert className="h-5 w-5" />
        <span className="font-display text-lg tracking-tight text-foreground">
          The system abstained
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        AKN-RLM declined to answer rather than fabricate a citation — abstention
        is the faithfulness safeguard for questions the corpus cannot ground.
      </p>
      {reason ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-foreground/[0.05] px-2.5 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Reason
          </span>
          <span className="font-mono text-xs text-foreground/90">
            {humanize(reason)}
          </span>
        </div>
      ) : null}
    </div>
  )
}

// ───────────────────────── panel ─────────────────────────

export function AnswerPanel({
  answer,
  className,
}: {
  answer: AnswerResponse
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="font-mono text-primary">01</span>
            <span className="h-px w-5 bg-foreground/15" />
            {answer.abstained ? 'Abstention' : 'Grounded synthesis'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="muted" className="font-mono text-[10px]">
              {humanize(answer.query_type_predicted)}
            </Badge>
            <Badge variant="outline" className="border-foreground/15 font-mono text-[10px]">
              {humanize(answer.handler_used)}
            </Badge>
          </div>
        </div>

        {answer.abstained ? (
          <AbstentionNotice reason={answer.abstention_reason} />
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Answer
              <span className="font-arabic text-[12px] normal-case tracking-normal text-muted-foreground/80">
                الإجابة
              </span>
            </div>
            {answer.answer_text ? (
              <ArabicText className="text-[17px] leading-[1.95] text-foreground/95">
                {answer.answer_text}
              </ArabicText>
            ) : (
              <p className="text-sm text-muted-foreground">
                No answer text was produced.
              </p>
            )}

            {answer.citations.length > 0 ? (
              <div className="mt-6">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Sources
                  <span className="font-arabic text-[12px] normal-case tracking-normal text-muted-foreground/80">
                    المصادر
                  </span>
                  <span className="font-mono normal-case tracking-normal">· {answer.citations.length}</span>
                </div>
                <div className="space-y-2">
                  {answer.citations.map((c, i) => (
                    <CitationItem
                      key={`${c.doc_id}-${c.article_ref}-${i}`}
                      citation={c}
                      index={i + 1}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {answer.references.length > 0 ? (
              <div className="mt-5 border-t border-foreground/[0.07] pt-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  References
                </div>
                <ol className="space-y-1">
                  {answer.references.map((ref, i) => (
                    <li key={i}>
                      <ArabicText className="text-xs leading-relaxed text-muted-foreground">
                        {ref}
                      </ArabicText>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
