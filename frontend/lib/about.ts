/**
 * About-page content — the single, editable source of truth for `/about`.
 *
 * ACCURACY CONTRACT (viva-facing): every name, role, date and count below is
 * REAL. Authors, institution, jury and supervision are transcribed verbatim from
 * the thesis front matter (`thesis/Thesis.txt`, lines 1–133); the headline
 * metrics are the locked Phase-E evaluation (thesis §4, mirrored by /results).
 * Resource counts ship as STATIC fallbacks and are overwritten at runtime by a
 * non-blocking `GET /api/meta`, so the page renders fully offline. Nothing here
 * is fabricated — edit this file to correct copy; `app/about/page.tsx` is purely
 * presentational. Author TODOs are marked with `TODO(author)`.
 */

import type { Meta } from './types'

// ───────────────────────── identity ─────────────────────────

export const SYSTEM_NAME = 'AKN-RLM'

export const THESIS_TITLE =
  'Advancing Legal Reasoning in Algerian Law: Integrating RAG, ' +
  'Knowledge Graphs, and Argument Mining for Citation-Faithful Legal Reasoning'

/** Distilled masthead line (truthful condensation of the title). */
export const HERO_LINE = 'Citation-faithful legal reasoning for Algerian law.'

export const ONE_LINER =
  'A citation-faithful question-answering system for Algerian law — grounded in ' +
  'an Akoma Ntoso legal corpus, a legal knowledge graph and Toulmin argument ' +
  'mining, behind a triple faithfulness gate.'

export const VIVA_DATE = '13/06/2026'

/** Algerian-law term — a single, unambiguous Arabic accent for the masthead.
 *  A richer Arabic tagline is left as TODO(author) — composed Arabic should be
 *  reviewed by the Algerian author before going on a jury-facing surface. */
export const ARABIC_TERM = 'القانون الجزائري'
export const ARABIC_TERM_GLOSS = 'Algerian law'

export const INSTITUTION = {
  name: 'École Nationale Supérieure d’Intelligence Artificielle',
  short: 'ENSIA',
  englishName: 'The National School of Artificial Intelligence',
  department: 'Department of Intelligent Systems Engineering',
  country: 'People’s Democratic Republic of Algeria',
  degree:
    'Dissertation submitted in partial fulfilment of the requirements for the ' +
    'degree of Engineer in Artificial Intelligence and Data Science.',
  reference: 'FYP/2025/135',
} as const

export const AUTHORS: { name: string }[] = [
  { name: 'Ibrahim El Khalil Attia' },
  { name: 'Maab Chaoui' },
]

// ───────────────────────── motivation / abstract ─────────────────────────

/** Distilled from the thesis abstract (lines 104–133) — not a verbatim dump. */
export const MOTIVATION: string[] = [
  'Large language models have advanced quickly in law, yet they remain ' +
    'unreliable for low-resource, non-English legal systems. A legal answer ' +
    'cannot be judged by fluency or plausibility alone: it must be grounded in ' +
    'identifiable sources, carried by valid article-level citations, bounded by ' +
    'the correct jurisdiction, sensitive to legal structure and temporality, and ' +
    'willing to abstain when the corpus does not justify an answer.',
  'Algerian law is a particularly demanding case — predominantly Arabic, ' +
    'historically layered, structurally complex, and markedly underrepresented ' +
    'in existing legal-AI resources. AKN-RLM is an architecture for ' +
    'citation-faithful legal reasoning that meets those constraints head-on, ' +
    'integrating Retrieval-Augmented Generation, Akoma Ntoso document ' +
    'structuring, a Legal Knowledge Graph, Toulmin-based Argument Mining, and ' +
    'bounded Recursive Language Model orchestration behind a triple ' +
    'faithfulness gate that enforces citation existence, jurisdictional ' +
    'discipline, and claim-level support.',
  'The central finding is infrastructural as much as algorithmic: the gains ' +
    'hold against a binding retrieval ceiling — the gold article reaches the ' +
    'top ten on only about a quarter of queries — which localizes the real ' +
    'barrier to reliable legal AI in the Algerian context to the data and ' +
    'tooling, not the model alone.',
]

/** 2–3 sentence "system in brief" — links out, never duplicates the other pages. */
export const SYSTEM_IN_BRIEF =
  'A typed classifier routes each question to a dedicated handler; a dispatcher ' +
  'retrieves over the Akoma Ntoso corpus and the legal knowledge graph, recurses ' +
  'on gaps, mines a Toulmin argument, and verifies every claim before answering. ' +
  'Re-ranking and fusion baselines live in the Retrieval Lab, not the deployed ' +
  'path — see the Architecture for the full pipeline and Results for the evidence.'

// ───────────────────────── headline metrics ─────────────────────────

export interface HeadlineMetric {
  label: string
  /** Pre-formatted, real value (locked Phase-E run / thesis §4). */
  value: string
  blurb: string
  accent: 'default' | 'success' | 'gold' | 'info'
}

export const HEADLINE_METRICS: HeadlineMetric[] = [
  {
    label: 'Citation F1',
    value: '0.3045',
    blurb: 'Article-level citation accuracy under classifier-routed deployment.',
    accent: 'default',
  },
  {
    label: 'Hallucinated-citation rate',
    value: '0.000',
    blurb: 'Never cites an article that does not exist in the corpus.',
    accent: 'success',
  },
  {
    label: 'Jurisdictional-infection rate',
    value: '0.000',
    blurb: 'Never imports foreign-law doctrine where Algerian law is silent.',
    accent: 'success',
  },
  {
    label: 'Abstention F1',
    value: '0.703',
    blurb: 'Declines to answer when the corpus does not justify one.',
    accent: 'gold',
  },
]

export const IMPROVEMENT_NOTE =
  'Citation-F1 gains of 1.64×, 2.9× and 1.74× over the strongest direct-LLM, ' +
  'deterministic-retrieval and minimal-RAG baselines — and the only compared ' +
  'system capable of principled abstention.'

// ───────────────────────── corpus / KG headline stats ─────────────────────────

/** Which `/api/meta` field drives a stat, with its offline fallback. The demo
 *  corpus = 45 documents / ~8,868 articles / 244 benchmark questions / ~765k KG
 *  triples — consistent with /corpus, /benchmark and /kg. */
export interface LiveStat {
  field: keyof Pick<
    Meta,
    'documents' | 'articles' | 'benchmark_questions' | 'kg_triples'
  >
  label: string
  fallback: number
  href: string
}

export const HEADLINE_STATS: LiveStat[] = [
  { field: 'documents', label: 'Structured documents', fallback: 45, href: '/corpus' },
  { field: 'articles', label: 'Legal articles', fallback: 8868, href: '/corpus' },
  { field: 'benchmark_questions', label: 'Benchmark questions', fallback: 244, href: '/benchmark' },
  { field: 'kg_triples', label: 'Knowledge-graph triples', fallback: 765000, href: '/kg' },
]

// ───────────────────────── the two novel resources ─────────────────────────

export interface Resource {
  name: string
  kicker: string
  blurb: string
  /** `/api/meta` field for the headline number (with static fallback). */
  stat: LiveStat
  /** Extra verifiable facts (thesis figures), shown as small chips. */
  facts: string[]
  href: string
  hrefLabel: string
}

export const RESOURCES: Resource[] = [
  {
    name: 'Akoma Ntoso Algerian legal corpus',
    kicker: 'Novel resource I',
    blurb:
      'A structured corpus of Algerian legislation — each text paired with ' +
      'Akoma Ntoso XML and an RDF/Turtle projection, spanning constitutional ' +
      'texts, major codes, sectoral legislation and amending decrees.',
    stat: HEADLINE_STATS[0], // documents
    facts: [
      '171 source files across formats (PDF · AKN · TXT · RDF), 1963–2025 — the ' +
        'thesis’s raw source-file count, distinct from the structured documents ' +
        'indexed in this demo.',
      'Akoma Ntoso XML + RDF/Turtle per document.',
    ],
    href: '/corpus',
    hrefLabel: 'Explore the corpus',
  },
  {
    name: 'AlgerianLegalBench v3.0',
    kicker: 'Novel resource II',
    blurb:
      'A benchmark built to test grounding rather than fluency — evaluating ' +
      'retrieval, citation accuracy, abstention and faithfulness, including ' +
      'jurisdictional-infection traps that probe whether a system imports ' +
      'foreign doctrine where Algerian law is silent.',
    stat: HEADLINE_STATS[2], // benchmark_questions
    facts: [
      '244 questions · 23 legal categories · 8 query types.',
      '40 jurisdictional-infection traps.',
    ],
    href: '/benchmark',
    hrefLabel: 'Browse the benchmark',
  },
]

// ───────────────────────── authorship & jury ─────────────────────────

export type JuryRole = 'President' | 'Supervisor' | 'Co-supervisor' | 'Examiner'

export interface JuryMember {
  name: string
  role: JuryRole
  /** Verbatim academic grade from the thesis ("MCA", "Professor"). */
  grade: string
  affiliation: string
  country: string
}

/** Verbatim from the thesis jury table (lines 22–48). Order = President,
 *  Supervisor, Co-supervisor, Examiner. "MCA" and "U. Autónoma" are kept as
 *  written — not expanded. */
export const JURY: JuryMember[] = [
  { name: 'Wahid Chami', role: 'President', grade: 'MCA', affiliation: 'ENSIA', country: 'Algeria' },
  { name: 'Fouad Dahak', role: 'Supervisor', grade: 'MCA', affiliation: 'ENSIA', country: 'Algeria' },
  { name: 'Ivan Cantador', role: 'Co-supervisor', grade: 'Professor', affiliation: 'U. Autónoma', country: 'Spain' },
  { name: 'Mohamed Brahimi', role: 'Examiner', grade: 'MCA', affiliation: 'ENSIA', country: 'Algeria' },
]

/** Convenience views over JURY (no new facts). */
export const SUPERVISORS: JuryMember[] = JURY.filter(
  (j) => j.role === 'Supervisor' || j.role === 'Co-supervisor',
)

// ───────────────────────── demo purpose & AI usage ─────────────────────────

export const DEMO_PURPOSE =
  'This is a demo, not a chatbot. It exists to make a citation-faithful ' +
  'legal-reasoning system inspectable for the viva: most pages render from ' +
  'precomputed results, so the whole demo works offline, and an optional live ' +
  'mode runs the real pipeline when an LLM endpoint is reachable.'

/** First paragraph summarises the thesis’s formal AI-usage disclosure (lines
 *  84–98); the second is an honest, non-overclaiming note about THIS demo. */
export const AI_USAGE: string[] = [
  'The dissertation carries a formal AI-usage disclosure: large-language-model ' +
    'tools assisted with debugging, prototype refinement, prompt engineering and ' +
    'optimization, with parts of corpus cleaning, metadata extraction and ' +
    'consistency checking, figure preparation, and linguistic refinement of the ' +
    'manuscript. All methodological decisions, final code validation and the ' +
    'integrity of the research remain the authors’ responsibility.',
  'This interactive demo was, in turn, built with AI assistance as a ' +
    'presentation layer over that research. The metrics, datasets and findings ' +
    'shown are the thesis’s own — the demo renders them faithfully and adds ' +
    'nothing to the science.',
]

// ───────────────────────── links ─────────────────────────

export interface AboutLink {
  href: string
  label: string
  blurb: string
}

export const LINKS: AboutLink[] = [
  { href: '/', label: 'Pipeline', blurb: 'Replay or run the reasoning trajectory.' },
  { href: '/architecture', label: 'Architecture', blurb: 'The full system, component by component.' },
  { href: '/corpus', label: 'Corpus', blurb: 'The Akoma Ntoso legal documents.' },
  { href: '/kg', label: 'Knowledge Graph', blurb: 'The legal knowledge graph explorer.' },
  { href: '/benchmark', label: 'Benchmark', blurb: 'AlgerianLegalBench questions & outcomes.' },
  { href: '/results', label: 'Results', blurb: 'The locked Phase-E evaluation.' },
]

// TODO(author): external links (paper / code repository / ENSIA) — add here when
// a canonical URL is available; none are hard-coded so nothing can 404 in the viva.
