import { PageContainer, PageHeader, ComingSoon } from '@/components/shared/page-shell'

export default function AboutPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="About"
        title="The thesis & the demo"
        description="AKN-RLM is an ENSIA engineering thesis by Ibrahim El Khalil Attia & Maab Chaoui (viva 13/06/2026). This page will cover the motivation, authorship, jury, the two novel resources (a 171-file corpus and the 244-question AlgerianLegalBench), the demo's purpose, and an AI-usage note."
      />
      <ComingSoon session="S14" note="abstract, authorship, ENSIA, jury, resources" />
    </PageContainer>
  )
}
