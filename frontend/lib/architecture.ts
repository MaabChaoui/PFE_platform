/**
 * Architecture page — content module (single source of truth).
 *
 * A typed, data-driven graph of the whole AKN-RLM pipeline. The diagram, the
 * detail panels and the animated data-flow are all derived from `ARCH_NODES` +
 * `ARCH_EDGES` here, so the page is provably accurate and trivially editable.
 *
 * To ADD or EDIT a node: append/modify an `ArchNode` below (keep `code` paths
 * REAL — repo-root form `akn_rlm/...`, verified to exist) and wire it into
 * `ARCH_EDGES`. The diagram lays nodes out by `group`; the panel renders
 * `what / inputs / outputs / code / metric / links`.
 *
 * Numbers are the LOCKED thesis values (offline source of truth). When the
 * backend is reachable, `metric.overallKey` lets the page re-read the live value
 * from `GET /api/results/metrics` (`overall.<key>`) — a non-blocking enhancement
 * that never changes first paint.
 */

export type ArchGroup =
  | 'data'
  | 'classify'
  | 'route'
  | 'handlers'
  | 'retrieval'
  | 'reasoning'
  | 'gates'
  | 'output'
  | 'models'

/** How to format a live `overall.<key>` value when enriching a metric chip. */
export type MetricKind = 'ratio' | 'pct' | 'sec'

export interface ArchMetric {
  label: string
  /** Static (locked) display value — always shown offline. */
  value: string
  /** Deep-link to where the metric is reported. */
  href?: string
  /** Optional live enrichment: key in `metrics.overall` + how to format it. */
  overallKey?: string
  kind?: MetricKind
  digits?: number
}

export interface ArchNode {
  id: string
  group: ArchGroup
  title: string
  /** One-liner shown on the node card. */
  short: string
  /** 1–3 sentences shown in the detail panel. */
  what: string
  inputs: string[]
  outputs: string[]
  /** REAL repo paths (repo-root form), shown in monospace + copyable. */
  code: string[]
  metric?: ArchMetric
  links?: { label: string; href: string }[]
}

export type ArchEdgeKind = 'flow' | 'feed' | 'loop'

export interface ArchEdge {
  from: string
  to: string
  label?: string
  /** flow = primary spine · feed = data-band feeder · loop = corrective back-edge. */
  kind?: ArchEdgeKind
}

/* ─────────────────────────── DATA LAYER ─────────────────────────── */

const DATA_NODES: ArchNode[] = [
  {
    id: 'corpus',
    group: 'data',
    title: 'Akoma Ntoso corpus',
    short: '45 documents · ~8,868 articles',
    what: 'The official Algerian legal corpus parsed from Akoma Ntoso XML into canonical article IDs with an alias registry. 45 documents yield ~8,868 articles that every downstream stage cites against.',
    inputs: ['Akoma Ntoso XML (latest_dataset/akn)'],
    outputs: ['Article objects', 'document & article registry', 'alias map'],
    code: [
      'akn_rlm/akn_rlm/corpus/akn_parser.py',
      'akn_rlm/akn_rlm/corpus/article_registry.py',
      'akn_rlm/akn_rlm/corpus/chunker.py',
    ],
    links: [{ label: 'Open corpus explorer', href: '/corpus' }],
  },
  {
    id: 'kg',
    group: 'data',
    title: 'Legal Knowledge Graph',
    short: '765,215 RDF triples',
    what: 'An RDF knowledge graph of the corpus supporting SPARQL, amendment chains and article-at-date resolution. It anchors the temporal/version-aware retrieval used by the temporal and conceptual handlers.',
    inputs: ['RDF/Turtle graph (latest_dataset/rdf)'],
    outputs: ['SPARQL results', 'amendment chains', 'article-at-date'],
    code: ['akn_rlm/akn_rlm/corpus/kg_loader.py'],
    metric: { label: 'RDF triples', value: '765,215' },
    links: [{ label: 'Open KG explorer', href: '/kg' }],
  },
  {
    id: 'indices',
    group: 'data',
    title: 'Retrieval indices',
    short: 'BM25 + Dense FAISS (e5-small)',
    what: 'Two pre-built indices over the corpus: a lexical BM25 store and a dense FAISS index encoded with intfloat/multilingual-e5-small. Together they back the hybrid retriever.',
    inputs: ['Article chunks from the corpus'],
    outputs: ['bm25.pkl', 'dense.faiss', 'dense_meta.parquet'],
    code: [
      'akn_rlm/akn_rlm/indexers/bm25.py',
      'akn_rlm/akn_rlm/indexers/dense.py',
      'akn_rlm/scripts/build_indices.py',
    ],
  },
  {
    id: 'benchmark',
    group: 'data',
    title: 'AlgerianLegalBench v3.0',
    short: '244 questions · 8 types · 23 categories',
    what: 'The evaluation benchmark: 244 questions spanning 8 query types and 23 legal categories, each with gold target articles. It drives both the locked offline run and the replay mode.',
    inputs: ['Curated legal questions + gold articles'],
    outputs: ['Typed questions', 'gold citations', 'reasoning chains'],
    code: ['latest_dataset/AlgerianLegalBench_v3.0_final.json'],
    metric: { label: 'Questions', value: '244' },
    links: [{ label: 'Open benchmark', href: '/benchmark' }],
  },
]

/* ─────────────────────────── PIPELINE ─────────────────────────── */

const PIPELINE_NODES: ArchNode[] = [
  {
    id: 'entry',
    group: 'output',
    title: 'Query · answer_query()',
    short: 'UI entry point → AnswerResponse',
    what: 'The single UI entry point. A raw user query (Arabic, French or Algerian Darja) enters here and an AnswerResponse leaves here; everything between is the dispatched RLM pipeline.',
    inputs: ['Raw query (AR / FR / Darja)'],
    outputs: ['AnswerResponse'],
    code: ['akn_rlm/akn_rlm/api/answer.py'],
    links: [{ label: 'Live / replay pipeline', href: '/' }],
  },
  {
    id: 'classifier',
    group: 'classify',
    title: 'Query classifier',
    short: 'Gemma-4-31B → 1 of 8 query types',
    what: 'A Gemma-4-31B few-shot classifier maps the query to one of 8 query types (e.g. exact_article, multi_hop, temporal_factual, unanswerable). The type chooses which typed handler the dispatcher will run.',
    inputs: ['Raw query'],
    outputs: ['query_type (1 of 8)'],
    code: ['akn_rlm/akn_rlm/rlm/classifier.py'],
    metric: { label: 'Classifier accuracy', value: '0.697', href: '/results' },
    links: [{ label: 'Classification metrics', href: '/results' }],
  },
  {
    id: 'router',
    group: 'route',
    title: 'Document router',
    short: 'alias + numeric + BM25 → top-3 docs',
    what: 'Routes the query to the most likely source documents using alias matching, numeric law-number detection and BM25, with optional LLM/KG assists. Returns the top-3 candidate doc_ids to scope retrieval.',
    inputs: ['Raw query', 'alias registry'],
    outputs: ['top-3 doc_ids'],
    code: ['akn_rlm/akn_rlm/rlm/routing/doc_router.py'],
  },
  {
    id: 'dispatcher',
    group: 'handlers',
    title: 'Dispatcher',
    short: 'query_type → 1 of 8 typed handlers',
    what: 'The RLM dispatcher selects and runs the typed handler bound to the classified query_type, threading the routed documents and shared config into it.',
    inputs: ['query_type', 'top-3 doc_ids'],
    outputs: ['handler invocation'],
    code: ['akn_rlm/akn_rlm/rlm/dispatcher.py'],
  },
  {
    id: 'handlers',
    group: 'handlers',
    title: '8 typed handlers',
    short: 'rule · exact · multi-hop · temporal · …',
    what: 'Eight specialized handlers (rule_application, exact_article, multi_hop, temporal_factual, conceptual_definitional, unanswerable, layman, long_context). Each runs the same skeleton — retrieve → verify → (KG / recursion) → summarize — tuned to its query type.',
    inputs: ['Routed query + documents'],
    outputs: ['Verified citations + Arabic answer'],
    code: ['akn_rlm/akn_rlm/rlm/handlers/'],
  },
  {
    id: 'retrieval',
    group: 'retrieval',
    title: 'Hybrid retrieval (RRF)',
    short: 'BM25 + Dense fused by Reciprocal Rank Fusion',
    what: 'Hybrid retrieval fuses the BM25 and dense channels with Reciprocal Rank Fusion (optionally widened by a HyDE query). This is the real RLM retrieval path — re-ranking and tunable fusion weights live in the Retrieval Lab baselines, not here.',
    inputs: ['Routed query', 'BM25 + Dense indices'],
    outputs: ['Fused candidate articles'],
    code: [
      'akn_rlm/akn_rlm/retrievers/hybrid_fusion.py',
      'akn_rlm/akn_rlm/retrievers/lexical.py',
      'akn_rlm/akn_rlm/retrievers/dense.py',
      'akn_rlm/akn_rlm/rlm/enhancers.py',
    ],
    metric: {
      label: 'Article Recall@10',
      value: '0.258',
      href: '/results',
      overallKey: 'recall_article',
      kind: 'ratio',
      digits: 3,
    },
    links: [
      { label: 'Retrieval Lab', href: '/' },
      { label: 'Retrieval metrics', href: '/results' },
    ],
  },
  {
    id: 'verifier',
    group: 'reasoning',
    title: 'Sub-LM verifier',
    short: 'Qwen3-30B judges relevance + span',
    what: 'A sub-LM (Qwen3-30B-A3B-Thinking) judges each retrieved candidate for true relevance and pins the supporting span. Irrelevant candidates are dropped before they can be cited.',
    inputs: ['Fused candidates', 'query'],
    outputs: ['Relevant candidates + supporting spans'],
    code: [
      'akn_rlm/akn_rlm/rlm/sub_worker.py',
      'akn_rlm/akn_rlm/rlm/supervisor.py',
    ],
  },
  {
    id: 'kg_chain',
    group: 'retrieval',
    title: 'KG amendment chain',
    short: 'version-anchored article-at-date',
    what: 'For temporal_factual and conceptual_definitional queries, this resolves amendment chains through the Knowledge Graph so the cited article is the version in force at the relevant date.',
    inputs: ['Query date / version anchor', 'Knowledge Graph'],
    outputs: ['Version-correct articles'],
    code: [
      'akn_rlm/akn_rlm/rlm/handlers/temporal_factual.py',
      'akn_rlm/akn_rlm/rlm/handlers/conceptual_definitional.py',
      'akn_rlm/akn_rlm/corpus/kg_loader.py',
    ],
    links: [{ label: 'Open KG explorer', href: '/kg' }],
  },
  {
    id: 'recursion',
    group: 'reasoning',
    title: 'Gap-driven recursion',
    short: 'Phase D · gpt-oss-120b gap-probe',
    what: 'A gpt-oss-120b gap-probe inspects the current evidence and, if a gap remains, fires additive depth-2/3 retrieval. It is the mechanism behind multi-hop coverage.',
    inputs: ['Verified evidence so far'],
    outputs: ['Additional retrieved evidence (depth 2–3)'],
    code: [
      'akn_rlm/akn_rlm/rlm/recursive_refine.py',
      'akn_rlm/akn_rlm/rlm/recursion_budget.py',
    ],
    metric: { label: 'Fires on', value: '45.1% of questions' },
  },
  {
    id: 'adu',
    group: 'reasoning',
    title: 'Toulmin argument mining',
    short: 'Phase C · claim/ground/warrant/rebuttal',
    what: 'Pervasive Toulmin argument mining annotates the top-N citations with claim, ground, warrant, rebuttal and backing — making the legal reasoning explicit and measurable.',
    inputs: ['Top-N surviving citations'],
    outputs: ['Toulmin ADUs per citation'],
    code: ['akn_rlm/akn_rlm/rlm/adu_helpers.py', 'akn_rlm/akn_rlm/adu/'],
    metric: {
      label: 'AM-faithfulness',
      value: '0.471',
      href: '/results',
      overallKey: 'am_faithfulness_score',
      kind: 'ratio',
      digits: 3,
    },
    links: [{ label: 'Faithfulness metrics', href: '/results' }],
  },
  {
    id: 'summarizer',
    group: 'reasoning',
    title: 'Summarizer',
    short: 'Qwen3-30B synthesises the Arabic answer',
    what: 'The summarizer (Qwen3-30B) writes the final Arabic answer strictly over the surviving, verified citations — no citation can appear that did not pass verification.',
    inputs: ['Surviving citations + ADUs'],
    outputs: ['Arabic answer over cited articles'],
    code: ['akn_rlm/akn_rlm/rlm/sub_worker.py'],
  },
]

/* ─────────────────── TRIPLE FAITHFULNESS GATE ─────────────────── */

const GATE_NODES: ArchNode[] = [
  {
    id: 'gate_citation',
    group: 'gates',
    title: 'Citation + span gate',
    short: 'HCR = 0.000 by construction',
    what: 'Gate 1 of the triple faithfulness gate: every citation must reference an article that exists and a span that exists in that article. Hallucinated citations are structurally impossible — the Hallucinated-Citation Rate is 0 by construction.',
    inputs: ['Answer citations + spans'],
    outputs: ['Existence-checked citations'],
    code: [
      'akn_rlm/akn_rlm/gates/citation_existence.py',
      'akn_rlm/akn_rlm/gates/span_existence.py',
    ],
    metric: {
      label: 'HCR',
      value: '0.000',
      href: '/results',
      overallKey: 'hcr',
      kind: 'ratio',
      digits: 3,
    },
    links: [{ label: 'Faithfulness metrics', href: '/results' }],
  },
  {
    id: 'gate_jurisdiction',
    group: 'gates',
    title: 'Jurisdiction gate',
    short: 'JIR = 0.000 (40 foreign-law canaries)',
    what: 'Gate 2: 40 foreign-law canaries detect and block jurisdictional infection, ensuring no answer leans on non-Algerian law. The Jurisdictional-Infection Rate is 0.',
    inputs: ['Citations + answer text'],
    outputs: ['Jurisdiction-clean answer'],
    code: ['akn_rlm/akn_rlm/gates/jurisdiction.py'],
    metric: {
      label: 'JIR',
      value: '0.000',
      href: '/results',
      overallKey: 'jir',
      kind: 'ratio',
      digits: 3,
    },
    links: [{ label: 'Faithfulness metrics', href: '/results' }],
  },
  {
    id: 'gate_faithfulness',
    group: 'gates',
    title: 'Answer–citation NLI gate',
    short: 'mDeBERTa NLI → corrective retry',
    what: 'Gate 3: an mDeBERTa-v3 NLI model checks that the answer is entailed by its citations. A failure triggers one corrective regeneration constrained to the cited articles.',
    inputs: ['Answer + cited articles'],
    outputs: ['Entailment verdict (pass / retry)'],
    code: ['akn_rlm/akn_rlm/gates/faithfulness_nli.py'],
  },
  {
    id: 'corrective_retry',
    group: 'gates',
    title: 'Corrective retry',
    short: 'one regeneration on gate failure',
    what: 'On a gate failure, the answer is regenerated exactly once with the instruction to use only the cited articles. This recovers most borderline cases without a second full pipeline pass.',
    inputs: ['Failed answer + cited articles'],
    outputs: ['Corrected answer'],
    code: ['akn_rlm/akn_rlm/rlm/corrective_retry.py'],
    metric: {
      label: 'Fires on',
      value: '19.3%',
      href: '/results',
      overallKey: 'corrective_retry_rate',
      kind: 'pct',
      digits: 1,
    },
  },
]

/* ─────────────────────────── OUTPUT ─────────────────────────── */

const OUTPUT_NODE: ArchNode = {
  id: 'output',
  group: 'output',
  title: 'AnswerResponse',
  short: 'answer · citations · trajectory · telemetry',
  what: 'The final structured response: the Arabic answer_text, citations[] and references[], the full trajectory[], an abstained flag, and telemetry (latency, sub-LM calls, recursion depth). Mean end-to-end latency is 9.7 s.',
  inputs: ['Gated, corrected answer'],
  outputs: ['answer_text', 'citations[] + references[]', 'trajectory[] + telemetry'],
  code: ['akn_rlm/akn_rlm/api/answer.py'],
  metric: {
    label: 'Mean latency',
    value: '9.7 s',
    href: '/results',
    overallKey: 'mean_latency_s',
    kind: 'sec',
  },
  links: [
    { label: 'Live / replay pipeline', href: '/' },
    { label: 'Benchmark predictions', href: '/benchmark' },
  ],
}

export const ARCH_NODES: ArchNode[] = [
  ...DATA_NODES,
  ...PIPELINE_NODES,
  ...GATE_NODES,
  OUTPUT_NODE,
]

const NODE_BY_ID: Record<string, ArchNode> = Object.fromEntries(
  ARCH_NODES.map((n) => [n.id, n]),
)

export function getArchNode(id: string | null | undefined): ArchNode | undefined {
  return id ? NODE_BY_ID[id] : undefined
}

/* ─────────────────────────── EDGES ───────────────────────────
 * Complete graph. `flow` = the primary spine (drives the animated data-flow);
 * `feed` = data-band → pipeline feeders; `loop` = corrective back-edge. */
export const ARCH_EDGES: ArchEdge[] = [
  // Data band → pipeline
  { from: 'corpus', to: 'indices', kind: 'feed', label: 'indexed' },
  { from: 'corpus', to: 'retrieval', kind: 'feed' },
  { from: 'indices', to: 'retrieval', kind: 'feed' },
  { from: 'kg', to: 'kg_chain', kind: 'feed' },
  { from: 'kg', to: 'router', kind: 'feed', label: 'optional' },
  { from: 'benchmark', to: 'entry', kind: 'feed', label: 'replay' },

  // Primary spine
  { from: 'entry', to: 'classifier', kind: 'flow' },
  { from: 'classifier', to: 'router', kind: 'flow' },
  { from: 'router', to: 'dispatcher', kind: 'flow' },
  { from: 'dispatcher', to: 'handlers', kind: 'flow' },
  { from: 'handlers', to: 'retrieval', kind: 'flow' },
  { from: 'retrieval', to: 'verifier', kind: 'flow' },
  { from: 'verifier', to: 'kg_chain', kind: 'flow' },
  { from: 'kg_chain', to: 'recursion', kind: 'flow' },
  { from: 'recursion', to: 'adu', kind: 'flow' },
  { from: 'adu', to: 'summarizer', kind: 'flow' },
  { from: 'summarizer', to: 'gate_citation', kind: 'flow' },
  { from: 'gate_citation', to: 'gate_jurisdiction', kind: 'flow' },
  { from: 'gate_jurisdiction', to: 'gate_faithfulness', kind: 'flow' },
  { from: 'gate_faithfulness', to: 'corrective_retry', kind: 'flow', label: 'on fail' },
  { from: 'corrective_retry', to: 'summarizer', kind: 'loop', label: 'regenerate' },
  { from: 'gate_faithfulness', to: 'output', kind: 'flow', label: 'pass' },
]

/* ───────────────────── MODELS (legend) ───────────────────── */
export interface ArchModel {
  id: string
  name: string
  role: string
}

export const ARCH_MODELS: ArchModel[] = [
  { id: 'gpt-oss-120b', name: 'gpt-oss-120b', role: 'Root reasoning + gap-probe' },
  { id: 'qwen3-30b', name: 'Qwen3-30B-A3B', role: 'Sub-LM: verify · summarize · decompose' },
  { id: 'gemma-4-31b', name: 'google/gemma-4-31B', role: 'Classifier + ADU mining' },
  { id: 'e5-small', name: 'multilingual-e5-small', role: 'Dense encoder (FAISS)' },
  { id: 'mdeberta', name: 'mDeBERTa-v3-mnli-xnli', role: 'Answer–citation NLI gate' },
]

/* ───────────── Headline metric strip (page header) ─────────────
 * Locked thesis values; `overallKey` enriches from /api/results/metrics. */
export interface HeadlineMetric {
  id: string
  label: string
  value: string
  overallKey: string
  kind: MetricKind
  digits?: number
  /** Visual accent for the value. */
  tone: 'gold' | 'success' | 'foreground'
}

export const HEADLINE_METRICS: HeadlineMetric[] = [
  { id: 'cite_f1', label: 'Citation F1', value: '0.3045', overallKey: 'citation_f1', kind: 'ratio', digits: 4, tone: 'gold' },
  { id: 'hcr', label: 'HCR', value: '0.000', overallKey: 'hcr', kind: 'ratio', digits: 3, tone: 'success' },
  { id: 'jir', label: 'JIR', value: '0.000', overallKey: 'jir', kind: 'ratio', digits: 3, tone: 'success' },
  { id: 'abs_f1', label: 'Abstention F1', value: '0.703', overallKey: 'abstention_f1', kind: 'ratio', digits: 3, tone: 'foreground' },
  { id: 'amf', label: 'AM-faithfulness', value: '0.471', overallKey: 'am_faithfulness_score', kind: 'ratio', digits: 3, tone: 'foreground' },
  { id: 'latency', label: 'Mean latency', value: '9.7 s', overallKey: 'mean_latency_s', kind: 'sec', tone: 'foreground' },
]

/** Format a live `overall.<key>` numeric value for display. */
export function formatMetric(x: number, kind: MetricKind, digits = 3): string {
  if (kind === 'pct') return `${(x * 100).toFixed(digits)}%`
  if (kind === 'sec') return `${x.toFixed(1)} s`
  return x.toFixed(digits)
}

/**
 * Group → human label + accent fragments (used by diagram + legend).
 *
 * Colour taxonomy (deliberate): the WARM orange→gold family is reserved for the
 * ACTIVE/selected state and the primary flow line — emphasis, never category. A
 * phase's identity comes from the cool pole + structure instead:
 *   · `info`    (Prussian/blue) — data layer + I/O endpoints
 *   · `success` (green)         — the faithfulness gates
 *   · neutral foreground        — every processing stage (classify · route ·
 *                                 dispatch · retrieval · reasoning), separated by
 *                                 the labelled lane bands, not by hue.
 * `swatch` is the colour used for the node's measured edges/anchor when this
 * group is the edge source (purely presentational).
 */
export const GROUP_META: Record<
  ArchGroup,
  { label: string; tone: string; dot: string; swatch: 'info' | 'success' | 'neutral' }
> = {
  data: { label: 'Data layer', tone: 'text-info', dot: 'bg-info', swatch: 'info' },
  classify: { label: 'Classification', tone: 'text-foreground/75', dot: 'bg-foreground/35', swatch: 'neutral' },
  route: { label: 'Routing', tone: 'text-foreground/75', dot: 'bg-foreground/35', swatch: 'neutral' },
  handlers: { label: 'Dispatch', tone: 'text-foreground/75', dot: 'bg-foreground/35', swatch: 'neutral' },
  retrieval: { label: 'Retrieval', tone: 'text-foreground/75', dot: 'bg-foreground/35', swatch: 'neutral' },
  reasoning: { label: 'Reasoning', tone: 'text-foreground/75', dot: 'bg-foreground/35', swatch: 'neutral' },
  gates: { label: 'Faithfulness gates', tone: 'text-success', dot: 'bg-success', swatch: 'success' },
  output: { label: 'I/O', tone: 'text-info', dot: 'bg-info', swatch: 'info' },
  models: { label: 'Models', tone: 'text-muted-foreground', dot: 'bg-muted-foreground', swatch: 'neutral' },
}
