import * as React from 'react'

import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { ArchitectureExplorer } from '@/components/architecture/architecture-explorer'

/**
 * Architecture (`/architecture`) — an interactive, data-driven map of the whole
 * AKN-RLM pipeline. Every component is clickable and opens a detail panel
 * (what · inputs · outputs · real code paths · metric · related pages). The
 * graph is driven entirely by `lib/architecture.ts`, so it renders fully offline;
 * a non-blocking `/api/results/metrics` fetch enriches the metric chips when the
 * backend is up. Deep-linkable via `?node=<id>`.
 */
export default function ArchitecturePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline · thesis §3.4"
        title="Architecture"
        description="An interactive, clickable map of the AKN-RLM system — query → classifier → document router → dispatcher → typed-handler pipeline (retrieval · verification · KG amendment chains · gap-driven recursion · Toulmin argument mining · synthesis) → triple faithfulness gate → AnswerResponse. Click any component for what it does, its inputs and outputs, the real code path, and its metric."
      />
      <React.Suspense fallback={null}>
        <ArchitectureExplorer />
      </React.Suspense>
    </PageContainer>
  )
}
