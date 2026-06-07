'use client'

import * as React from 'react'

import { ArabicText } from '@/components/shared/arabic-text'
import { cn } from '@/lib/utils'
import type { Article } from '@/lib/types'
import { settleScroll } from './scroll'
import {
  HIERARCHY_LEVELS,
  estimateArticleHeight,
  levelLabel,
  statusMeta,
  type ArticleIndex,
} from './utils'

/** content-visibility keeps the 1000+ offscreen Arabic blocks cheap while leaving
 *  every block in the DOM (so the ref registry + deep-link scroll always resolve).
 *  Cast because `contentVisibility`/`containIntrinsicSize` aren't in all csstype. */
function cvStyle(h: number): React.CSSProperties {
  return {
    contentVisibility: 'auto',
    containIntrinsicSize: `auto ${h}px`,
  } as React.CSSProperties
}

function Breadcrumb({ ancestors }: { ancestors: Record<string, string> }) {
  const parts = HIERARCHY_LEVELS.filter((l) => ancestors[l]).map((l) => ({
    level: l,
    value: ancestors[l],
  }))
  if (parts.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-muted-foreground" dir="ltr">
      {parts.map((p, i) => (
        <React.Fragment key={p.level}>
          {i > 0 ? <span className="text-muted-foreground/40">/</span> : null}
          <span className="uppercase tracking-wide text-muted-foreground/60">
            {levelLabel(p.level)}
          </span>
          <span dir="rtl" className="arabic text-foreground/65">
            {p.value}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

/**
 * The readable LEFT pane: every article of the document as RTL Arabic, anchored
 * by its unique `eid`. Owns its own scroll container + ref registry and re-centers
 * on the selected article (settle loop handles content-visibility drift). The
 * header (article number + breadcrumb + status) is the select affordance —
 * clicking it selects the article (syncing the tree + XML pane + URL); the body
 * stays free for reading. The selected article carries a persistent accent; a
 * transient `flashEid` pulses on navigation.
 */
export function TextPane({
  index,
  selectedEid,
  flashEid,
  onSelect,
  reduceMotion,
  className,
}: {
  index: ArticleIndex
  selectedEid: string | null
  flashEid: string | null
  onSelect: (eid: string) => void
  reduceMotion: boolean
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const refs = React.useRef(new Map<string, HTMLElement>())

  const register = React.useCallback((eid: string, el: HTMLElement | null) => {
    if (el) refs.current.set(eid, el)
    else refs.current.delete(eid)
  }, [])

  React.useEffect(() => {
    if (!selectedEid) return
    settleScroll(refs.current.get(selectedEid), containerRef.current, reduceMotion)
  }, [selectedEid, index, reduceMotion])

  return (
    <div
      ref={containerRef}
      className={cn('scrollbar-thin overflow-y-auto', className)}
    >
      <div className="divide-y divide-foreground/[0.06]">
        {index.ordered.map((article) => (
          <ArticleBlock
            key={article.eid}
            article={article}
            selected={article.eid === selectedEid}
            flashing={article.eid === flashEid}
            onSelect={onSelect}
            register={register}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
    </div>
  )
}

const ArticleBlock = React.memo(function ArticleBlock({
  article,
  selected,
  flashing,
  onSelect,
  register,
  reduceMotion,
}: {
  article: Article
  selected: boolean
  flashing: boolean
  onSelect: (eid: string) => void
  register: (eid: string, el: HTMLElement | null) => void
  reduceMotion: boolean
}) {
  const status = statusMeta(article.status)
  const paragraphs = article.paragraphs.length ? article.paragraphs : [article.text_ar]

  return (
    <article
      ref={(el) => register(article.eid, el)}
      data-eid={article.eid}
      style={cvStyle(estimateArticleHeight(article))}
      className={cn(
        'relative scroll-mt-4 px-4 py-5 transition-colors',
        reduceMotion ? '' : 'duration-700 ease-spring',
        selected ? 'bg-primary/[0.05]' : 'hover:bg-foreground/[0.015]',
        flashing && !reduceMotion && 'bg-primary/[0.10]',
      )}
    >
      {/* selection accent rail */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 rounded-full transition-opacity',
          reduceMotion ? '' : 'duration-700 ease-spring',
          selected || flashing ? 'bg-primary opacity-100' : 'opacity-0',
        )}
      />

      <button
        type="button"
        onClick={() => onSelect(article.eid)}
        className="group/header mb-2 flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 text-left focus-visible:outline-none"
        dir="ltr"
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[12px] transition-colors',
            selected
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-foreground/12 bg-foreground/[0.03] text-foreground/80 group-hover/header:border-primary/30',
          )}
        >
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Art.
          </span>
          <span className="nums">{article.article_ref}</span>
        </span>
        <Breadcrumb ancestors={article.ancestors} />
        {status ? (
          <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium', status.tone)}>
            {status.label}
          </span>
        ) : null}
      </button>

      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <ArabicText key={i} className="text-[15.5px] leading-loose text-foreground/90">
            {p}
          </ArabicText>
        ))}
      </div>
    </article>
  )
})
