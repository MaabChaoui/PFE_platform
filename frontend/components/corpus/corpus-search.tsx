'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { ErrorState } from '@/components/shared/states'
import { Input } from '@/components/ui/input'
import { searchCorpus } from '@/lib/api'
import type { SearchHit } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Debounce a fast-changing value (search box keystrokes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const MIN_QUERY = 2

/**
 * Cross-corpus / in-document search. TanStack supplies the AbortSignal so a
 * superseded query is cancelled; the input is debounced so we don't fire per
 * keystroke. Scope is set by `docId` (in-doc) or left undefined (whole corpus),
 * with an optional `type` facet. Offline-safe: empty/error states, never a throw.
 */
export function useCorpusSearch(
  query: string,
  opts: { docId?: string; type?: string } = {},
) {
  const debounced = useDebounced(query.trim(), 300)
  const enabled = debounced.length >= MIN_QUERY
  const result = useQuery({
    queryKey: ['corpus-search', debounced, opts.docId ?? null, opts.type ?? null],
    queryFn: ({ signal }) =>
      searchCorpus({ q: debounced, doc_id: opts.docId, type: opts.type }, signal),
    enabled,
  })
  return { ...result, enabled, debounced }
}

export function CorpusSearchBox({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  busy,
  autoFocus,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
  placeholder?: string
  busy?: boolean
  autoFocus?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="h-11 rounded-xl border-foreground/15 bg-background/60 pl-10 pr-10 text-[13px]"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
        ) : value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Highlight occurrences of the query tokens inside an Arabic snippet. */
function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().split(/\s+/).filter((t) => t.length >= 2)
  if (tokens.length === 0) return <>{text}</>
  // Build a single regex of escaped tokens; matching is best-effort (Arabic
  // normalisation lives server-side, this is purely a visual aid).
  const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${esc.join('|')})`, 'gi')
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark
            key={i}
            className="rounded bg-primary/25 px-0.5 text-foreground"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

export function SearchResultList({
  hits,
  query,
  onSelect,
  showDocTitle = true,
  className,
}: {
  hits: SearchHit[]
  query: string
  onSelect: (hit: SearchHit) => void
  showDocTitle?: boolean
  className?: string
}) {
  return (
    <ul className={cn('space-y-2', className)}>
      {hits.map((hit, i) => {
        const lawNum = hit.doc_id.split('_')[0] || hit.doc_id
        return (
          <li key={`${hit.doc_id}#${hit.article_ref}#${i}`}>
            <button
              type="button"
              onClick={() => onSelect(hit)}
              className="group w-full rounded-xl border border-foreground/[0.08] bg-card/40 p-3 text-left transition-all duration-300 ease-spring hover:border-primary/35 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              <div className="mb-1.5 flex items-center gap-2" dir="ltr">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.07] px-2 py-0.5 font-mono text-[11px] text-primary">
                  art. {hit.article_ref}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {lawNum}
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
                  {hit.score.toFixed(0)}
                </span>
              </div>
              {showDocTitle ? (
                <ArabicText lines={1} className="mb-1 text-[12px] text-foreground/70">
                  {hit.doc_title}
                </ArabicText>
              ) : null}
              <ArabicText lines={2} className="text-[12.5px] leading-relaxed text-foreground/85">
                <HighlightedSnippet text={hit.snippet} query={query} />
              </ArabicText>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Loading / empty / error wrapper for a search results region. */
export function SearchResultsRegion({
  query,
  enabled,
  isFetching,
  isError,
  error,
  hits,
  onSelect,
  showDocTitle = true,
  emptyHint,
}: {
  query: string
  enabled: boolean
  isFetching: boolean
  isError: boolean
  error: unknown
  hits: SearchHit[] | undefined
  onSelect: (hit: SearchHit) => void
  showDocTitle?: boolean
  emptyHint?: string
}) {
  if (!enabled) {
    return (
      <p className="px-1 py-6 text-center text-[12.5px] text-muted-foreground">
        {emptyHint ?? 'Type at least 2 characters to search the Arabic text.'}
      </p>
    )
  }
  if (isError) {
    return <ErrorState error={error} className="py-8" />
  }
  if (!hits) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Searching…
      </div>
    )
  }
  if (hits.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-[12.5px] text-muted-foreground">
        No articles match “{query.trim()}”.
      </p>
    )
  }
  return (
    <div className={cn('space-y-2 transition-opacity', isFetching && 'opacity-60')}>
      <SearchResultList
        hits={hits}
        query={query}
        onSelect={onSelect}
        showDocTitle={showDocTitle}
      />
    </div>
  )
}
