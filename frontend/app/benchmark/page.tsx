import * as React from 'react'

import { BenchmarkExplorer } from '@/components/benchmark/benchmark-explorer'
import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { RowsSkeleton } from '@/components/shared/states'

export default function BenchmarkPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evaluation"
        title="Benchmark"
        description="All 244 AlgerianLegalBench v3.0 questions and how AKN-RLM did on each — fully offline from the locked run. Filter by type, difficulty, category, answerability, language and split; open a question for its gold target articles (with full text), reasoning chain, and the precomputed prediction with a gold-vs-pred diff."
      />
      {/* The explorer reads filters from the URL (useSearchParams) → wrap in
          Suspense so the route still prerenders cleanly. */}
      <React.Suspense fallback={<RowsSkeleton rows={10} />}>
        <BenchmarkExplorer />
      </React.Suspense>
    </PageContainer>
  )
}
