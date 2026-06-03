'use client'

import Link from 'next/link'
import { Network, Scale } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface CitationChipProps {
  docId: string
  articleRef: string
  docTitle?: string | null
  versionDate?: string | null
  /** Optional ordinal shown as [n]. */
  index?: number
  /** When set, appends a small link to the node in the KG explorer. */
  kgNodeId?: string
  className?: string
}

/**
 * Compact, deep-linking citation pill. Primary link → the article in the corpus
 * explorer (`/corpus?doc=&article=`); optional secondary link → the KG explorer.
 * Tooltip surfaces the full law title + version. Reused by Main + Benchmark.
 */
export function CitationChip({
  docId,
  articleRef,
  docTitle,
  versionDate,
  index,
  kgNodeId,
  className,
}: CitationChipProps) {
  const corpusHref = `/corpus?doc=${encodeURIComponent(
    docId,
  )}&article=${encodeURIComponent(articleRef)}`
  const kgHref = kgNodeId ? `/kg?node=${encodeURIComponent(kgNodeId)}` : null
  // doc_id is "NUM_DATE"; show the law number, keep the full id in the tooltip.
  const lawNum = docId.split('_')[0] || docId

  return (
    <span
      className={cn(
        'group inline-flex max-w-full items-center overflow-hidden rounded-md border border-border bg-secondary/60 text-xs font-medium text-secondary-foreground transition-colors hover:border-gold/60',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={corpusHref}
            className="inline-flex min-w-0 items-center gap-1 px-2 py-0.5 hover:bg-secondary"
          >
            <Scale className="h-3 w-3 shrink-0 text-gold" />
            {index != null ? (
              <span className="text-muted-foreground">[{index}]</span>
            ) : null}
            <span className="nums whitespace-nowrap">art. {articleRef}</span>
            <span className="truncate text-muted-foreground">· {lawNum}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-0.5">
            {docTitle ? <div className="font-medium">{docTitle}</div> : null}
            <div className="text-muted-foreground">
              {docId} — article {articleRef}
              {versionDate ? ` · v. ${versionDate}` : ''}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
      {kgHref ? (
        <Link
          href={kgHref}
          aria-label="View in knowledge graph"
          className="flex items-center border-l border-border/70 px-1.5 py-0.5 text-muted-foreground hover:bg-secondary hover:text-gold"
        >
          <Network className="h-3 w-3" />
        </Link>
      ) : null}
    </span>
  )
}
