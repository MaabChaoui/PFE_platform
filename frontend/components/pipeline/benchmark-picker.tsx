'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ErrorState, RowsSkeleton } from '@/components/shared/states'
import { listQuestions } from '@/lib/api'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { QUERY_TYPES, type QuestionSummary } from '@/lib/types'

import { isArabic } from './utils'

const PAGE_SIZE = 8

export function BenchmarkPicker({
  selectedId,
  onPick,
  className,
}: {
  selectedId: string | null
  onPick: (question: QuestionSummary) => void
  className?: string
}) {
  const [queryType, setQueryType] = React.useState<string>('all')
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  // Debounce the free-text search so we don't fire a request per keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Any filter change resets to the first page.
  React.useEffect(() => setPage(1), [queryType, search])

  const params = {
    query_type: queryType === 'all' ? undefined : queryType,
    q: search || undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['benchmark-questions', queryType, search, page],
    queryFn: ({ signal }) => listQuestions(params, signal),
    placeholderData: (prev) => prev,
  })

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.items ?? []

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span className="font-mono text-primary">◆</span>
          Benchmark library
        </div>
        <span className="nums font-mono text-[11px] text-muted-foreground">
          {total}
        </span>
      </div>

      {/* filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={queryType} onValueChange={setQueryType}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {QUERY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* list */}
      <div className="mt-3 min-h-0 flex-1">
        {isLoading ? (
          <RowsSkeleton rows={5} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} className="py-8" />
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No questions match.
          </div>
        ) : (
          <ul
            className={cn(
              'space-y-1.5 transition-opacity duration-200',
              isFetching && 'opacity-60',
            )}
          >
            {items.map((q) => {
              const selected = q.id === selectedId
              const rtl = isArabic(q.question)
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onPick(q)}
                    className={cn(
                      'group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-300 ease-spring',
                      selected
                        ? 'border-primary/50 bg-primary/[0.07] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)]'
                        : 'border-foreground/[0.08] bg-card/40 hover:-translate-y-px hover:border-foreground/20',
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Badge
                        variant={selected ? 'default' : 'muted'}
                        className="px-1.5 py-0 font-mono text-[9px]"
                      >
                        {humanize(q.query_type)}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground/70">
                        {q.id}
                      </span>
                      {q.has_prediction ? (
                        <span
                          title="Replay-ready"
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-success"
                        />
                      ) : (
                        <span
                          title="No precomputed prediction"
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground/15"
                        />
                      )}
                    </div>
                    <p
                      dir={rtl ? 'rtl' : undefined}
                      className={cn(
                        'line-clamp-2 text-[13px] leading-snug text-foreground/85',
                        rtl ? 'text-right font-arabic' : 'text-left',
                      )}
                    >
                      {q.question}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* pagination */}
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between border-t border-foreground/[0.07] pt-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="nums font-mono text-[11px] text-muted-foreground">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
