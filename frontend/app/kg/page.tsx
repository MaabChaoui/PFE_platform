import { PageContainer, PageHeader, ComingSoon } from '@/components/shared/page-shell'

export default function KnowledgeGraphPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Knowledge graph"
        title="RDF graph explorer"
        description="Navigate the 765k-triple Algerian legal knowledge graph through bounded, lazily-expanded subgraphs — filter by law, node type, relationship and depth; inspect any node; switch between law-overview and article-drill modes. Queries hit a prebuilt SQLite index, never the 74 MB graph."
      />
      <ComingSoon session="S13" note="Cytoscape fcose canvas, filters, node inspector" />
    </PageContainer>
  )
}
