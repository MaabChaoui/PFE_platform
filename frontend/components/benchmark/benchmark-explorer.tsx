'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronDown, Inbox } from 'lucide-react'

import { ResultsSection } from '@/components/results/section'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/shared/states'
import { Skeleton } from '@/components/ui/skeleton'
import { benchmarkStats, listQuestions, type ListQuestionsArgs } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BenchStats } from './bench-stats'
import { BenchmarkFilters, type AppliedFilters } from './filters'
import { QuestionList } from './question-list'

const PAGE_SIZE = 25

/** Read a boolean facet ("true"/"false") off the URL into the API's bool param. */
function answerableParam(v: string | undefined): boolean | undefined {
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}

/**
 * The Benchmark page client. The URL query string is the single source of truth —
 * filters, search and page all live there (shareable / restorable), and the
 * TanStack query keys derive straight from it. The search box keeps a debounced
 * local mirror so typing stays snappy. Every fetch is abortable (TanStack passes
 * the signal) and superseded fetches are cancelled on key change.
 */
export function BenchmarkExplorer() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const listTop = React.useRef<HTMLDivElement>(null)
  const [showStats, setShowStats] = React.useState(true)

  // ── URL → applied state (the single source of truth) ──
  const applied: AppliedFilters = {
    query_type: sp.get('query_type') ?? undefined,
    difficulty: sp.get('difficulty') ?? undefined,
    category: sp.get('category') ?? undefined,
    answerable: sp.get('answerable') ?? undefined,
    language: sp.get('language') ?? undefined,
    split: sp.get('split') ?? undefined,
  }
  const urlQ = sp.get('q') ?? ''
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)

  const updateParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(Array.from(sp.entries()))
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') next.delete(k)
        else next.set(k, v)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [sp, router, pathname],
  )

  // ── search box: debounced local mirror that writes back to the URL ──
  const [searchInput, setSearchInput] = React.useState(urlQ)
  React.useEffect(() => {
    if (searchInput === urlQ) return
    const t = setTimeout(
      () => updateParams({ q: searchInput.trim() || null, page: null }),
      300,
    )
    return () => clearTimeout(t)
  }, [searchInput, urlQ, updateParams])
  // Pull external URL changes (back/forward, reset, stats click) into the box.
  React.useEffect(() => {
    setSearchInput(urlQ)
  }, [urlQ])

  // ── data ──
  const listArgs: ListQuestionsArgs = {
    query_type: applied.query_type,
    difficulty: applied.difficulty,
    category: applied.category,
    language: applied.language,
    split: applied.split,
    answerable: answerableParam(applied.answerable),
    q: urlQ.trim() || undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const stats = useQuery({
    queryKey: ['benchmark-stats'],
    queryFn: ({ signal }) => benchmarkStats(signal),
  })
  const questions = useQuery({
    queryKey: ['benchmark-questions', listArgs],
    queryFn: ({ signal }) => listQuestions(listArgs, signal),
    placeholderData: keepPreviousData,
  })

  const list = questions.data

  // ── handlers ──
  const onFacetChange = React.useCallback(
    (facet: keyof AppliedFilters, value: string | undefined) =>
      updateParams({ [facet]: value ?? null, page: null }),
    [updateParams],
  )
  const onPageChange = React.useCallback(
    (p: number) => {
      updateParams({ page: p <= 1 ? null : String(p) })
      listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [updateParams],
  )
  const onReset = React.useCallback(() => {
    setSearchInput('')
    router.replace(pathname, { scroll: false })
  }, [router, pathname])
  const onPickFromStats = React.useCallback(
    (facet: string, key: string) => {
      updateParams({ [facet]: key, page: null })
      listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [updateParams],
  )

  return (
    <div className="space-y-6">
      {/* ── Overview (deliverable 5) ── */}
      <ResultsSection
        index="01"
        eyebrow="Overview"
        title="Distribution"
        lede="How the 244 benchmark questions split across each facet. Click a bar to filter the list below."
        actions={
          <button
            type="button"
            onClick={() => setShowStats((s) => !s)}
            aria-expanded={showStats}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showStats ? 'Hide' : 'Show'}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-300 ease-spring motion-reduce:transition-none',
                showStats && 'rotate-180',
              )}
            />
          </button>
        }
      >
        {showStats ? (
          stats.data ? (
            <BenchStats
              stats={stats.data}
              applied={applied}
              onPick={onPickFromStats}
            />
          ) : stats.isError ? (
            <p className="text-sm text-muted-foreground">
              Distribution unavailable — the stats endpoint could not be reached.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-1.5 w-full" />
                  <Skeleton className="h-1.5 w-4/5" />
                  <Skeleton className="h-1.5 w-3/5" />
                </div>
              ))}
            </div>
          )
        ) : null}
      </ResultsSection>

      {/* ── Filters + list ── */}
      <div ref={listTop} className="scroll-mt-24">
        <ResultsSection
          index="02"
          eyebrow="Questions"
          title="Explore the benchmark"
          lede="Filter, search and page through every question; the per-row badge is AKN-RLM's verdict from the locked run. Open a question for its gold articles, prediction and diff."
        >
          <div className="space-y-5">
            <BenchmarkFilters
              stats={stats.data}
              applied={applied}
              search={searchInput}
              onSearchChange={setSearchInput}
              onFacetChange={onFacetChange}
              onReset={onReset}
              resultCount={list?.total ?? null}
              loading={questions.isFetching && !list}
            />

            {questions.isError && !list ? (
              <ErrorState
                error={questions.error}
                onRetry={() => void questions.refetch()}
              />
            ) : !list ? (
              <RowsSkeleton rows={8} />
            ) : list.items.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No questions match these filters"
                description="Try clearing a filter or broadening your search."
                action={
                  <button
                    type="button"
                    onClick={onReset}
                    className="rounded-full border border-foreground/15 px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Clear all filters
                  </button>
                }
              />
            ) : (
              <QuestionList
                data={list}
                onPageChange={onPageChange}
                dimmed={questions.isFetching && questions.isPlaceholderData}
              />
            )}
          </div>
        </ResultsSection>
      </div>
    </div>
  )
}
