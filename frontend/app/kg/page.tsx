import * as React from 'react'

import { KgExplorer } from '@/components/kg/kg-explorer'
import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { RowsSkeleton } from '@/components/shared/states'

export default function KnowledgeGraphPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Knowledge graph"
        title="RDF graph explorer"
        description="Navigate the Algerian legal knowledge graph through bounded, lazily-expanded subgraphs — filter by law, node type, relationship and depth; inspect any node and jump to its article in the corpus; switch between law-overview and article-drill modes. Queries hit a prebuilt SQLite index, never the 74 MB graph."
      />
      {/* KgExplorer reads ?node= (the citation deep-link contract) via
          useSearchParams → wrap in Suspense so the route still prerenders. */}
      <React.Suspense fallback={<RowsSkeleton rows={8} />}>
        <KgExplorer />
      </React.Suspense>
    </PageContainer>
  )
}
