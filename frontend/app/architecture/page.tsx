import { PageContainer, PageHeader, ComingSoon } from '@/components/shared/page-shell'

export default function ArchitecturePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline"
        title="Architecture"
        description="An interactive, clickable map of the AKN-RLM system — classifier → typed handler → hybrid retrieval → sub-LM verification → recursion → Toulmin ADU → summarise → faithfulness gates. Each node reveals what it does, its inputs/outputs, the real code path, and its metric."
      />
      <ComingSoon session="S7" note="data-driven component graph with real code paths" />
    </PageContainer>
  )
}
