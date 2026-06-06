'use client'

import * as React from 'react'
import { ListFilter, Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Stats } from '@/lib/types'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FACETS, boolOptionLabel } from './utils'

const ALL = '__all__'

export interface AppliedFilters {
  query_type?: string
  difficulty?: string
  category?: string
  answerable?: string
  language?: string
  split?: string
}

function FacetSelect({
  label,
  options,
  value,
  boolean,
  onChange,
}: {
  label: string
  options: string[]
  value: string | undefined
  boolean?: boolean
  onChange: (v: string | undefined) => void
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger
        className={cn(
          'h-9 w-full text-[13px]',
          value ? 'border-primary/45 bg-primary/[0.04]' : 'bg-background',
        )}
        aria-label={label}
      >
        <span className="truncate">
          <span className="text-muted-foreground">{label}: </span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {boolean ? boolOptionLabel(o) : humanize(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The benchmark filter toolbar: a debounced free-text search (the `q` param) plus
 * one Select per facet, sourced entirely from /benchmark/stats (nothing hardcoded).
 * URL is the single source of truth — this is a controlled component; the explorer
 * owns the state and writes every change back to the query string.
 */
export function BenchmarkFilters({
  stats,
  applied,
  search,
  onSearchChange,
  onFacetChange,
  onReset,
  resultCount,
  loading,
}: {
  stats: Stats | undefined
  applied: AppliedFilters
  search: string
  onSearchChange: (v: string) => void
  onFacetChange: (facet: keyof AppliedFilters, value: string | undefined) => void
  onReset: () => void
  resultCount: number | null
  loading?: boolean
}) {
  const activeCount =
    Object.values(applied).filter(Boolean).length + (search.trim() ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search questions (Arabic or English)…"
          className="h-10 pl-9 pr-9"
          aria-label="Search questions"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {FACETS.map((facet) => {
          const map = (stats?.[facet.key] ?? {}) as Record<string, number>
          const options = Object.keys(map).sort((a, b) =>
            facet.boolean ? a.localeCompare(b) : a.localeCompare(b),
          )
          return (
            <FacetSelect
              key={facet.key}
              label={facet.label}
              options={options}
              boolean={facet.boolean}
              value={applied[facet.key]}
              onChange={(v) => onFacetChange(facet.key, v)}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <ListFilter className="h-3.5 w-3.5" />
          {loading ? (
            <span>Filtering…</span>
          ) : resultCount !== null ? (
            <span>
              <span className="nums font-mono font-semibold text-foreground">
                {resultCount}
              </span>{' '}
              question{resultCount === 1 ? '' : 's'}
              {activeCount > 0 ? ' match the filters' : ' total'}
            </span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-1 font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <X className="h-3 w-3" />
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
