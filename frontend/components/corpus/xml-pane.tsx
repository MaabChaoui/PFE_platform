'use client'

import * as React from 'react'
import { Loader2, Zap } from 'lucide-react'

import { ErrorState } from '@/components/shared/states'
import { cn } from '@/lib/utils'
import { settleScroll } from './scroll'
import { XML_CLS, highlightXmlToHtml } from './xml-highlight'

/** Above this element count we skip the React tree and use the cheaper highlighted
 *  <pre> (the 3 biggest laws). Keeps the structured view for the other ~42 docs. */
const TREE_ELEMENT_LIMIT = 3500
const FLASH_CLASSES = ['bg-primary/15', 'rounded-md'] as const

type Parsed =
  | { mode: 'tree'; root: Element }
  | { mode: 'pre'; html: string }
  | null

function parseXml(xml: string | undefined): Parsed {
  if (!xml || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return null
  }
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const err = doc.querySelector('parsererror')
    const root = doc.documentElement
    if (err || !root) return { mode: 'pre', html: highlightXmlToHtml(xml) }
    if (doc.getElementsByTagName('*').length > TREE_ELEMENT_LIMIT) {
      return { mode: 'pre', html: highlightXmlToHtml(xml) }
    }
    return { mode: 'tree', root }
  } catch {
    return { mode: 'pre', html: highlightXmlToHtml(xml) }
  }
}

/**
 * The raw AKN XML (RIGHT pane), lazily fetched by the reader (only when this pane
 * is visible). Primary renderer: a DOMParser-built, tag-coloured, eId-addressable
 * tree; for the largest documents (or a parse error) it falls back to a single
 * highlighted <pre> (`dangerouslySetInnerHTML`) — far cheaper to mount. Selecting
 * an article (anywhere) scrolls this pane to the matching `eId` and flashes it.
 */
export function XmlPane({
  xml,
  isLoading,
  isError,
  error,
  onRetry,
  selectedEid,
  reduceMotion,
  className,
}: {
  xml: string | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  selectedEid: string | null
  reduceMotion: boolean
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const refs = React.useRef(new Map<string, HTMLElement>())
  const parsed = React.useMemo(() => parseXml(xml), [xml])

  const register = React.useCallback((eid: string, el: HTMLElement | null) => {
    if (el) refs.current.set(eid, el)
    else refs.current.delete(eid)
  }, [])

  // Scroll + flash the matching eId when the selection (or the parsed doc) changes.
  React.useEffect(() => {
    if (!selectedEid || !parsed) return
    const container = containerRef.current
    let el: HTMLElement | null | undefined
    if (parsed.mode === 'tree') {
      el = refs.current.get(selectedEid)
    } else if (container) {
      el = Array.from(container.querySelectorAll<HTMLElement>('[data-eid]')).find(
        (n) => n.getAttribute('data-eid') === selectedEid,
      )
    }
    if (!el) return
    settleScroll(el, container, reduceMotion)
    el.classList.add(...FLASH_CLASSES)
    const t = setTimeout(() => el?.classList.remove(...FLASH_CLASSES), 1500)
    return () => clearTimeout(t)
  }, [selectedEid, parsed, reduceMotion])

  if (isError) {
    return (
      <div className={cn('grid place-items-center p-6', className)}>
        <ErrorState error={error} onRetry={onRetry} title="Could not load the AKN XML" />
      </div>
    )
  }
  if (isLoading || !parsed) {
    return (
      <div className={cn('flex items-center justify-center gap-2 p-10 text-[12.5px] text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Loading AKN XML…
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={cn('scrollbar-thin overflow-auto bg-foreground/[0.015]', className)}
    >
      {parsed.mode === 'pre' ? (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-foreground/[0.06] bg-background/85 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            <Zap className="h-3 w-3 text-gold" />
            Large document — fast highlighted view
          </div>
          <pre
            className="whitespace-pre-wrap break-words px-3 py-3 font-mono text-[11.5px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        </>
      ) : (
        <div className="px-3 py-3 font-mono text-[11.5px] leading-relaxed">
          <XmlNode el={parsed.root} depth={0} register={register} />
        </div>
      )}
    </div>
  )
}

function XmlNode({
  el,
  depth,
  register,
}: {
  el: Element
  depth: number
  register: (eid: string, node: HTMLElement | null) => void
}) {
  const eid = el.getAttribute('eId')
  const attrs = Array.from(el.attributes)
  const childNodes = Array.from(el.childNodes)
  const hasElementChildren = childNodes.some((n) => n.nodeType === 1)
  const indent: React.CSSProperties = { paddingLeft: `${depth * 14}px` }

  const openTag = (selfClose: boolean) => (
    <>
      <span className={XML_CLS.punc}>&lt;</span>
      <span className={XML_CLS.tag}>{el.tagName}</span>
      {attrs.map((a, i) => (
        <React.Fragment key={i}>
          {' '}
          <span className={XML_CLS.attr}>{a.name}</span>
          <span className={XML_CLS.punc}>=</span>
          <span className={XML_CLS.val}>&quot;{a.value}&quot;</span>
        </React.Fragment>
      ))}
      <span className={XML_CLS.punc}>{selfClose ? '/>' : '>'}</span>
    </>
  )
  const closeTag = (
    <>
      <span className={XML_CLS.punc}>&lt;/</span>
      <span className={XML_CLS.tag}>{el.tagName}</span>
      <span className={XML_CLS.punc}>&gt;</span>
    </>
  )

  const refCb = eid ? (node: HTMLDivElement | null) => register(eid, node) : undefined

  if (!hasElementChildren) {
    const text = (el.textContent ?? '').trim()
    return (
      <div ref={refCb} data-eid={eid ?? undefined} style={indent} className="scroll-mt-4 whitespace-pre-wrap break-words">
        {openTag(text === '')}
        {text !== '' ? (
          <>
            <span className={XML_CLS.text}>{text}</span>
            {closeTag}
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={refCb} data-eid={eid ?? undefined} className="scroll-mt-4">
      <div style={indent} className="whitespace-pre-wrap break-words">
        {openTag(false)}
      </div>
      {childNodes.map((n, i) => {
        if (n.nodeType === 1) {
          return <XmlNode key={i} el={n as Element} depth={depth + 1} register={register} />
        }
        if (n.nodeType === 3 && (n.textContent ?? '').trim()) {
          return (
            <div
              key={i}
              style={{ paddingLeft: `${(depth + 1) * 14}px` }}
              className="whitespace-pre-wrap break-words"
            >
              <span className={XML_CLS.text}>{(n.textContent ?? '').trim()}</span>
            </div>
          )
        }
        return null
      })}
      <div style={indent} className="whitespace-pre-wrap break-words">
        {closeTag}
      </div>
    </div>
  )
}
