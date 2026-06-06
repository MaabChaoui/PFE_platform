import { QuestionDetailView } from '@/components/benchmark/question-detail'
import { PageContainer } from '@/components/shared/page-shell'

/** Drill-in detail for a single benchmark question. `params.id` arrives already
 *  URL-decoded from Next's dynamic segment. The client view fetches /benchmark/
 *  questions/{id} and renders gold articles, the precomputed prediction and the
 *  gold-vs-pred diff. */
export default function BenchmarkQuestionPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <PageContainer>
      <QuestionDetailView id={params.id} />
    </PageContainer>
  )
}
