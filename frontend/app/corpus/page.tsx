import { PageContainer, PageHeader, ComingSoon } from '@/components/shared/page-shell'

export default function CorpusPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dataset"
        title="Corpus explorer"
        description="Browse the 45 Algerian laws as Akoma Ntoso: a document list with metadata and filters, side-by-side plain text ⟷ AKN XML, an eId structure tree with status badges, FRBR metadata, and in-document + cross-corpus search."
      />
      <ComingSoon session="S12" note="synced text/XML, eId tree, metadata, search" />
    </PageContainer>
  )
}
