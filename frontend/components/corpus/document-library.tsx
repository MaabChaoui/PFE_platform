'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Inbox, Library, ListFilter } from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listDocuments } from '@/lib/api'
import type { DocumentSummary } from '@/lib/types'
import { fmtInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  CorpusSearchBox,
  SearchResultsRegion,
  useCorpusSearch,
} from './corpus-search'
import { DocTypeBadge, FormatChips } from './format-chips'
import { docTypeMeta, yearOf } from './utils'

export type SortKey = 'date_desc' | 'date_asc' | 'articles_desc' | 'title'

export interface LibraryState {
  /** Arabic full-text search across the corpus. */
  q: string
  /** Type facet ("" = all). */
  type: string
  /** Title / number filter on the list (LTR-ish match on id + Arabic title). */
  name: string
  sort: SortKey
}

export const DEFAULT_LIBRARY_STATE: LibraryState = {
  q: '',
  type: '',
  name: '',
  sort: 'date_asc',
}

const SORT_LABEL: Record<SortKey, string> = {
  date_asc: 'Oldest first',
  date_desc: 'Newest first',
  articles_desc: 'Most articles',
  title: 'Title (A→ي)',
}

function sortDocs(docs: DocumentSummary[], sort: SortKey): DocumentSummary[] {
  const out = [...docs]
  switch (sort) {
    case 'date_asc':
      return out.sort((a, b) => a.date.localeCompare(b.date) || a.doc_id.localeCompare(b.doc_id))
    case 'date_desc':
      return out.sort((a, b) => b.date.localeCompare(a.date) || a.doc_id.localeCompare(b.doc_id))
    case 'articles_desc':
      return out.sort((a, b) => b.article_count - a.article_count)
    case 'title':
      return out.sort((a, b) => a.title.localeCompare(b.title, 'ar'))
  }
}

/**
 * The corpus master view: the 45 official documents with type / date / sort
 * facets, a name-or-number filter, and an Arabic full-text search that searches
 * across the whole corpus. Selecting a doc (or a search hit) opens the reader.
 */
export function DocumentLibrary({
  state,
  onState,
  onOpenDoc,
}: {
  state: LibraryState
  onState: (patch: Partial<LibraryState>) => void
  onOpenDoc: (docId: string, articleRef?: string) => void
}) {
  const docsQuery = useQuery({
    queryKey: ['corpus-documents'],
    queryFn: ({ signal }) => listDocuments(signal),
  })
  const search = useCorpusSearch(state.q, { type: state.type || undefined })

  const docs = docsQuery.data
  const types = React.useMemo(() => {
    if (!docs) return []
    return Array.from(new Set(docs.map((d) => d.type))).sort()
  }, [docs])

  const filtered = React.useMemo(() => {
    if (!docs) return []
    const name = state.name.trim().toLowerCase()
    const matched = docs.filter((d) => {
      if (state.type && d.type !== state.type) return false
      if (name) {
        const hay = `${d.doc_id} ${d.title}`.toLowerCase()
        if (!hay.includes(name)) return false
      }
      return true
    })
    return sortDocs(matched, state.sort)
  }, [docs, state.type, state.name, state.sort])

  const searching = state.q.trim().length >= 2

  return (
    <div className="space-y-5">
      {/* ── controls ── */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-1.5 shadow-card">
        <div className="space-y-3 rounded-[calc(1rem-0.375rem)] bg-background/40 p-3.5 dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
          <CorpusSearchBox
            value={state.q}
            onChange={(q) => onState({ q })}
            onClear={() => onState({ q: '' })}
            busy={searching && search.isFetching}
            placeholder="Search the Arabic legal text across all 45 documents…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListFilter className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Filter
              </span>
            </div>
            <Select
              value={state.type || 'all'}
              onValueChange={(v) => onState({ type: v === 'all' ? '' : v })}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-lg text-[12.5px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {docTypeMeta(t).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={state.sort}
              onValueChange={(v) => onState({ sort: v as SortKey })}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-lg text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              value={state.name}
              onChange={(e) => onState({ name: e.target.value })}
              placeholder="Filter by name or number…"
              aria-label="Filter documents by name or number"
              className="h-9 min-w-[180px] flex-1 rounded-lg border border-input bg-background/60 px-3 text-[12.5px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            />
          </div>
        </div>
      </div>

      {/* ── results: cross-corpus search OR the document grid ── */}
      {searching ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-medium text-foreground/80">
              Full-text matches
            </h2>
            {search.data ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {fmtInt(search.data.length)} article{search.data.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <SearchResultsRegion
            query={state.q}
            enabled={search.enabled}
            isFetching={search.isFetching}
            isError={search.isError}
            error={search.error}
            hits={search.data}
            onSelect={(hit) => onOpenDoc(hit.doc_id, hit.article_ref)}
          />
        </div>
      ) : docsQuery.isError ? (
        <ErrorState error={docsQuery.error} onRetry={() => void docsQuery.refetch()} />
      ) : !docs ? (
        <RowsSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No documents match these filters"
          description="Clear the type or name filter to see the full corpus."
        />
      ) : (
        <>
          <div className="flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
            <Library className="h-3.5 w-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{filtered.length}</span> of{' '}
              {docs.length} documents
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filtered.map((doc, i) => (
              <DocumentCard
                key={doc.doc_id}
                doc={doc}
                index={i}
                onOpen={() => onOpenDoc(doc.doc_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DocumentCard({
  doc,
  index,
  onOpen,
}: {
  doc: DocumentSummary
  index: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 12) * 22}ms` }}
      className="group relative flex animate-fade-up flex-col rounded-2xl border border-foreground/[0.08] bg-card/40 p-1.5 text-left shadow-card transition-all duration-500 ease-spring hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:animate-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex h-full flex-col rounded-[calc(1rem-0.375rem)] bg-background/30 p-4 dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
        <div className="mb-3 flex items-center gap-2" dir="ltr">
          <DocTypeBadge type={doc.type} />
          <span className="font-mono text-[11px] text-muted-foreground">
            {doc.doc_id.split('_')[0]}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono text-[11px] text-muted-foreground">{yearOf(doc.date)}</span>
          <span className="ml-auto grid h-7 w-7 place-items-center rounded-full border border-foreground/10 text-muted-foreground transition-all duration-500 ease-spring group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary motion-reduce:transition-none">
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-500 ease-spring group-hover:translate-x-px group-hover:-translate-y-px motion-reduce:transition-none" />
          </span>
        </div>

        <ArabicText
          lines={2}
          className="mb-3 flex-1 text-[15px] font-medium leading-relaxed text-foreground"
        >
          {doc.title}
        </ArabicText>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-foreground/[0.06] pt-3">
          <span className="nums font-mono text-[11px] text-muted-foreground">
            {fmtInt(doc.article_count)} article{doc.article_count === 1 ? '' : 's'}
          </span>
          <FormatChips formats={doc.formats_available} size="xs" />
        </div>
      </div>
    </button>
  )
}
