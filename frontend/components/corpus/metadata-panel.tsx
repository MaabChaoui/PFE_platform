'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { cn } from '@/lib/utils'
import { fmtInt } from '@/lib/format'
import type { DocumentDetail } from '@/lib/types'
import { DocTypeBadge, FormatChips } from './format-chips'
import {
  levelCounts,
  levelLabel,
  statusMeta,
  structureDepth,
  type ArticleIndex,
} from './utils'

function Fact({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[12.5px] text-foreground/85">{children}</div>
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="flex items-start gap-1.5" dir="ltr">
      <code className="min-w-0 flex-1 break-all rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-1 font-mono text-[11px] text-foreground/75">
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            },
            () => undefined,
          )
        }}
        aria-label="Copy FRBR URI"
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-foreground/[0.08] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}

/**
 * FRBR + structure metadata for the open document. The status distribution is
 * rendered honestly: the S1 backend doesn't record per-article status, so rather
 * than draw an always-empty chart we say so (and light up automatically if status
 * ever lands). The FRBR URI is read from the first article (DocumentDetail has no
 * top-level frbr_uri; ArticleModel carries it).
 */
export function MetadataPanel({
  detail,
  index,
}: {
  detail: DocumentDetail
  index: ArticleIndex
}) {
  const frbr = detail.articles[0]?.frbr_uri ?? null
  const depth = structureDepth(detail.hierarchy)
  const counts = levelCounts(detail.hierarchy)
  const levelOrder = ['book', 'part', 'title', 'chapter', 'section', 'subsection']
  const presentLevels = levelOrder.filter((l) => counts[l])

  const statusCounts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const a of index.ordered) {
      const m = statusMeta(a.status)
      if (m) map.set(m.label, (map.get(m.label) ?? 0) + 1)
    }
    return map
  }, [index])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Fact label="Type">
          <DocTypeBadge type={detail.type} />
        </Fact>
        <Fact label="Date">
          <span className="font-mono">{detail.date}</span>
        </Fact>
        <Fact label="Articles">
          <span className="nums font-mono">{fmtInt(detail.article_count)}</span>
        </Fact>
        <Fact label="Structure depth">
          <span className="nums font-mono">{depth}</span>{' '}
          <span className="text-muted-foreground">level{depth === 1 ? '' : 's'}</span>
        </Fact>
      </div>

      <Fact label="Title">
        <ArabicText className="text-[13px] leading-relaxed text-foreground/90">
          {detail.title}
        </ArabicText>
      </Fact>

      {frbr ? (
        <Fact label="FRBR work URI">
          <CopyField value={frbr} />
        </Fact>
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Fact label="Document id">
          <code className="font-mono text-[11px] text-foreground/75">{detail.doc_id}</code>
        </Fact>
        <Fact label="File stem">
          <code className="break-all font-mono text-[11px] text-foreground/75">
            {detail.filename_stem}
          </code>
        </Fact>
      </div>

      <Fact label="Source formats">
        <FormatChips formats={detail.formats_available} />
      </Fact>

      {presentLevels.length > 0 ? (
        <Fact label="Structure">
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {presentLevels.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-0.5 text-[11px]"
              >
                <span className="nums font-mono text-foreground/85">{counts[l]}</span>
                <span className="text-muted-foreground">{levelLabel(l)}{counts[l] === 1 ? '' : 's'}</span>
              </span>
            ))}
          </div>
        </Fact>
      ) : null}

      <Fact label="Article status">
        {statusCounts.size > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from(statusCounts.entries()).map(([label, n]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.03] px-2 py-0.5 text-[11px]"
              >
                <span className="nums font-mono text-foreground/85">{n}</span>
                <span className="text-muted-foreground">{label}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11.5px] text-muted-foreground/80">
            Per-article status is not recorded in this corpus.
          </span>
        )}
      </Fact>
    </div>
  )
}
