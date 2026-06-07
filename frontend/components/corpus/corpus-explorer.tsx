'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DocumentLibrary, DEFAULT_LIBRARY_STATE, type LibraryState } from './document-library'
import { DocumentReader } from './document-reader'
import { prefersReducedMotion } from './scroll'

/**
 * Corpus explorer shell. The deep-link contract lives in the URL: `?doc=` opens a
 * document and `?article=` selects an article inside it (this is exactly what the
 * shared CitationChip links to — `/corpus?doc=<doc_id>&article=<article_ref>`).
 * Library filters are kept in local state (preserved while a document is open, so
 * returning to the list restores the browse context) — they aren't part of the
 * shareable deep-link contract.
 */
export function CorpusExplorer() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const docId = sp.get('doc')
  const articleParam = sp.get('article')

  const [library, setLibrary] = React.useState<LibraryState>(DEFAULT_LIBRARY_STATE)
  const [reduceMotion, setReduceMotion] = React.useState(false)
  React.useEffect(() => setReduceMotion(prefersReducedMotion()), [])

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

  const patchLibrary = React.useCallback(
    (patch: Partial<LibraryState>) => setLibrary((s) => ({ ...s, ...patch })),
    [],
  )

  const openDoc = React.useCallback(
    (id: string, articleRef?: string) =>
      updateParams({ doc: id, article: articleRef ?? null }),
    [updateParams],
  )
  const back = React.useCallback(
    () => updateParams({ doc: null, article: null }),
    [updateParams],
  )
  const selectArticle = React.useCallback(
    (eid: string) => updateParams({ article: eid }),
    [updateParams],
  )

  if (docId) {
    return (
      <DocumentReader
        // Remount when switching documents so per-doc state (view, tree, refs) resets.
        key={docId}
        docId={docId}
        articleParam={articleParam}
        onBack={back}
        onSelectArticle={selectArticle}
        reduceMotion={reduceMotion}
      />
    )
  }

  return (
    <DocumentLibrary state={library} onState={patchLibrary} onOpenDoc={openDoc} />
  )
}
