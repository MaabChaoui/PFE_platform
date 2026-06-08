'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Network } from 'lucide-react'

import { ErrorState } from '@/components/shared/states'
import { ScrollArea } from '@/components/ui/scroll-area'
import { kgMeta, kgSubgraph } from '@/lib/api'
import type { KGMeta, KGSearchHit, Subgraph } from '@/lib/types'
import { usePrefersReducedMotion } from '@/lib/use-pipeline-stream'
import { cn } from '@/lib/utils'
import { FiltersPanel, type FiltersValue } from './filters'
import { GraphCanvas, type GraphCanvasHandle } from './graph-canvas'
import { Legend } from './legend'
import { NodeInspector, type ExpandMeta } from './node-inspector'
import {
  allEdgeTypes,
  allNodeTypes,
  drilldownDefaultEdgeTypes,
  nodeDisplayLabel,
  overviewDefaultEdgeTypes,
  overviewDefaultNodeTypes,
} from './palette'

const DEFAULT_DEPTH = 1
const DEFAULT_LIMIT = 250

/** A substantial but bounded law for the first overview paint. */
function pickDefaultDoc(meta: KGMeta): string | null {
  if (!meta.documents.length) return null
  const sized = [...meta.documents].sort((a, b) => b.nodes - a.nodes)
  const goldilocks = sized.filter((d) => d.nodes >= 30 && d.nodes <= 450)
  return (goldilocks[0] ?? sized[0]).doc_id
}

export function KgExplorer() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const reducedMotion = usePrefersReducedMotion()

  const metaQuery = useQuery({
    queryKey: ['kg-meta'],
    queryFn: ({ signal }) => kgMeta(signal),
    staleTime: 5 * 60_000,
  })
  const meta = metaQuery.data ?? null

  const [filters, setFilters] = React.useState<FiltersValue | null>(null)
  const [seedNodeId, setSeedNodeId] = React.useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [seedLabel, setSeedLabel] = React.useState<string | null>(null)
  const [counts, setCounts] = React.useState({ nodes: 0, edges: 0 })
  const [expandMap, setExpandMap] = React.useState<Record<string, ExpandMeta>>({})
  const [expandError, setExpandError] = React.useState<string | null>(null)

  const canvasRef = React.useRef<GraphCanvasHandle | null>(null)
  const initRef = React.useRef(false)
  const focusedRef = React.useRef<string | null>(null)
  // The last `?node=` value WE wrote — so the URL effect below can tell our own
  // selection writes apart from a genuine external navigation (and not re-seed
  // on every in-graph click, where `sp` lags a render behind `selectedNodeId`).
  const selfNavRef = React.useRef<string | null>(null)

  // ── URL helper (mirrors the corpus shell; URLSearchParams encodes `#`/Arabic) ──
  const setNodeParam = React.useCallback(
    (id: string | null) => {
      selfNavRef.current = id
      const next = new URLSearchParams(Array.from(sp.entries()))
      if (id) next.set('node', id)
      else next.delete('node')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [sp, router, pathname],
  )

  // ── one-time init once meta lands: deep-link drill vs default overview ──
  React.useEffect(() => {
    if (!meta || initRef.current) return
    initRef.current = true
    const node = sp.get('node')
    if (node) {
      selfNavRef.current = node
      setSelectedNodeId(node)
      setSeedNodeId(node)
      setFilters({
        mode: 'drill',
        docId: null,
        nodeTypes: allNodeTypes(meta),
        edgeTypes: drilldownDefaultEdgeTypes(meta),
        depth: DEFAULT_DEPTH,
        limit: DEFAULT_LIMIT,
      })
    } else {
      setFilters({
        mode: 'overview',
        docId: pickDefaultDoc(meta),
        nodeTypes: overviewDefaultNodeTypes(meta),
        edgeTypes: overviewDefaultEdgeTypes(meta),
        depth: DEFAULT_DEPTH,
        limit: DEFAULT_LIMIT,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta])

  // ── subsequent external `?node=` changes (paste / back-forward nav only) ──
  // Deps are [sp, meta] (NOT selectedNodeId): the effect must fire only when the
  // URL itself changes. `selfNavRef` filters out our own writes, so an in-graph
  // click never re-seeds the base graph.
  React.useEffect(() => {
    if (!meta || !initRef.current) return
    const node = sp.get('node')
    if (!node || node === selfNavRef.current) return
    selfNavRef.current = node
    setSelectedNodeId(node)
    setSeedNodeId(node)
    focusedRef.current = null
    setFilters((f) =>
      f
        ? {
            ...f,
            mode: 'drill',
            nodeTypes: allNodeTypes(meta),
            edgeTypes: drilldownDefaultEdgeTypes(meta),
          }
        : f,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, meta])

  // ── base subgraph query ──
  const baseEnabled =
    !!meta &&
    !!filters &&
    filters.nodeTypes.length > 0 &&
    (filters.mode === 'overview' ? !!filters.docId : !!seedNodeId)

  const nodeFilter =
    meta && filters && filters.nodeTypes.length < meta.node_types.length
      ? filters.nodeTypes
      : undefined
  const edgeFilter =
    meta && filters && filters.edgeTypes.length < meta.edge_types.length
      ? filters.edgeTypes
      : undefined

  const baseQuery = useQuery({
    queryKey: [
      'kg-subgraph',
      filters?.mode,
      filters?.docId,
      seedNodeId,
      filters?.depth,
      filters?.limit,
      nodeFilter?.join(',') ?? 'all',
      edgeFilter?.join(',') ?? 'all',
    ],
    queryFn: ({ signal }) =>
      kgSubgraph(
        filters!.mode === 'overview'
          ? {
              doc_id: filters!.docId ?? undefined,
              node_types: nodeFilter,
              edge_types: edgeFilter,
              depth: filters!.depth,
              limit: filters!.limit,
            }
          : {
              seed: seedNodeId!,
              node_types: nodeFilter,
              edge_types: edgeFilter,
              depth: filters!.depth,
              limit: filters!.limit,
            },
        signal,
      ),
    enabled: baseEnabled,
  })

  const base: Subgraph | null = baseQuery.data ?? null

  // reset transient per-seed state when the base graph is re-seeded
  React.useEffect(() => {
    setExpandMap({})
    setExpandError(null)
  }, [filters?.mode, filters?.docId, seedNodeId])

  // recentre on the seed once its graph has loaded (deep-link / search only)
  React.useEffect(() => {
    if (!base) return
    if (selectedNodeId && selectedNodeId === seedNodeId && focusedRef.current !== selectedNodeId) {
      canvasRef.current?.focus(selectedNodeId)
      focusedRef.current = selectedNodeId
    }
  }, [base, selectedNodeId, seedNodeId])

  // ── handlers ──
  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedNodeId(id)
      setNodeParam(id)
    },
    [setNodeParam],
  )

  const handleSearchPick = React.useCallback(
    (hit: KGSearchHit) => {
      setSeedNodeId(hit.id)
      setSelectedNodeId(hit.id)
      setSeedLabel(nodeDisplayLabel(hit))
      focusedRef.current = null
      setNodeParam(hit.id)
      setFilters((f) => (f && f.mode !== 'drill' ? { ...f, mode: 'drill' } : f))
    },
    [setNodeParam],
  )

  const patchFilters = React.useCallback(
    (patch: Partial<FiltersValue>) => {
      if (!meta) return
      setFilters((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...patch }
        if (patch.mode && patch.mode !== prev.mode) {
          if (patch.mode === 'overview') {
            next.nodeTypes = overviewDefaultNodeTypes(meta)
            next.edgeTypes = overviewDefaultEdgeTypes(meta)
            if (!next.docId) next.docId = pickDefaultDoc(meta)
          } else {
            next.nodeTypes = allNodeTypes(meta)
            next.edgeTypes = drilldownDefaultEdgeTypes(meta)
          }
        }
        return next
      })
    },
    [meta],
  )

  const handleExpandFromInspector = React.useCallback((id: string) => {
    canvasRef.current?.expand(id)
  }, [])

  // ── states ──
  if (metaQuery.isLoading || (!meta && metaQuery.isFetching)) {
    return <WorkbenchSkeleton />
  }
  if (metaQuery.isError || !meta) {
    return (
      <ErrorState
        error={metaQuery.error}
        onRetry={() => metaQuery.refetch()}
        title="Could not load the knowledge graph"
      />
    )
  }
  if (!filters) return <WorkbenchSkeleton />

  const truncated = base?.truncated ?? false
  const contextLabel =
    filters.mode === 'overview'
      ? `Law overview · ${filters.docId ?? '—'}`
      : `Drill-down · ${seedLabel ?? (seedNodeId ? 'seeded node' : 'pick a node')}`

  return (
    <div
      className="space-y-3"
      data-kg-ready="true"
      data-kg-mode={filters.mode}
      data-kg-nodes={counts.nodes}
      data-kg-edges={counts.edges}
      data-kg-truncated={String(truncated)}
      data-kg-selected={selectedNodeId ?? ''}
    >
      {/* context bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/[0.07] bg-card/40 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Network className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium text-foreground" title={contextLabel}>
            {contextLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="nums rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-1 tabular-nums text-muted-foreground">
            {counts.nodes.toLocaleString()} nodes · {counts.edges.toLocaleString()} edges
          </span>
          {truncated ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-warning">
              <AlertTriangle className="h-3 w-3" />
              capped · {(base?.total_neighbors ?? 0).toLocaleString()} more
            </span>
          ) : null}
        </div>
      </div>

      {/* workbench */}
      <div className="lg:grid lg:h-[calc(100vh-17rem)] lg:min-h-[560px] lg:grid-cols-[19rem_minmax(0,1fr)_22rem] lg:gap-4">
        {/* left rail: filters + legend */}
        <Panel className="mb-3 max-h-[58vh] lg:mb-0 lg:max-h-none">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-4">
              <FiltersPanel
                meta={meta}
                value={filters}
                seedLabel={seedLabel}
                onChange={patchFilters}
                onSearchPick={handleSearchPick}
              />
              <div className="border-t border-foreground/[0.07] pt-4">
                <Legend
                  meta={meta}
                  visibleTypes={new Set(base?.nodes.map((n) => n.type ?? 'Unknown'))}
                />
              </div>
            </div>
          </ScrollArea>
        </Panel>

        {/* canvas */}
        <Panel className="mb-3 h-[60vh] lg:mb-0 lg:h-full">
          <div className="relative h-full">
            {filters.nodeTypes.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  No node types selected — pick at least one in the filters to draw the graph.
                </p>
              </div>
            ) : (
              <GraphCanvas
                ref={canvasRef}
                base={base}
                meta={meta}
                selectedId={selectedNodeId}
                reducedMotion={reducedMotion}
                nodeTypes={filters.nodeTypes}
                edgeTypes={filters.edgeTypes}
                depth={filters.depth}
                limit={filters.limit}
                baseLoading={baseQuery.isFetching}
                onSelect={handleSelect}
                onExpand={(r) =>
                  setExpandMap((m) => ({
                    ...m,
                    [r.id]: { truncated: r.truncated, total: r.total, added: r.added },
                  }))
                }
                onCounts={(n, e) => setCounts({ nodes: n, edges: e })}
                onExpandError={(msg) => setExpandError(msg)}
              />
            )}
            {baseQuery.isError ? (
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="min-w-0 flex-1">Could not load this subgraph.</span>
                  <button
                    type="button"
                    onClick={() => baseQuery.refetch()}
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : expandError ? (
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1">{expandError}</span>
                  <button
                    type="button"
                    onClick={() => setExpandError(null)}
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        {/* inspector */}
        <div className="h-[58vh] lg:h-full">
          <NodeInspector
            nodeId={selectedNodeId}
            meta={meta}
            expandMeta={selectedNodeId ? expandMap[selectedNodeId] : undefined}
            onExpand={handleExpandFromInspector}
            onClose={() => {
              setSelectedNodeId(null)
              setNodeParam(null)
            }}
          />
        </div>
      </div>
    </div>
  )
}

/** Double-bezel shell for the rail + canvas panels. */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card/60 p-1.5 shadow-card',
        className,
      )}
    >
      <div className="h-full overflow-hidden rounded-[calc(1rem-0.375rem)] border border-foreground/[0.05] bg-background/40 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
        {children}
      </div>
    </div>
  )
}

function WorkbenchSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-11 animate-pulse rounded-xl border border-foreground/[0.07] bg-card/40" />
      <div className="lg:grid lg:h-[calc(100vh-17rem)] lg:min-h-[560px] lg:grid-cols-[19rem_minmax(0,1fr)_22rem] lg:gap-4">
        <div className="mb-3 h-[40vh] animate-pulse rounded-2xl border border-foreground/[0.07] bg-card/40 lg:mb-0 lg:h-full" />
        <div className="mb-3 h-[60vh] animate-pulse rounded-2xl border border-foreground/[0.07] bg-card/40 lg:mb-0 lg:h-full" />
        <div className="h-[40vh] animate-pulse rounded-2xl border border-foreground/[0.07] bg-card/40 lg:h-full" />
      </div>
    </div>
  )
}
