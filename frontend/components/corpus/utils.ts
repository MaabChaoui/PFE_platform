/**
 * Pure helpers for the corpus explorer (S12). No React, no DOM — these are the
 * load-bearing bits (tree mapping, deep-link ref→eid resolution), kept side-effect
 * free so they can be reasoned about and unit-checked without a browser.
 *
 * Data facts that drive this file (verified against the live S1 backend):
 *  - `article_ref` is the BARE number ("1") and is NOT unique within a document
 *    (e.g. the Civil Code has two "art 1": eid `art_1` and eid `art_الاولى`).
 *    The unique anchor is `eid`. Citations / deep-links carry the bare ref, so we
 *    must resolve ref → first matching eid (matching the backend's setdefault).
 *  - The structure tree is reproduced from each article's `ancestors` exactly the
 *    way the backend builds `node.id` (CorpusService._hierarchy), so flat docs
 *    (constitution: zero structural children) and stray ancestor keys both behave.
 *  - `num` === `article_ref` (both the bare number) — never render both.
 *  - `status` is hardcoded `null` everywhere in this build — degrade honestly.
 */
import type { Article, DocumentDetail, HierarchyNode } from '@/lib/types'

// Mirror CorpusService.HIERARCHY_LEVELS (order matters — it defines nesting).
export const HIERARCHY_LEVELS = [
  'book',
  'part',
  'title',
  'chapter',
  'section',
  'subsection',
] as const

/**
 * Reproduce the backend's `node.id` for the structural node an article sits in.
 * Backend builds it as `f"{parent}/{level}:{value}"` walking HIERARCHY_LEVELS and
 * skipping empty levels — so this is a faithful 1:1 port. Root id === doc_id, which
 * means flat documents map every article to the root (their articles render there).
 */
export function nodeIdForArticle(
  docId: string,
  ancestors: Record<string, string>,
): string {
  return HIERARCHY_LEVELS.reduce(
    (id, level) => (ancestors[level] ? `${id}/${level}:${ancestors[level]}` : id),
    docId,
  )
}

export interface ArticleIndex {
  /** Articles in document (reading) order — as the backend returns them. */
  ordered: Article[]
  /** eid (verbatim) → article. */
  byEid: Map<string, Article>
  /** lowercased eid → eid (case-insensitive resolution). */
  eidLower: Map<string, string>
  /** structural node.id → eids in document order (the tree's article leaves). */
  eidsByNode: Map<string, string[]>
  /** bare article_ref → FIRST eid in document order (deep-link / citation target). */
  firstEidByRef: Map<string, string>
}

/** Build all the lookups the reader needs in a single O(n) pass over articles. */
export function buildArticleIndex(detail: DocumentDetail): ArticleIndex {
  const ordered = detail.articles
  const byEid = new Map<string, Article>()
  const eidLower = new Map<string, string>()
  const eidsByNode = new Map<string, string[]>()
  const firstEidByRef = new Map<string, string>()

  for (const a of ordered) {
    byEid.set(a.eid, a)
    eidLower.set(a.eid.toLowerCase(), a.eid)

    const node = nodeIdForArticle(detail.doc_id, a.ancestors)
    const bucket = eidsByNode.get(node)
    if (bucket) bucket.push(a.eid)
    else eidsByNode.set(node, [a.eid])

    const refKey = a.article_ref.trim().toLowerCase()
    if (refKey && !firstEidByRef.has(refKey)) firstEidByRef.set(refKey, a.eid)
  }

  return { ordered, byEid, eidLower, eidsByNode, firstEidByRef }
}

/**
 * Resolve a citation / deep-link / search-hit ref to a unique eid within a doc.
 * Order matches what the backend would land on: exact eid → `art_<ref>` → first
 * article whose bare `article_ref` matches. Returns null for unknown refs (the
 * caller can fall back to the API's robust getArticle, which also normalises
 * Arabic forms). Accepts both bare refs ("1") and eids ("art_1").
 */
export function resolveRefToEid(
  index: ArticleIndex,
  ref: string | null | undefined,
): string | null {
  if (!ref) return null
  const raw = ref.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  // 1) exact eid (case-insensitive)
  const exact = index.eidLower.get(lower)
  if (exact) return exact

  // 2) numeric/plain ref → the canonical `art_<ref>` eid, if present
  const arted = index.eidLower.get(`art_${lower}`)
  if (arted) return arted

  // 3) first article whose bare ref matches (document order)
  const byRef = index.firstEidByRef.get(lower)
  if (byRef) return byRef

  return null
}

/** Max nesting depth of the structural tree (excludes the synthetic root). */
export function structureDepth(root: HierarchyNode): number {
  let max = 0
  const walk = (node: HierarchyNode, depth: number) => {
    if (depth > max) max = depth
    for (const child of node.children) walk(child, depth + 1)
  }
  for (const child of root.children) walk(child, 1)
  return max
}

/** Count of distinct structural nodes per level across the tree. */
export function levelCounts(root: HierarchyNode): Record<string, number> {
  const counts: Record<string, number> = {}
  const walk = (node: HierarchyNode) => {
    for (const child of node.children) {
      counts[child.level] = (counts[child.level] ?? 0) + 1
      walk(child)
    }
  }
  walk(root)
  return counts
}

/**
 * Rough rendered height (px) for an article block, used as `contain-intrinsic-size`
 * so content-visibility:auto keeps offscreen Arabic blocks cheap while giving the
 * scroll-anchoring a sane estimate (reduces deep-link scroll drift). Heuristic:
 * header + ~line-height(34px) per ~55 chars of Arabic at the reading measure.
 */
export function estimateArticleHeight(a: Article): number {
  const chars = (a.paragraphs.join('') || a.text_ar || '').length
  const lines = Math.max(1, Math.ceil(chars / 55))
  return 88 + lines * 34
}

// ───────────────────────── presentation config ─────────────────────────

export type FormatKey = 'akn' | 'txt' | 'rdf' | 'pdf'

/** Order + labels for the format chips (akn/txt/rdf/pdf). */
export const FORMAT_KEYS: FormatKey[] = ['akn', 'txt', 'rdf', 'pdf']
export const FORMAT_LABEL: Record<FormatKey, string> = {
  akn: 'AKN',
  txt: 'TXT',
  rdf: 'RDF',
  pdf: 'PDF',
}

/** Doc-type accent + label. Unknown types degrade to a humanised muted chip. */
export function docTypeMeta(type: string): { label: string; tone: string } {
  const key = type.toLowerCase()
  const map: Record<string, { label: string; tone: string }> = {
    constitution: { label: 'Constitution', tone: 'text-gold border-gold/30 bg-gold/[0.07]' },
    order: { label: 'Order', tone: 'text-primary border-primary/30 bg-primary/[0.07]' },
    law: { label: 'Law', tone: 'text-info border-info/30 bg-info/[0.07]' },
    decree: { label: 'Decree', tone: 'text-success border-success/30 bg-success/[0.07]' },
    ordinance: { label: 'Ordinance', tone: 'text-primary border-primary/30 bg-primary/[0.07]' },
  }
  return (
    map[key] ?? {
      label: humanizeType(type),
      tone: 'text-muted-foreground border-foreground/15 bg-foreground/[0.04]',
    }
  )
}

function humanizeType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Map an article `status` to a tone-coded badge spec, or null when there's no
 * status to show. NOTE: the S1 backend hardcodes `status=null` for every article,
 * so this never fires today — it's render-capability that lights up automatically
 * if the backend ever populates status. Unknown values degrade to a neutral chip.
 */
export function statusMeta(
  status: string | null | undefined,
): { label: string; tone: string } | null {
  if (!status) return null
  const key = status.toLowerCase()
  const map: Record<string, { label: string; tone: string }> = {
    in_force: { label: 'In force', tone: 'text-success border-success/30 bg-success/[0.08]' },
    active: { label: 'In force', tone: 'text-success border-success/30 bg-success/[0.08]' },
    repealed: { label: 'Repealed', tone: 'text-destructive border-destructive/30 bg-destructive/[0.08]' },
    amended: { label: 'Amended', tone: 'text-warning border-warning/40 bg-warning/[0.08]' },
    modified: { label: 'Amended', tone: 'text-warning border-warning/40 bg-warning/[0.08]' },
  }
  return map[key] ?? { label: humanizeType(status), tone: 'text-muted-foreground border-foreground/15 bg-foreground/[0.04]' }
}

/** Node ids from shallow→deep for the structural path an article sits under. */
export function nodePathForArticle(
  docId: string,
  ancestors: Record<string, string>,
): string[] {
  const path: string[] = []
  let id = docId
  for (const level of HIERARCHY_LEVELS) {
    if (ancestors[level]) {
      id = `${id}/${level}:${ancestors[level]}`
      path.push(id)
    }
  }
  return path
}

/** A short, human label for a structural level (book/chapter/section/…). */
export function levelLabel(level: string): string {
  const map: Record<string, string> = {
    document: 'Document',
    book: 'Book',
    part: 'Part',
    title: 'Title',
    chapter: 'Chapter',
    section: 'Section',
    subsection: 'Subsection',
  }
  return map[level] ?? humanizeType(level)
}

/** Year from an ISO-ish date string ("1975-09-26" → "1975"); falls back to input. */
export function yearOf(date: string): string {
  const m = /^(\d{4})/.exec(date)
  return m ? m[1] : date
}
