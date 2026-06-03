import { PageContainer, PageHeader, ComingSoon } from '@/components/shared/page-shell'

export default function BenchmarkPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Evaluation"
        title="Benchmark"
        description="Explore all 244 AlgerianLegalBench questions — filter by type, difficulty, category, answerability, language and split, each with an AKN-RLM hit badge. Open a question for its gold target articles (with full text), reasoning chain, and the precomputed prediction with a gold-vs-pred diff."
      />
      <ComingSoon session="S9" note="filter table + gold text + precomputed run + diff" />
    </PageContainer>
  )
}
