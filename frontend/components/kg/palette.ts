/**
 * Pure helpers for the KG explorer — colour resolution, type→palette mapping,
 * edge styling, label formatting, and the curated default filter selections.
 *
 * IMPORTANT (the silent-black-node trap): our design tokens are stored as
 * space-separated HSL *channels* (`--primary: 37 96% 49%`). Cytoscape's
 * hand-rolled colour parser does NOT accept CSS Color-4 space-separated
 * `hsl(37 96% 49%)`, and a parse failure is *silent* (nodes go black /
 * transparent). So we never hand Cytoscape a raw channel string — instead we
 * resolve every token through a throwaway probe element and read back the
 * browser-canonical `rgb(...)`. That also makes the result automatically
 * theme- AND presenter-aware (it reflects whatever `.dark` / `[data-presenter]`
 * currently resolves the var to).
 */
import type { KGMeta, KGNode } from '@/lib/types'

// ───────────────────────── colour tokens ─────────────────────────

const TOKENS = {
  primary: 'hsl(var(--primary))',
  gold: 'hsl(var(--gold))',
  info: 'hsl(var(--info))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  prussian: 'hsl(var(--secondary-foreground))',
  foreground: 'hsl(var(--foreground))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--background))',
  card: 'hsl(var(--card))',
  border: 'hsl(var(--border))',
} as const

export type ColorKey = keyof typeof TOKENS
export type ThemeColors = Record<ColorKey, string>

const FALLBACK: ThemeColors = {
  primary: 'rgb(250, 163, 17)',
  gold: 'rgb(255, 208, 8)',
  info: 'rgb(56, 145, 209)',
  success: 'rgb(58, 173, 122)',
  warning: 'rgb(240, 165, 40)',
  destructive: 'rgb(220, 70, 70)',
  prussian: 'rgb(120, 140, 175)',
  foreground: 'rgb(245, 245, 245)',
  mutedForeground: 'rgb(170, 175, 185)',
  background: 'rgb(2, 2, 12)',
  card: 'rgb(10, 16, 30)',
  border: 'rgb(30, 40, 60)',
}

/**
 * Resolve every token to a Cytoscape-safe `rgb(...)` / `rgba(...)` string off
 * the live DOM (so it tracks the current theme + presenter scaling). SSR-safe:
 * returns a static fallback when there's no `document`.
 */
export function resolveThemeColors(): ThemeColors {
  if (typeof document === 'undefined') return FALLBACK
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const out = {} as ThemeColors
  try {
    for (const key of Object.keys(TOKENS) as ColorKey[]) {
      probe.style.color = ''
      probe.style.color = TOKENS[key]
      const resolved = getComputedStyle(probe).color
      out[key] = resolved && resolved.startsWith('rgb') ? resolved : FALLBACK[key]
    }
  } finally {
    probe.remove()
  }
  return out
}

/** Add an alpha channel to a canonical `rgb(r, g, b)` string. */
export function withAlpha(rgb: string, alpha: number): string {
  const m = rgb.match(/rgba?\(([^)]+)\)/)
  if (!m) return rgb
  const [r, g, b] = m[1].split(',').map((p) => p.trim())
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ───────────────────────── node colour mapping ─────────────────────────

// Ordered brand roles. The most frequent node types (sorted by count) get the
// strongest, most legible colours; the long tail cycles through. Any bounded
// subgraph shows only a handful of types at once, so cycling reads cleanly.
const NODE_PALETTE_ORDER: ColorKey[] = [
  'primary',
  'info',
  'gold',
  'success',
  'prussian',
  'warning',
  'destructive',
  'mutedForeground',
]

export type NodeColorMap = Record<string, ColorKey>

/** Stable type→role assignment, derived from the live ontology (kgMeta). */
export function buildNodeColorRoles(meta: KGMeta): NodeColorMap {
  const sorted = [...meta.node_types].sort((a, b) => b.count - a.count)
  const map: NodeColorMap = {}
  sorted.forEach((t, i) => {
    map[t.type] = NODE_PALETTE_ORDER[i % NODE_PALETTE_ORDER.length]
  })
  return map
}

export function nodeColorKey(map: NodeColorMap, type: string | null): ColorKey {
  if (!type) return 'mutedForeground'
  return map[type] ?? 'mutedForeground'
}

/**
 * DOM (legend / filter chip) swatch classes per role. DOM reads the CSS vars
 * directly, so the swatches stay in lock-step with the canvas colours without
 * re-resolving anything. Literal strings so Tailwind's JIT emits them.
 */
export const COLOR_CLASS: Record<ColorKey, string> = {
  primary: 'bg-primary',
  gold: 'bg-gold',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  prussian: 'bg-secondary-foreground',
  foreground: 'bg-foreground',
  mutedForeground: 'bg-muted-foreground',
  background: 'bg-background',
  card: 'bg-card',
  border: 'bg-border',
}

// Document/structure-level types render a touch larger + as rounded rectangles
// so the "skeleton" of a law reads at a glance.
const STRUCTURAL_TYPE_LIST = [
  'Law',
  'Order',
  'Constitution',
  'OrganicLaw',
  'ExecutiveDecree',
  'PresidentialDecree',
  'Body',
  'Book',
  'Part',
  'Title',
  'Chapter',
  'Section',
  'Subsection',
  'Subsubsection',
  'Article',
  'Preamble',
  'Preface',
  'Expression',
  'Manifestation',
]
const STRUCTURAL_TYPES = new Set(STRUCTURAL_TYPE_LIST)

export function isStructuralType(type: string | null): boolean {
  return type != null && STRUCTURAL_TYPES.has(type)
}

export function nodeShape(type: string | null): string {
  return isStructuralType(type) ? 'round-rectangle' : 'ellipse'
}

/** Base diameter before the degree-driven bump applied in the stylesheet. */
export function baseNodeSize(type: string | null): number {
  if (type === 'Law' || type === 'Constitution' || type === 'Order') return 30
  if (isStructuralType(type)) return 22
  return 16
}

// ───────────────────────── edge styling ─────────────────────────

export interface EdgeStyle {
  role: ColorKey
  width: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
  opacity: number
  arrow: boolean
}

/**
 * Categorise a predicate by name pattern (adapts to unseen predicates rather
 * than enumerating the ontology). Amend/repeal edges are loud (dashed primary),
 * references dotted/info, containment quiet, the dominating `type` edge faint.
 */
export function edgeStyleFor(predicate: string): EdgeStyle {
  const p = predicate.toLowerCase()
  if (p === 'type')
    return { role: 'border', width: 0.8, lineStyle: 'dotted', opacity: 0.3, arrow: false }
  if (/amend|repeal/.test(p))
    return { role: 'primary', width: 2.6, lineStyle: 'dashed', opacity: 0.95, arrow: true }
  if (/refer|cite|term|defin/.test(p))
    return { role: 'info', width: 1.6, lineStyle: 'dotted', opacity: 0.85, arrow: true }
  if (/oblig|permiss|right|prohibit|condition|action|role|grant|impose/.test(p))
    return { role: 'success', width: 1.4, lineStyle: 'solid', opacity: 0.75, arrow: true }
  if (/contain|^has|source|target|version|express|manifest|paragraph|segment|body|preamble|preface/.test(p))
    return { role: 'mutedForeground', width: 1, lineStyle: 'solid', opacity: 0.4, arrow: false }
  return { role: 'mutedForeground', width: 1.2, lineStyle: 'solid', opacity: 0.55, arrow: true }
}

export const EDGE_LEGEND_CATEGORIES: {
  label: string
  example: string
  style: EdgeStyle
}[] = [
  { label: 'Amends / repeals', example: 'amends', style: edgeStyleFor('amends') },
  { label: 'References / cites', example: 'references', style: edgeStyleFor('references') },
  { label: 'Provisions', example: 'imposesObligation', style: edgeStyleFor('imposesObligation') },
  { label: 'Containment', example: 'directlyContains', style: edgeStyleFor('directlyContains') },
]

// ───────────────────────── default filter selections ─────────────────────────

// Curated preference for "Law overview" — keep the document skeleton, drop the
// fine-grained provision soup so a big law doesn't cap into a 250-node hairball.
// Intersected with what kgMeta actually exposes (falls back to "all" if empty),
// so it adapts to the real index rather than hardcoding the ontology.
const OVERVIEW_TYPE_PREF = [
  ...STRUCTURAL_TYPE_LIST,
  'Reference',
  'ExternalReference',
  'Citation',
]
const OVERVIEW_EDGE_PREF = [
  'hasBook',
  'hasChapter',
  'hasSection',
  'hasSubsection',
  'hasSubsubsection',
  'hasArticle',
  'directlyContains',
  'directlyContainedIn',
  'containedIn',
  'hasBody',
  'hasPreamble',
  'hasPreface',
  'amends',
  'repeals',
  'candidateAmends',
  'candidateRepeals',
  'repealedBy',
  'references',
  'referencesInternal',
  'referencesExternal',
  'hasReference',
  'hasCitation',
  'expressionOf',
  'hasExpression',
]

export function allNodeTypes(meta: KGMeta): string[] {
  return meta.node_types.map((t) => t.type)
}
export function allEdgeTypes(meta: KGMeta): string[] {
  return meta.edge_types.map((e) => e.predicate)
}

export function overviewDefaultNodeTypes(meta: KGMeta): string[] {
  const present = new Set(allNodeTypes(meta))
  const sel = OVERVIEW_TYPE_PREF.filter((t) => present.has(t))
  return sel.length ? Array.from(new Set(sel)) : allNodeTypes(meta)
}
export function overviewDefaultEdgeTypes(meta: KGMeta): string[] {
  const present = new Set(allEdgeTypes(meta))
  const sel = OVERVIEW_EDGE_PREF.filter((e) => present.has(e))
  return sel.length ? sel : allEdgeTypes(meta).filter((p) => p !== 'type')
}
/** Drill-down keeps everything except the dominating `type` predicate. */
export function drilldownDefaultEdgeTypes(meta: KGMeta): string[] {
  return allEdgeTypes(meta).filter((p) => p !== 'type')
}

// ───────────────────────── label / id formatting ─────────────────────────

/** Last meaningful segment of a node URI (after `#`, else after `/`). */
export function shortNodeId(id: string): string {
  if (!id) return id
  const frag = id.includes('#') ? id.split('#').pop()! : id.split('/').pop()!
  return frag || id
}

export function isArabic(s: string | null | undefined): boolean {
  return !!s && /[؀-ۿ]/.test(s)
}

export function nodeDisplayLabel(node: Pick<KGNode, 'id' | 'label'>): string {
  const l = node.label?.trim()
  return l && l.length ? l : shortNodeId(node.id)
}

export function truncateLabel(s: string, max = 30): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

/** camelCase / PascalCase ontology token → spaced Title-ish words. */
export function humanize(token: string | null | undefined): string {
  if (!token) return 'Unknown'
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
