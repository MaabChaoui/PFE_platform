import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { PageContainer, PageHeader } from '@/components/shared/page-shell'
import { SystemStatus } from '@/components/shared/system-status'
import { ArabicText } from '@/components/shared/arabic-text'
import { CitationChip } from '@/components/shared/citation-chip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// Family Code (Law 84-11), article 4 — definition of marriage.
const ARABIC_SAMPLE =
  'الزواج عقد رضائي يتم بين رجل وامرأة على الوجه الشرعي، من أهدافه تكوين أسرة أساسها المودة والرحمة والتعاون، وإحصان الزوجين والمحافظة على الأنساب.'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function HomePage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="ENSIA thesis · viva demo"
        title="LexAlgeria"
        description="An interactive walkthrough of AKN-RLM — a citation-faithful question-answering system for Algerian law over Akoma Ntoso XML, a 765k-triple knowledge graph, and a 244-question benchmark."
        actions={
          <Button asChild>
            <Link href="/architecture">
              Explore the pipeline
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      <SystemStatus />

      <Separator className="my-10" />

      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Design system</h2>
        <p className="text-sm text-muted-foreground">
          The shared visual language every page inherits. Try the theme and
          presenter toggles in the nav.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Typography">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-3xl font-bold tracking-tight">
                Citation-faithful legal QA
              </p>
              <p className="text-muted-foreground">
                Inter drives the UI chrome with a restrained, scholarly rhythm.
                Numbers use tabular figures —{' '}
                <span className="nums font-medium text-foreground">
                  Cite F1 0.3045
                </span>
                .
              </p>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Arabic legal text · RTL · IBM Plex Sans Arabic</span>
                  <CitationChip
                    docId="84-11_1984-06-09"
                    articleRef="4"
                    docTitle="Family Code (Law 84-11)"
                  />
                </div>
                <ArabicText className="text-lg">{ARABIC_SAMPLE}</ArabicText>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Components">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primitives</CardTitle>
              <CardDescription>
                shadcn/ui on Tailwind v3, themed with the parchment / indigo /
                gold token set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button>Primary</Button>
                <Button variant="gold">Accent</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>default</Badge>
                <Badge variant="gold">gold</Badge>
                <Badge variant="success">success</Badge>
                <Badge variant="info">info</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="destructive">error</Badge>
                <Badge variant="muted">muted</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CitationChip
                  docId="75-58_1975-09-26"
                  articleRef="124"
                  docTitle="Civil Code (Ordinance 75-58)"
                  index={1}
                  kgNodeId="https://legal.dz/resource/law/1975-09-26/75-58#art_124"
                />
                <CitationChip
                  docId="66-156_1966-06-08"
                  articleRef="1"
                  docTitle="Penal Code (Ordinance 66-156)"
                  index={2}
                />
              </div>
            </CardContent>
          </Card>
        </Section>
      </div>
    </PageContainer>
  )
}
