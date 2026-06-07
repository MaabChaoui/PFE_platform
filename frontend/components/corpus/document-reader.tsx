'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  FileCode2,
  Info,
  ListTree,
  ScrollText,
  Search,
} from 'lucide-react'

import { ArabicText } from '@/components/shared/arabic-text'
import { ErrorState } from '@/components/shared/states'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getArticle, getDocument, getDocumentXml } from '@/lib/api'
import { fmtInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  CorpusSearchBox,
  SearchResultsRegion,
  useCorpusSearch,
} from './corpus-search'
import { DocTypeBadge, FormatChips } from './format-chips'
import { MetadataPanel } from './metadata-panel'
import { StructureTree } from './structure-tree'
import { TextPane } from './text-pane'
import { XmlPane } from './xml-pane'
import { buildArticleIndex, resolveRefToEid, yearOf } from './utils'

type View = 'split' | 'text' | 'xml'

/**
 * The document reader: structure tree (left) ⟷ readable RTL Arabic ⟷ raw AKN XML.
 * Owns the single `selectedEid` that keeps every surface in sync (tree, both
 * panes, the URL). The deep-link contract (`?doc=&article=`) is honoured here:
 * the bare `?article` ref is resolved to a unique eid (locally, falling back to
 * the API for normalised refs), which then scrolls + highlights both panes.
 */
export function DocumentReader({
  docId,
  articleParam,
  onBack,
  onSelectArticle,
  reduceMotion,
}: {
  docId: string
  articleParam: string | null
  onBack: () => void
  /** Reflect a selection in the URL (?article=<eid>) — eids are unique + resolvable. */
  onSelectArticle: (eid: string) => void
  reduceMotion: boolean
}) {
  const [view, setView] = React.useState<View>('split')
  const [showTree, setShowTree] = React.useState(true)
  const [showDetails, setShowDetails] = React.useState(false)
  const [treeSheet, setTreeSheet] = React.useState(false)
  const [searchSheet, setSearchSheet] = React.useState(false)
  const [selectedEid, setSelectedEid] = React.useState<string | null>(null)
  const [flashEid, setFlashEid] = React.useState<string | null>(null)

  const docQuery = useQuery({
    queryKey: ['corpus-document', docId],
    queryFn: ({ signal }) => getDocument(docId, signal),
  })
  const detail = docQuery.data

  const xmlVisible = view === 'xml' || view === 'split'
  const xmlQuery = useQuery({
    queryKey: ['corpus-xml', docId],
    queryFn: ({ signal }) => getDocumentXml(docId, signal),
    enabled: xmlVisible && !!detail,
  })

  const index = React.useMemo(
    () => (detail ? buildArticleIndex(detail) : null),
    [detail],
  )

  // Resolve the URL ?article ref → unique eid (local first).
  const urlEid = React.useMemo(
    () => (index ? resolveRefToEid(index, articleParam) : null),
    [index, articleParam],
  )
  // Fallback for normalised-Arabic refs the local index can't match.
  const needFallback = !!articleParam && !!index && !urlEid
  const fallbackQuery = useQuery({
    queryKey: ['corpus-article', docId, articleParam],
    queryFn: ({ signal }) => getArticle(docId, articleParam as string, signal),
    enabled: needFallback,
  })
  const targetEid = urlEid ?? fallbackQuery.data?.eid ?? null

  // Adopt the URL target (deep-link / back-forward). Depends only on targetEid so
  // local clicks (which set selectedEid + write the eid to the URL) never clobber.
  React.useEffect(() => {
    if (targetEid) setSelectedEid(targetEid)
  }, [targetEid])

  // Flash on every selection change (click or deep-link); XML pane flashes itself.
  React.useEffect(() => {
    if (!selectedEid) return
    setFlashEid(selectedEid)
    const t = setTimeout(() => setFlashEid(null), 1500)
    return () => clearTimeout(t)
  }, [selectedEid])

  const select = React.useCallback(
    (eid: string) => {
      setSelectedEid(eid)
      onSelectArticle(eid)
    },
    [onSelectArticle],
  )

  const [inDocQuery, setInDocQuery] = React.useState('')
  const inDocSearch = useCorpusSearch(inDocQuery, { docId })

  // ── loading / error ──
  if (docQuery.isError) {
    return (
      <div className="space-y-4">
        <BackButton onBack={onBack} />
        <ErrorState
          error={docQuery.error}
          onRetry={() => void docQuery.refetch()}
          title="Could not open this document"
        />
      </div>
    )
  }
  if (!detail || !index) {
    return <ReaderSkeleton onBack={onBack} />
  }

  return (
    <div className="space-y-3">
      {/* ── masthead ── */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-1.5 shadow-card">
        <div className="rounded-[calc(1rem-0.375rem)] bg-background/40 p-4 dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <BackButton onBack={onBack} />
            <div className="ml-auto flex items-center gap-1.5">
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2" dir="ltr">
                <DocTypeBadge type={detail.type} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {detail.doc_id.split('_')[0]}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {detail.date}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="nums font-mono text-[11px] text-muted-foreground">
                  {fmtInt(detail.article_count)} articles
                </span>
              </div>
              <ArabicText className="text-[19px] font-medium leading-relaxed text-foreground md:text-[22px]">
                {detail.title}
              </ArabicText>
            </div>
            <div className="flex flex-col items-end gap-2">
              <FormatChips formats={detail.formats_available} />
            </div>
          </div>

          {/* toolbar */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-foreground/[0.06] pt-3">
            <ToolButton
              active={showTree}
              onClick={() => setShowTree((s) => !s)}
              className="hidden lg:inline-flex"
            >
              <ListTree className="h-3.5 w-3.5" />
              Structure
            </ToolButton>
            <ToolButton onClick={() => setTreeSheet(true)} className="lg:hidden">
              <ListTree className="h-3.5 w-3.5" />
              Structure
            </ToolButton>
            <ToolButton onClick={() => setSearchSheet(true)}>
              <Search className="h-3.5 w-3.5" />
              Search in document
            </ToolButton>
            <ToolButton active={showDetails} onClick={() => setShowDetails((s) => !s)}>
              <Info className="h-3.5 w-3.5" />
              Details
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-300 ease-spring motion-reduce:transition-none',
                  showDetails && 'rotate-180',
                )}
              />
            </ToolButton>
          </div>

          {showDetails ? (
            <div className="mt-3 animate-fade-up rounded-xl border border-foreground/[0.08] bg-card/40 p-4">
              <MetadataPanel detail={detail} index={index} />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── workbench ── */}
      <div
        className={cn(
          'grid gap-3 lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem]',
          showTree ? 'lg:grid-cols-[256px_minmax(0,1fr)]' : 'lg:grid-cols-1',
        )}
      >
        {showTree ? (
          <aside className="hidden rounded-2xl border border-foreground/[0.08] bg-card/40 p-3 shadow-card lg:flex lg:h-full lg:flex-col">
            <StructureTree
              detail={detail}
              index={index}
              selectedEid={selectedEid}
              onSelect={select}
            />
          </aside>
        ) : null}

        <div className="min-w-0 lg:h-full">
          {view === 'split' ? (
            <div className="grid h-full gap-3 xl:grid-cols-2">
              <PaneCard icon={ScrollText} label="Reading">
                <TextPane
                  index={index}
                  selectedEid={selectedEid}
                  flashEid={flashEid}
                  onSelect={select}
                  reduceMotion={reduceMotion}
                  className="min-h-0 max-h-[72vh] flex-1 lg:max-h-none"
                />
              </PaneCard>
              <PaneCard icon={FileCode2} label="AKN XML">
                <XmlPane
                  xml={xmlQuery.data}
                  isLoading={xmlQuery.isLoading && xmlVisible}
                  isError={xmlQuery.isError}
                  error={xmlQuery.error}
                  onRetry={() => void xmlQuery.refetch()}
                  selectedEid={selectedEid}
                  reduceMotion={reduceMotion}
                  className="min-h-0 max-h-[72vh] flex-1 lg:max-h-none"
                />
              </PaneCard>
            </div>
          ) : view === 'text' ? (
            <PaneCard icon={ScrollText} label="Reading">
              <TextPane
                index={index}
                selectedEid={selectedEid}
                flashEid={flashEid}
                onSelect={select}
                reduceMotion={reduceMotion}
                className="min-h-0 max-h-[78vh] flex-1 lg:max-h-none"
              />
            </PaneCard>
          ) : (
            <PaneCard icon={FileCode2} label="AKN XML">
              <XmlPane
                xml={xmlQuery.data}
                isLoading={xmlQuery.isLoading && xmlVisible}
                isError={xmlQuery.isError}
                error={xmlQuery.error}
                onRetry={() => void xmlQuery.refetch()}
                selectedEid={selectedEid}
                reduceMotion={reduceMotion}
                className="min-h-0 max-h-[78vh] flex-1 lg:max-h-none"
              />
            </PaneCard>
          )}
        </div>
      </div>

      {/* ── mobile structure sheet ── */}
      <Sheet open={treeSheet} onOpenChange={setTreeSheet}>
        <SheetContent side="left" className="w-[min(20rem,85vw)] p-4">
          <SheetHeader className="mb-3">
            <SheetTitle>Document structure</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100dvh-6rem)]">
            <StructureTree
              detail={detail}
              index={index}
              selectedEid={selectedEid}
              onSelect={(eid) => {
                select(eid)
                setTreeSheet(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── in-document search sheet ── */}
      <Sheet open={searchSheet} onOpenChange={setSearchSheet}>
        <SheetContent side="right" className="flex w-[min(26rem,90vw)] flex-col p-4">
          <SheetHeader className="mb-3">
            <SheetTitle>Search in this document</SheetTitle>
          </SheetHeader>
          <CorpusSearchBox
            value={inDocQuery}
            onChange={setInDocQuery}
            onClear={() => setInDocQuery('')}
            busy={inDocSearch.enabled && inDocSearch.isFetching}
            autoFocus
            placeholder="Search the Arabic text of this law…"
          />
          <div className="scrollbar-thin mt-3 flex-1 overflow-y-auto">
            <SearchResultsRegion
              query={inDocQuery}
              enabled={inDocSearch.enabled}
              isFetching={inDocSearch.isFetching}
              isError={inDocSearch.isError}
              error={inDocSearch.error}
              hits={inDocSearch.data}
              showDocTitle={false}
              onSelect={(hit) => {
                const eid = resolveRefToEid(index, hit.article_ref)
                if (eid) select(eid)
                setSearchSheet(false)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ───────────────────────── small parts ─────────────────────────

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/12 px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors duration-300 ease-spring hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All documents
    </button>
  )
}

function ToolButton({
  active,
  onClick,
  className,
  children,
}: {
  active?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-300 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-reduce:transition-none',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-foreground/12 text-foreground/75 hover:border-foreground/25 hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

const VIEW_OPTIONS: { key: View; label: string; icon: typeof Columns2 }[] = [
  { key: 'split', label: 'Split', icon: Columns2 },
  { key: 'text', label: 'Text', icon: ScrollText },
  { key: 'xml', label: 'XML', icon: FileCode2 },
]

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-foreground/10 bg-foreground/[0.03] p-0.5">
      {VIEW_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = view === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-300 ease-spring motion-reduce:transition-none',
              opt.key === 'split' && 'hidden xl:inline-flex',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function PaneCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof ScrollText
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/40 shadow-card lg:h-full">
      <header className="flex items-center gap-1.5 border-b border-foreground/[0.06] bg-background/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
        {label}
      </header>
      {children}
    </section>
  )
}

function ReaderSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-foreground/[0.08] bg-card/40 p-4 shadow-card">
        <BackButton onBack={onBack} />
        <Skeleton className="mt-3 h-4 w-24" />
        <Skeleton className="mt-3 h-6 w-3/4" />
      </div>
      <div className="grid gap-3 lg:h-[calc(100dvh-13rem)] lg:min-h-[34rem] lg:grid-cols-[256px_minmax(0,1fr)]">
        <Skeleton className="hidden h-full w-full rounded-2xl lg:block" />
        <div className="grid gap-3 xl:grid-cols-2">
          <Skeleton className="h-[60vh] w-full rounded-2xl lg:h-full" />
          <Skeleton className="hidden h-[60vh] w-full rounded-2xl lg:h-full xl:block" />
        </div>
      </div>
    </div>
  )
}
