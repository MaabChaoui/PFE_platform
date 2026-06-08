'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import type cytoscape from 'cytoscape'
import type { Core, ElementDefinition, EventObject } from 'cytoscape'
import { Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { kgSubgraph } from '@/lib/api'
import type { KGMeta, Subgraph } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  baseNodeSize,
  buildNodeColorRoles,
  edgeStyleFor,
  isArabic,
  nodeColorKey,
  nodeDisplayLabel,
  nodeShape,
  resolveThemeColors,
  truncateLabel,
  type NodeColorMap,
  type ThemeColors,
} from './palette'

// fcose is registered exactly once across the app (idempotent).
let fcoseRegistered = false

export interface GraphCanvasHandle {
  /** Lazily fetch + merge a node's neighbourhood (the explicit expand action). */
  expand: (id: string) => void
  /** Select + recentre on a node (used by deep-link / search). */
  focus: (id: string) => void
  fit: () => void
}

export interface ExpandResult {
  id: string
  added: number
  truncated: boolean
  total: number
}

interface GraphCanvasProps {
  /** The seeded base graph; replacing it resets the canvas (expansions cleared). */
  base: Subgraph | null
  meta: KGMeta
  selectedId: string | null
  reducedMotion: boolean
  /** Active filters — forwarded to lazy-expand requests so they stay scoped. */
  nodeTypes: string[]
  edgeTypes: string[]
  depth: number
  limit: number
  baseLoading?: boolean
  onSelect: (id: string) => void
  onExpand?: (r: ExpandResult) => void
  onCounts?: (nodes: number, edges: number) => void
  onExpandError?: (message: string) => void
  className?: string
}

// ───────────────────────── element + stylesheet builders ─────────────────────────

function nodeEl(node: Subgraph['nodes'][number]): ElementDefinition {
  const raw = nodeDisplayLabel(node)
  return {
    group: 'nodes',
    data: {
      id: node.id,
      type: node.type ?? 'Unknown',
      label: truncateLabel(raw, isArabic(raw) ? 22 : 30),
      rtl: isArabic(raw),
    },
  }
}

function edgeEl(edge: Subgraph['edges'][number]): ElementDefinition {
  const s = edgeStyleFor(edge.predicate)
  return {
    group: 'edges',
    data: {
      id: `e${edge.id}`,
      source: edge.source,
      target: edge.target,
      predicate: edge.predicate,
      role: s.role,
      width: s.width,
      lineStyle: s.lineStyle,
      opacity: s.opacity,
      arrow: s.arrow ? 'triangle' : 'none',
    },
  }
}

/** Build add-ready elements, dropping edges whose endpoints aren't present. */
function toElements(sub: Subgraph): ElementDefinition[] {
  const ids = new Set(sub.nodes.map((n) => n.id))
  const nodes = sub.nodes.map(nodeEl)
  const edges = sub.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map(edgeEl)
  return [...nodes, ...edges]
}

function buildStylesheet(colors: ThemeColors, roles: NodeColorMap): cytoscape.StylesheetStyle[] {
  const edgeColor = (ele: cytoscape.EdgeSingular) =>
    colors[(ele.data('role') as keyof ThemeColors) ?? 'mutedForeground']
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele: cytoscape.NodeSingular) =>
          colors[nodeColorKey(roles, ele.data('type'))],
        'background-opacity': 0.92,
        shape: ((ele: cytoscape.NodeSingular) =>
          nodeShape(ele.data('type'))) as unknown as cytoscape.Css.PropertyValueNode<cytoscape.Css.NodeShape>,
        width: (ele: cytoscape.NodeSingular) =>
          baseNodeSize(ele.data('type')) + Math.min(ele.degree(false), 16) * 1.6,
        height: (ele: cytoscape.NodeSingular) =>
          baseNodeSize(ele.data('type')) + Math.min(ele.degree(false), 16) * 1.6,
        'border-width': 1.5,
        'border-color': colors.background,
        'border-opacity': 0.85,
        label: 'data(label)',
        color: colors.foreground,
        'font-size': 9,
        'font-family':
          "'IBM Plex Sans Arabic', 'Noto Sans Arabic', ui-sans-serif, system-ui, sans-serif",
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 4,
        'text-max-width': '92px',
        'text-wrap': 'ellipsis',
        'text-background-color': colors.background,
        'text-background-opacity': 0.62,
        'text-background-padding': '2px',
        'transition-property': 'opacity, border-width, border-color',
        'transition-duration': 180,
      } as cytoscape.Css.Node,
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        width: (ele: cytoscape.EdgeSingular) => ele.data('width') as number,
        'line-color': edgeColor,
        'line-style': (ele: cytoscape.EdgeSingular) =>
          ele.data('lineStyle') as cytoscape.Css.LineStyle,
        opacity: (ele: cytoscape.EdgeSingular) => ele.data('opacity') as number,
        'target-arrow-color': edgeColor,
        'target-arrow-shape': (ele: cytoscape.EdgeSingular) =>
          ele.data('arrow') as cytoscape.Css.ArrowShape,
        'arrow-scale': 0.7,
      } as cytoscape.Css.Edge,
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': colors.primary,
        'border-opacity': 1,
        'overlay-color': colors.primary,
        'overlay-opacity': 0.16,
        'overlay-padding': 7,
      } as cytoscape.Css.Node,
    },
    {
      // Marked when an expand revealed more neighbours than were fetched.
      selector: 'node.has-more',
      style: {
        'border-width': 2.5,
        'border-color': colors.gold,
        'border-opacity': 0.95,
        'border-style': 'dashed',
      } as cytoscape.Css.Node,
    },
    {
      selector: 'node.dim',
      style: { opacity: 0.12 } as cytoscape.Css.Node,
    },
    {
      selector: 'edge.dim',
      style: { opacity: 0.04 } as cytoscape.Css.Edge,
    },
  ]
}

// ───────────────────────── component ─────────────────────────

export const GraphCanvas = React.forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas(props, ref) {
    const {
      base,
      meta,
      selectedId,
      reducedMotion,
      baseLoading,
      onSelect,
      onExpand,
      onCounts,
      onExpandError,
      className,
    } = props

    const { resolvedTheme } = useTheme()
    const containerRef = React.useRef<HTMLDivElement | null>(null)
    const [cy, setCy] = React.useState<Core | null>(null)
    const [expandingId, setExpandingId] = React.useState<string | null>(null)

    // Refs so event handlers + the imperative API read live values without rebinding.
    const onSelectRef = React.useRef(onSelect)
    const onExpandRef = React.useRef(onExpand)
    const onCountsRef = React.useRef(onCounts)
    const onErrRef = React.useRef(onExpandError)
    const reduceRef = React.useRef(reducedMotion)
    const paramsRef = React.useRef({
      depth: props.depth,
      limit: props.limit,
      nodeTypes: props.nodeTypes,
      edgeTypes: props.edgeTypes,
    })
    const expandCtrlRef = React.useRef<AbortController | null>(null)
    const lastTapRef = React.useRef<{ id: string; t: number }>({ id: '', t: 0 })

    React.useEffect(() => {
      onSelectRef.current = onSelect
      onExpandRef.current = onExpand
      onCountsRef.current = onCounts
      onErrRef.current = onExpandError
      reduceRef.current = reducedMotion
      paramsRef.current = {
        depth: props.depth,
        limit: props.limit,
        nodeTypes: props.nodeTypes,
        edgeTypes: props.edgeTypes,
      }
    })

    const reportCounts = React.useCallback((c: Core) => {
      onCountsRef.current?.(c.nodes().length, c.edges().length)
    }, [])

    const runLayout = React.useCallback((c: Core, warmStart: boolean) => {
      const reduce = reduceRef.current
      const layout = c.layout({
        name: 'fcose',
        quality: 'default',
        randomize: !warmStart,
        animate: reduce ? false : 'end',
        animationDuration: 520,
        fit: true,
        padding: 36,
        nodeSeparation: 80,
        nodeRepulsion: 6500,
        idealEdgeLength: 95,
        gravity: 0.3,
      } as unknown as cytoscape.LayoutOptions)
      layout.run()
    }, [])

    // ── expand (the explicit lazy-load action) ──
    const doExpand = React.useCallback(
      (id: string) => {
        const c = cy
        if (!c) return
        const node = c.$id(id)
        if (node.empty()) return
        expandCtrlRef.current?.abort()
        const ctrl = new AbortController()
        expandCtrlRef.current = ctrl
        setExpandingId(id)
        const { depth, limit, nodeTypes, edgeTypes } = paramsRef.current
        const nFacets = meta.node_types.length
        const eFacets = meta.edge_types.length
        kgSubgraph(
          {
            seed: id,
            depth,
            limit,
            node_types: nodeTypes.length && nodeTypes.length < nFacets ? nodeTypes : undefined,
            edge_types: edgeTypes.length && edgeTypes.length < eFacets ? edgeTypes : undefined,
          },
          ctrl.signal,
        )
          .then((sub) => {
            if (ctrl.signal.aborted || c.destroyed()) return
            const existing = new Set<string>(c.nodes().map((n) => n.id()))
            const newNodes = sub.nodes.filter((n) => !existing.has(n.id))
            const allIds = new Set<string>(existing)
            sub.nodes.forEach((n) => allIds.add(n.id))
            const existingEdges = new Set<string>(c.edges().map((e) => e.id()))
            const newEdges = sub.edges.filter(
              (e) =>
                !existingEdges.has(`e${e.id}`) && allIds.has(e.source) && allIds.has(e.target),
            )
            const added = newNodes.length + newEdges.length
            if (added > 0) {
              c.add([...newNodes.map(nodeEl), ...newEdges.map(edgeEl)])
              runLayout(c, true)
            }
            if (sub.truncated) c.$id(id).addClass('has-more')
            reportCounts(c)
            onExpandRef.current?.({ id, added, truncated: sub.truncated, total: sub.total_neighbors })
          })
          .catch((err) => {
            if (ctrl.signal.aborted) return
            onErrRef.current?.(err?.detail || err?.message || 'Expand failed')
          })
          .finally(() => {
            if (expandCtrlRef.current === ctrl) setExpandingId(null)
          })
      },
      [cy, meta, runLayout, reportCounts],
    )
    const doExpandRef = React.useRef(doExpand)
    React.useEffect(() => {
      doExpandRef.current = doExpand
    })

    // ── create the Cytoscape instance once (client + DOM only) ──
    React.useEffect(() => {
      let cancelled = false
      let instance: Core | null = null
      ;(async () => {
        const cytoscapeMod = (await import('cytoscape')).default
        const fcose = (await import('cytoscape-fcose')).default
        if (!fcoseRegistered) {
          cytoscapeMod.use(fcose)
          fcoseRegistered = true
        }
        if (cancelled || !containerRef.current) return
        instance = cytoscapeMod({
          container: containerRef.current,
          elements: [],
          style: [],
          wheelSensitivity: 0.2,
          minZoom: 0.15,
          maxZoom: 3,
          pixelRatio: 1,
        })

        // tap → select; double-tap (same node, <320ms) → expand.
        instance.on('tap', 'node', (evt: EventObject) => {
          const id = evt.target.id()
          const now = Date.now()
          const last = lastTapRef.current
          if (last.id === id && now - last.t < 320) {
            doExpandRef.current(id)
          }
          lastTapRef.current = { id, t: now }
          onSelectRef.current(id)
        })
        // hover focus: dim everything but the node's closed neighbourhood.
        instance.on('mouseover', 'node', (evt: EventObject) => {
          const nb = evt.target.closedNeighborhood()
          instance!.elements().not(nb).addClass('dim')
        })
        instance.on('mouseout', 'node', () => {
          instance!.elements().removeClass('dim')
        })

        if (!cancelled) setCy(instance)
      })()
      return () => {
        cancelled = true
        expandCtrlRef.current?.abort()
        instance?.destroy()
      }
    }, [])

    // ── (re)apply the stylesheet on theme change / meta load ──
    React.useEffect(() => {
      if (!cy) return
      const colors = resolveThemeColors()
      const roles = buildNodeColorRoles(meta)
      cy.style(buildStylesheet(colors, roles))
    }, [cy, resolvedTheme, meta])

    // ── rebuild from the base graph (resets expansions) ──
    React.useEffect(() => {
      if (!cy) return
      cy.elements().remove()
      if (base && base.nodes.length) {
        cy.add(toElements(base))
        cy.resize() // container height is now settled
        runLayout(cy, false)
      }
      reportCounts(cy)
    }, [cy, base, runLayout, reportCounts])

    // ── reflect the externally-selected node into the canvas ──
    React.useEffect(() => {
      if (!cy) return
      cy.nodes(':selected').unselect()
      if (selectedId) {
        const node = cy.$id(selectedId)
        if (node.nonempty()) node.select()
      }
    }, [cy, selectedId, base])

    // ── keep canvas sized to its (flex/grid) container ──
    React.useEffect(() => {
      if (!cy || !containerRef.current) return
      let raf = 0
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => !cy.destroyed() && cy.resize())
      })
      ro.observe(containerRef.current)
      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
      }
    }, [cy])

    // ── imperative API ──
    React.useImperativeHandle(
      ref,
      () => ({
        expand: (id: string) => doExpandRef.current(id),
        focus: (id: string) => {
          const c = cy
          if (!c) return
          const node = c.$id(id)
          c.nodes(':selected').unselect()
          if (node.nonempty()) {
            node.select()
            c.animate(
              { center: { eles: node }, zoom: Math.max(c.zoom(), 1) },
              { duration: reduceRef.current ? 0 : 400 },
            )
          }
        },
        fit: () => cy?.fit(undefined, 40),
      }),
      [cy],
    )

    const isEmpty = !baseLoading && (!base || base.nodes.length === 0)

    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        <div
          ref={containerRef}
          className="h-full w-full"
          aria-label="Knowledge-graph canvas"
          role="application"
        />

        {/* zoom / fit controls — floating glass pill, bottom-right */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-full border border-foreground/10 bg-background/70 p-1 shadow-card backdrop-blur-md">
          <CanvasBtn
            label="Zoom in"
            onClick={() => cy && cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: renderedCenter(cy) })}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </CanvasBtn>
          <CanvasBtn
            label="Zoom out"
            onClick={() => cy && cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: renderedCenter(cy) })}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </CanvasBtn>
          <CanvasBtn label="Fit to view" onClick={() => cy?.fit(undefined, 40)}>
            <Maximize2 className="h-3.5 w-3.5" />
          </CanvasBtn>
        </div>

        {/* loading / expanding overlay */}
        {(baseLoading || expandingId) && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/85 px-3 py-1 text-xs text-muted-foreground shadow-card backdrop-blur-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" />
              {baseLoading ? 'Loading graph…' : 'Expanding neighbours…'}
            </span>
          </div>
        )}

        {/* empty state */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-xs text-center">
              <p className="text-sm font-medium text-foreground">No nodes to show</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a law, search for an entity, or relax the filters to seed the graph.
              </p>
            </div>
          </div>
        )}
      </div>
    )
  },
)

function renderedCenter(c: Core): { x: number; y: number } {
  return { x: c.width() / 2, y: c.height() / 2 }
}

function CanvasBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors duration-150 ease-spring hover:bg-foreground/[0.08] hover:text-foreground active:scale-95"
    >
      {children}
    </button>
  )
}
