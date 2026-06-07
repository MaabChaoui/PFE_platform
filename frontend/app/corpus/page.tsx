import * as React from 'react'

import { CorpusExplorer } from '@/components/corpus/corpus-explorer'
import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { RowsSkeleton } from '@/components/shared/states'

export default function CorpusPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dataset"
        title="Corpus explorer"
        description="Browse the 45 official Algerian legal documents as Akoma Ntoso — read each article in Arabic beside its raw AKN XML, navigate the eId structure, follow citations here, and search the corpus full-text. Fully offline."
      />
      {/* The explorer reads ?doc=&article= (the citation deep-link contract) via
          useSearchParams → wrap in Suspense so the route still prerenders. */}
      <React.Suspense fallback={<RowsSkeleton rows={10} />}>
        <CorpusExplorer />
      </React.Suspense>
    </PageContainer>
  )
}
