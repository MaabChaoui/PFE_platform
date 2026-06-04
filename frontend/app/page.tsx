'use client'

import * as React from 'react'
import { ArrowUp, Globe2, Mic, Plus, Sparkles } from 'lucide-react'

import { AuroraBackdrop } from '@/components/shared/aurora-backdrop'
import { CitationChip } from '@/components/shared/citation-chip'
import { ArabicText } from '@/components/shared/arabic-text'

/*
 * Home = the "Ask Algerian law." hero (S6.5 visual shell only). The live/replay
 * pipeline, trajectory viz and real answer/sources rendering land in S10 — for
 * now the command bar + the answer/sources card below are a static design mock.
 */

const SUGGESTED = [
  'Quels sont les motifs de divorce dans le Code de la famille ?',
  'ما هي شروط عقد الزواج في القانون الجزائري؟',
  'What conditions render a contract void under Algerian civil law?',
  'Délais de prescription en matière commerciale ?',
]

type MockCitation = {
  index: number
  docId: string
  articleRef: string
  docTitle: string
}

const CITATIONS: MockCitation[] = [
  { index: 1, docId: '84-11_1984-06-09', articleRef: '53', docTitle: 'Code de la famille (Loi 84-11)' },
  { index: 2, docId: '84-11_1984-06-09', articleRef: '54', docTitle: 'Code de la famille (Loi 84-11)' },
  { index: 3, docId: '84-11_1984-06-09', articleRef: '55', docTitle: 'Code de la famille (Loi 84-11)' },
  { index: 4, docId: '84-11_1984-06-09', articleRef: '56', docTitle: 'Code de la famille (Loi 84-11)' },
]

const ANSWER = {
  question:
    'Quels sont les motifs de divorce reconnus dans le Code de la famille algérien ?',
  body:
    "Le Code de la famille algérien (Loi n° 84-11) énumère plusieurs motifs permettant à l'épouse de demander la dissolution du mariage par voie judiciaire. Les articles 53 et 54 prévoient notamment le défaut d'entretien [1], les vices rédhibitoires [2], l'absence prolongée sans motif valable [3], ainsi que tout préjudice reconnu comme empêchant la poursuite de la vie conjugale [4].",
  arabic:
    'للزوجة أن تطلب التطليق للأسباب الآتية: عدم الإنفاق بعد صدور الحكم بوجوبه ما لم تكن عالمة بإعساره وقت الزواج، والعيوب المانعة من تحقيق الهدف من الزواج، والهجر في المضجع فوق أربعة أشهر، وكل ضرر معتبر شرعا. (المادة 53 من قانون الأسرة).',
}

const SOURCES = [
  {
    id: '84-11/art-53',
    title: 'Code de la famille — art. 53',
    excerpt:
      "L'épouse peut demander le divorce pour défaut de paiement de la pension alimentaire prononcée judiciairement…",
    score: 0.91,
  },
  {
    id: '84-11/art-54',
    title: 'Code de la famille — art. 54',
    excerpt:
      'Le divorce peut être demandé pour vice rédhibitoire empêchant la réalisation du but du mariage…',
    score: 0.88,
  },
  {
    id: '75-58/art-124',
    title: 'Code civil — art. 124',
    excerpt:
      "Tout fait quelconque de l'homme qui cause à autrui un dommage oblige celui par la faute duquel il est arrivé à le réparer.",
    score: 0.74,
  },
]

function renderAnswerBody(body: string) {
  return body.split(/(\[\d\])/).map((part, i) => {
    const m = /\[(\d)\]/.exec(part)
    if (!m) return <span key={i}>{part}</span>
    const c = CITATIONS[Number(m[1]) - 1]
    return c ? (
      <span key={i} className="mx-0.5">
        <CitationChip
          index={c.index}
          docId={c.docId}
          articleRef={c.articleRef}
          docTitle={c.docTitle}
        />
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  })
}

export default function HomePage() {
  const [query, setQuery] = React.useState(
    'Quels sont les motifs de divorce reconnus dans le Code de la famille algérien ?',
  )

  // TODO(S10): replace with the live/replay pipeline (lib/api answer / streamAnswer).
  const onSend = () => console.log('[S10 TODO] ask pipeline:', query)

  return (
    <div className="relative">
      <AuroraBackdrop soft />

      {/* Hero + command bar */}
      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-10 pt-20 text-center md:pt-24">
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
          Ask <span className="text-gradient-brand">Algerian law.</span>
        </h1>
        <p className="mt-4 max-w-xl text-balance text-sm text-muted-foreground">
          Pose a question in French, Arabic, or English. Every answer is grounded
          in the official Akoma Ntoso corpus — with article-level citations and an
          explicit abstention when the law is silent.
        </p>

        <div className="mt-9 w-full">
          <div className="group relative rounded-2xl border border-foreground/10 bg-card/70 p-3 text-left shadow-2xl backdrop-blur-xl">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={2}
              className="w-full resize-none bg-transparent px-3 pt-2 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              placeholder="Pose a question in French, Arabic, or English…"
            />
            <div className="mt-2 flex items-center gap-1.5 px-1">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Attach"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <Globe2 className="h-3.5 w-3.5" /> FR · AR · EN
              </button>
              <span className="mx-2 h-4 w-px bg-foreground/10" />
              <button
                type="button"
                className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Top-k 24
              </button>
              <button
                type="button"
                className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Rerank 8
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onSend}
                  aria-label="Ask"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Static answer + sources mock (the look S10 will render live) */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-foreground/10 bg-card/60 p-6 backdrop-blur-sm md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Synthesis · grounded
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="nums">9.7 s</span>
                <span>·</span>
                <span className="nums">1,142 tok</span>
                <span>·</span>
                <span className="nums text-success">HCR 0.000</span>
              </div>
            </div>

            <h2 className="mt-3 font-display text-2xl leading-snug tracking-tight">
              {ANSWER.question}
            </h2>

            <p className="mt-5 text-[15px] leading-relaxed text-foreground/90">
              {renderAnswerBody(ANSWER.body)}
            </p>

            <div className="mt-6 rounded-xl border border-foreground/10 bg-background/40 p-5">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="nums">art. 53 · 84-11</span>
                <span className="font-mono">aligned excerpt</span>
              </div>
              <ArabicText className="text-[17px] leading-[1.9] text-foreground/95">
                {ANSWER.arabic}
              </ArabicText>
            </div>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {CITATIONS.map((c) => (
                <CitationChip
                  key={c.index}
                  index={c.index}
                  docId={c.docId}
                  articleRef={c.articleRef}
                  docTitle={c.docTitle}
                />
              ))}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Top sources
            </div>
            {SOURCES.map((s) => (
              <div
                key={s.id}
                className="group rounded-xl border border-foreground/10 bg-card/60 p-4 transition-colors hover:border-foreground/25"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">{s.id}</span>
                  <span className="nums font-mono text-primary/90">
                    {s.score.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1.5 font-display text-[15px] tracking-tight">
                  {s.title}
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {s.excerpt}
                </p>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </div>
  )
}
