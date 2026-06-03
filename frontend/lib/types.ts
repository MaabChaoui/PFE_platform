/**
 * TypeScript mirror of the backend Pydantic models (`backend/app/models/*.py`).
 * This is the authoritative shape contract for the typed client (`lib/api.ts`)
 * and the SSE helper (`lib/sse.ts`). Friendly names match the S6 brief; where
 * a backend model uses `extra="allow"` or `dict[str, Any]` (intentionally loose
 * — the concrete shapes land at S8/S9 from plan §6 + the actual JSON), the
 * interface stays loose (`Record<string, unknown>` / index signatures).
 */

// ───────────────────────── health & meta ─────────────────────────

export interface Health {
  status: string
  offline_mode: boolean
  indices_present: boolean
  dataset_present: boolean
  predictions_present: boolean
  corpus_ready: boolean
  llm: string
}

export interface Meta {
  documents: number
  articles: number
  benchmark_questions: number
  kg_triples: number | null
  offline_mode: boolean
  indices_present: boolean
  dataset_present: boolean
}

// ───────────────────────── corpus ─────────────────────────

export interface FormatsAvailable {
  akn: boolean
  txt: boolean
  rdf: boolean
  pdf: boolean
}

export interface DocumentSummary {
  doc_id: string
  title: string
  date: string
  type: string
  article_count: number
  formats_available: FormatsAvailable
}

export interface HierarchyNode {
  id: string
  level: string
  label: string
  value: string | null
  article_refs: string[]
  children: HierarchyNode[]
}

export interface Article {
  doc_id: string
  article_ref: string
  eid: string
  num: string | null
  status: string | null
  doc_title: string
  doc_date: string
  doc_type: string
  frbr_uri: string
  filename_stem: string
  ancestors: Record<string, string>
  text_ar: string
  text_normalized: string
  paragraphs: string[]
}

export interface DocumentDetail {
  doc_id: string
  title: string
  date: string
  type: string
  filename_stem: string
  article_count: number
  formats_available: FormatsAvailable
  hierarchy: HierarchyNode
  articles: Article[]
}

export interface SearchHit {
  doc_id: string
  article_ref: string
  doc_title: string
  snippet: string
  score: number
}

// ───────────────────────── benchmark ─────────────────────────

export interface Correctness {
  n_gold: number
  n_pred: number
  n_correct: number
  precision: number
  recall: number
  f1: number
  abstention_scored: boolean
}

export interface QuestionSummary {
  id: string
  query_type: string
  difficulty: string
  category: string
  language: string
  answerable: boolean
  question: string
  dispatched_handler: string | null
  predicted_abstain: boolean | null
  latency_s: number | null
  correctness: Correctness
  has_prediction: boolean
}

export interface QuestionPage {
  total: number
  page: number
  page_size: number
  items: QuestionSummary[]
}

export interface ExpectedArticle {
  document_id: string
  article_ref: string
  law_name_ar: string | null
  in_dataset: boolean
  article_ref_disambig: string | null
  text: string | null
  resolved: boolean
  resolved_doc_id: string | null
  eid: string | null
  doc_title: string | null
  ancestors: Record<string, string>
  /** backend model is `extra="allow"` */
  [key: string]: unknown
}

export interface PredictionView {
  question_id: string | null
  query: string | null
  query_type: string | null
  dispatched_handler: string | null
  pred_doc_ids: string[]
  pred_article_ids: string[]
  gold_doc_ids: string[]
  gold_article_ids: string[]
  predicted_citations: Array<Record<string, unknown>>
  gold_citations: Array<Record<string, unknown>>
  predicted_abstain: boolean | null
  gold_abstain: boolean | null
  answer_text: string | null
  gold_answer_text: string | null
  reasoning_chain: unknown[]
  trajectory: Array<Record<string, unknown>>
  hcr: number | null
  jir: number | null
  answer_faithfulness: number | null
  citation_groundedness: number | null
  am_faithfulness_score: number | null
  latency_s: number | null
  sub_call_count: number | null
  calls_by_model: Record<string, number>
  retry_count: number | null
  legal_category: string | null
  difficulty: string | null
  language: string | null
  split: string | null
  correctness: Correctness | null
  /** backend model is `extra="allow"` */
  [key: string]: unknown
}

export interface QuestionDetail {
  id: string
  version: string | null
  source: string | null
  split: string | null
  language: string
  category: string
  query_type: string
  difficulty: string
  question: string
  answerable: boolean
  partially_answerable: boolean | null
  temporal_note: string | null
  expected_documents: string[]
  expected_articles: ExpectedArticle[]
  ground_truth_answer: string | null
  reasoning_chain: string[]
  annotation: Record<string, unknown>
  prediction: PredictionView | null
  gold_vs_pred: Record<string, unknown>
  /** backend model is `extra="allow"` */
  [key: string]: unknown
}

export interface Stats {
  query_type: Record<string, number>
  difficulty: Record<string, number>
  category: Record<string, number>
  answerable: Record<string, number>
  language: Record<string, number>
  split: Record<string, number>
}

// ───────────────────────── results ─────────────────────────

/** Loose by design — `metrics.json` is rendered from the file, never hardcoded. */
export interface Metrics {
  overall: Record<string, unknown>
  by_query_type: Record<string, unknown>
  by_category: Record<string, unknown>
  by_difficulty: Record<string, unknown>
  by_language: Record<string, unknown>
  by_split: Record<string, unknown>
  temporal: Record<string, unknown>
  counts: Record<string, unknown>
  [key: string]: unknown
}

export interface RunInfo {
  run_id: string
  citation_f1: number | null
  abstention_f1: number | null
  hcr: number | null
  jir: number | null
  is_locked: boolean
}

export interface Baselines {
  improvement_factors: Record<string, number>
  tier1_direct_llm: Array<Record<string, unknown>>
  tier2_deterministic_rag: Array<Record<string, unknown>>
  phase_progression: Array<Record<string, unknown>>
  ablation: Array<Record<string, unknown>>
  notes: unknown
  metric_definitions: Record<string, string>
  [key: string]: unknown
}

export interface ClassificationTypeMetrics {
  precision: number
  recall: number
  f1: number
  support: number
}

export interface Classification {
  accuracy: number
  n: number
  per_type: Record<string, ClassificationTypeMetrics>
  /** true label → { predicted label → count } */
  confusion_matrix: Record<string, Record<string, number>>
  labels: string[]
}

// ───────────────────────── knowledge graph ─────────────────────────

export interface KGNode {
  id: string
  type: string | null
  label: string | null
  doc_id: string | null
  article_ref: string | null
  props: Record<string, unknown>
}

export interface KGEdge {
  id: number
  source: string
  target: string
  predicate: string
}

export interface Subgraph {
  nodes: KGNode[]
  edges: KGEdge[]
  truncated: boolean
  total_neighbors: number
}

export interface KGTypeCount {
  type: string
  count: number
}

export interface KGPredicateCount {
  predicate: string
  count: number
}

export interface KGDocumentCount {
  doc_id: string
  nodes: number
  edges: number
}

export interface KGTotals {
  nodes: number
  edges: number
}

export interface KGMeta {
  node_types: KGTypeCount[]
  edge_types: KGPredicateCount[]
  documents: KGDocumentCount[]
  totals: KGTotals
}

export interface CorpusLink {
  doc_id: string
  article_ref: string
}

export interface NodeDegree {
  in_count: number
  out_count: number
}

export interface NodeDetail extends KGNode {
  text: string | null
  corpus_link: CorpusLink | null
  degree: NodeDegree
}

export interface KGSearchHit extends KGNode {
  text_snippet: string | null
  score: number
}

// ───────────────────────── answer / pipeline ─────────────────────────

/** Canonical 8 ALB v3.0 query types (akn_rlm.rlm.classifier.VALID_QUERY_TYPES). */
export const QUERY_TYPES = [
  'rule_application',
  'exact_article',
  'multi_hop',
  'unanswerable',
  'layman',
  'long_context',
  'conceptual_definitional',
  'temporal_factual',
] as const

export type QueryType = (typeof QUERY_TYPES)[number]

export interface EnhancerFlags {
  e1: boolean
  e2: boolean
  e3: boolean
  e5: boolean
  e6: boolean
  e7: boolean
}

/** Live-pipeline controls. Defaults == the locked Phase E config (see /pipeline/config). */
export interface AnswerOptions {
  query_type: string | null
  enable_recursion: boolean
  recursion_max_depth: number
  mh_ra_coverage_min: number
  enable_corrective_retry: boolean
  enable_pervasive_adu: boolean
  adu_extract_top_n: number
  hyde: boolean
  enhancers: EnhancerFlags
  ceiling_breakers: boolean
  use_kg: boolean
  citation_gate: boolean
  sub_model: string | null
  long_context_timeout_s: number
}

export interface Citation {
  doc_id: string
  article_ref: string
  doc_title: string
  supporting_span: string
  text: string
  confidence: number
  version_date?: string | null
  kg_source?: string | null
  argumentation?: Record<string, unknown> | null
  verifier_relevant?: boolean | null
}

export interface TrajectoryStep {
  step: string
  depth: number
  summary: string
  detail: Record<string, unknown>
}

/** Replay-only per-question scores merged into the SSE `answer` event (S4). */
export interface ReplayScores {
  hcr: number | null
  jir: number | null
  answer_faithfulness: number | null
  citation_groundedness: number | null
  am_faithfulness_score: number | null
}

export interface AnswerResponse {
  query: string
  query_type_predicted: string
  handler_used: string
  answer_text: string
  citations: Citation[]
  references: string[]
  trajectory: TrajectoryStep[]
  abstained: boolean
  abstention_reason: string | null
  latency_s: number
  sub_call_count: number
  am_faithfulness_score: number | null
  recursion_depth_max: number
  corrective_retry_fired: boolean
  /** present only on replay responses */
  scores?: ReplayScores | null
}

export interface ClassifyResponse {
  query_type: string
  confidence: number
}

export interface PipelineOption {
  key: string
  /** "bool" | "int" | "float" | "enum" | "string" */
  type: string
  default: unknown
  allowed: unknown[] | null
  advanced: boolean
  requires_live: boolean
  label: string
  help: string
}

export interface PipelineConfig {
  options: PipelineOption[]
  query_types: string[]
  defaults: Record<string, unknown>
}

export interface ResetResponse {
  ok: boolean
  cleared: number
}

// ─── SSE event payloads (POST /api/answer/stream); see lib/sse.ts ───

export interface StepEvent {
  index: number
  step: string
  depth: number
  summary: string
  detail: Record<string, unknown>
}

export interface HeartbeatEvent {
  elapsed_s: number
  status: string
}

export interface ErrorEvent {
  detail: string
}

export interface DoneEvent {
  ok: boolean
  mode: string
  n_steps: number
}

export interface StreamRequest {
  mode: 'replay' | 'live'
  question_id?: string | null
  query?: string | null
  options?: Partial<AnswerOptions>
}

// ───────────────────────── retrieval lab ─────────────────────────

export interface RRFWeights {
  bm25: number
  dense: number
}

export interface CompareRequest {
  query?: string | null
  question_id?: string | null
  retrievers?: string[]
  k_each?: number
  top_k?: number
  rrf_weights?: RRFWeights
  rerank_pool_size?: number
  doc_id?: string | null
  gold_article_ids?: string[] | null
}

export interface Candidate {
  rank: number
  doc_id: string
  article_ref: string
  doc_title: string
  snippet: string
  score: number
  is_gold: boolean
}

export interface Channel {
  name: string
  params: Record<string, unknown>
  candidates: Candidate[]
  n: number
  elapsed_ms: number
  offline_capable: boolean
  note: string | null
}

export interface CompareResponse {
  query: string
  seeded_from_question: string | null
  channels: Channel[]
  gold_article_ids: string[] | null
}
