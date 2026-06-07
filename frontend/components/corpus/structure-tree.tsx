'use client'

import * as React from 'react'
import { ChevronRight, FoldVertical, Hash, UnfoldVertical } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { DocumentDetail, HierarchyNode } from '@/lib/types'
import {
  levelLabel,
  nodePathForArticle,
  statusMeta,
  type ArticleIndex,
} from './utils'

/** Recursive count of article leaves at and below a structural node. */
function countArticles(node: HierarchyNode, index: ArticleIndex): number {
  let total = index.eidsByNode.get(node.id)?.length ?? 0
  for (const child of node.children) total += countArticles(child, index)
  return total
}

/**
 * eId structure navigator built from the API `hierarchy` (book → chapter →
 * section → subsection → article). Article leaves are resolved to their unique
 * `eid` via the prebuilt index (so the non-unique bare ref never collides), and
 * the path to the selected article auto-expands. Clicking a leaf selects it,
 * which scrolls + highlights both reading panes.
 */
export function StructureTree({
  detail,
  index,
  selectedEid,
  onSelect,
}: {
  detail: DocumentDetail
  index: ArticleIndex
  selectedEid: string | null
  onSelect: (eid: string) => void
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())

  // Auto-expand the structural path down to the selected article.
  React.useEffect(() => {
    if (!selectedEid) return
    const article = index.byEid.get(selectedEid)
    if (!article) return
    const path = nodePathForArticle(detail.doc_id, article.ancestors)
    if (path.length === 0) return
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of path) next.add(id)
      return next
    })
  }, [selectedEid, detail.doc_id, index])

  const allNodeIds = React.useMemo(() => {
    const ids: string[] = []
    const walk = (n: HierarchyNode) => {
      if (n.children.length) ids.push(n.id)
      n.children.forEach(walk)
    }
    walk(detail.hierarchy)
    return ids
  }, [detail.hierarchy])

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const root = detail.hierarchy
  // Articles attached directly to the root (flat docs like the constitution).
  const rootEids = index.eidsByNode.get(root.id) ?? []
  const hasStructure = root.children.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Structure
        </span>
        {hasStructure ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setExpanded(new Set(allNodeIds))}
              title="Expand all"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <UnfoldVertical className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              title="Collapse all"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <FoldVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Document structure">
        {/* Root-level article leaves (flat documents) */}
        {rootEids.length > 0 ? (
          <ul className="space-y-0.5">
            {rootEids.map((eid) => (
              <ArticleLeaf
                key={eid}
                eid={eid}
                index={index}
                depth={0}
                selected={eid === selectedEid}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : null}

        {root.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            index={index}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            selectedEid={selectedEid}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </div>
  )
}

function TreeNode({
  node,
  index,
  depth,
  expanded,
  onToggle,
  selectedEid,
  onSelect,
}: {
  node: HierarchyNode
  index: ArticleIndex
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  selectedEid: string | null
  onSelect: (eid: string) => void
}) {
  const isOpen = expanded.has(node.id)
  const ownEids = index.eidsByNode.get(node.id) ?? []
  const total = countArticles(node, index)

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        aria-expanded={isOpen}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className="group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        dir="ltr"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-spring motion-reduce:transition-none',
            isOpen && 'rotate-90',
          )}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {levelLabel(node.level)}
        </span>
        {node.value ? (
          <span dir="rtl" className="arabic truncate text-[12.5px] leading-none text-foreground/85">
            {node.value}
          </span>
        ) : null}
        <span className="nums ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/60">
          {total}
        </span>
      </button>

      {isOpen ? (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              index={index}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedEid={selectedEid}
              onSelect={onSelect}
            />
          ))}
          {ownEids.length > 0 ? (
            <ul className="space-y-0.5">
              {ownEids.map((eid) => (
                <ArticleLeaf
                  key={eid}
                  eid={eid}
                  index={index}
                  depth={depth + 1}
                  selected={eid === selectedEid}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ArticleLeaf({
  eid,
  index,
  depth,
  selected,
  onSelect,
}: {
  eid: string
  index: ArticleIndex
  depth: number
  selected: boolean
  onSelect: (eid: string) => void
}) {
  const article = index.byEid.get(eid)
  if (!article) return null
  const status = statusMeta(article.status)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(eid)}
        aria-current={selected ? 'true' : undefined}
        style={{ paddingLeft: `${depth * 12 + 22}px` }}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected
            ? 'bg-primary/12 text-primary'
            : 'text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground',
        )}
        dir="ltr"
      >
        <Hash
          className={cn(
            'h-3 w-3 shrink-0',
            selected ? 'text-primary' : 'text-muted-foreground/50',
          )}
        />
        <span className="nums font-mono text-[12px]">{article.article_ref}</span>
        {status ? (
          <span
            className={cn('ml-auto rounded-full border px-1.5 py-px text-[9px] font-medium', status.tone)}
          >
            {status.label}
          </span>
        ) : null}
      </button>
    </li>
  )
}
