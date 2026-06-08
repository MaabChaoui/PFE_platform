/**
 * Typed client over the AKN-RLM backend (`NEXT_PUBLIC_API_BASE`, inlined at
 * build time → `http://localhost:8000/api`). Every endpoint from plan §4 has a
 * function here. All calls go through `apiFetch`, which normalises failures into
 * a typed `ApiError` (status 0 == backend unreachable/offline) so callers can
 * render clean error / offline states instead of catching raw fetch throws.
 */
import type {
  Article,
  Baselines,
  Classification,
  ClassifyResponse,
  CompareRequest,
  CompareResponse,
  DocumentDetail,
  DocumentSummary,
  Health,
  KGMeta,
  KGSearchHit,
  Meta,
  Metrics,
  NearestExample,
  NodeDetail,
  PipelineConfig,
  QuestionDetail,
  QuestionPage,
  ResetResponse,
  RunInfo,
  SearchHit,
  Stats,
  Subgraph,
  AnswerOptions,
  AnswerResponse,
} from './types'

/** Back-compat alias (S0 used this name). */
export type HealthResponse = Health

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000/api'

/** Normalised API failure. `status === 0` means the backend was unreachable. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly url: string

  constructor(opts: { status: number; detail: string; url: string }) {
    super(`API ${opts.status || 'ERR'}: ${opts.detail}`)
    this.name = 'ApiError'
    this.status = opts.status
    this.detail = opts.detail
    this.url = opts.url
  }

  /** True when the request never reached the backend (offline / DNS / CORS). */
  get isOffline(): boolean {
    return this.status === 0
  }
}

type QueryValue = string | number | boolean | string[] | null | undefined

interface FetchOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  params?: Record<string, QueryValue>
  signal?: AbortSignal
  parse?: 'json' | 'text'
}

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = `${API_BASE}${path}`
  if (!params) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','))
    } else {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

/** FastAPI errors are `{detail: string}` or 422 `{detail: [{loc,msg,...}]}`. */
function extractDetail(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d) =>
          d && typeof d === 'object' && 'msg' in d
            ? String((d as { msg: unknown }).msg)
            : JSON.stringify(d),
        )
        .join('; ')
    }
  }
  return fallback
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.params)
  let res: Response
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers:
        opts.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError({
      status: 0,
      detail:
        err instanceof Error ? err.message : 'backend unreachable (offline)',
      url,
    })
  }

  if (!res.ok) {
    let detail = res.statusText || `request failed (${res.status})`
    try {
      detail = extractDetail(await res.json(), detail)
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError({ status: res.status, detail, url })
  }

  if (opts.parse === 'text') {
    return (await res.text()) as unknown as T
  }
  return (await res.json()) as T
}

const seg = encodeURIComponent

// ───────────────────────── health & meta ─────────────────────────

export function getHealth(signal?: AbortSignal): Promise<Health> {
  return apiFetch<Health>('/health', { signal })
}

export function getMeta(signal?: AbortSignal): Promise<Meta> {
  return apiFetch<Meta>('/meta', { signal })
}

// ───────────────────────── corpus ─────────────────────────

export function listDocuments(signal?: AbortSignal): Promise<DocumentSummary[]> {
  return apiFetch<DocumentSummary[]>('/corpus/documents', { signal })
}

export function getDocument(
  docId: string,
  signal?: AbortSignal,
): Promise<DocumentDetail> {
  return apiFetch<DocumentDetail>(`/corpus/documents/${seg(docId)}`, { signal })
}

export function getDocumentXml(
  docId: string,
  signal?: AbortSignal,
): Promise<string> {
  return apiFetch<string>(`/corpus/documents/${seg(docId)}/xml`, {
    parse: 'text',
    signal,
  })
}

export function getDocumentText(
  docId: string,
  signal?: AbortSignal,
): Promise<string> {
  return apiFetch<string>(`/corpus/documents/${seg(docId)}/text`, {
    parse: 'text',
    signal,
  })
}

export function getArticle(
  docId: string,
  articleRef: string,
  signal?: AbortSignal,
): Promise<Article> {
  return apiFetch<Article>(
    `/corpus/articles/${seg(docId)}/${seg(articleRef)}`,
    { signal },
  )
}

export function searchCorpus(
  args: { q: string; doc_id?: string; type?: string },
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  return apiFetch<SearchHit[]>('/corpus/search', {
    params: { q: args.q, doc_id: args.doc_id, type: args.type },
    signal,
  })
}

// ───────────────────────── knowledge graph ─────────────────────────

export function kgMeta(signal?: AbortSignal): Promise<KGMeta> {
  return apiFetch<KGMeta>('/kg/meta', { signal })
}

export function kgSubgraph(
  args: {
    seed?: string
    doc_id?: string
    node_types?: string[]
    edge_types?: string[]
    depth?: number
    limit?: number
  },
  signal?: AbortSignal,
): Promise<Subgraph> {
  return apiFetch<Subgraph>('/kg/subgraph', {
    params: {
      seed: args.seed,
      doc_id: args.doc_id,
      node_types: args.node_types,
      edge_types: args.edge_types,
      depth: args.depth,
      limit: args.limit,
    },
    signal,
  })
}

export function kgNode(id: string, signal?: AbortSignal): Promise<NodeDetail> {
  // The query form (/kg/node?id=) is safest for full-URI node ids.
  return apiFetch<NodeDetail>('/kg/node', { params: { id }, signal })
}

export function kgSearch(
  args: { q: string; node_types?: string[]; limit?: number },
  signal?: AbortSignal,
): Promise<KGSearchHit[]> {
  return apiFetch<KGSearchHit[]>('/kg/search', {
    params: { q: args.q, node_types: args.node_types, limit: args.limit },
    signal,
  })
}

// ───────────────────────── benchmark ─────────────────────────

export interface ListQuestionsArgs {
  query_type?: string
  difficulty?: string
  category?: string
  answerable?: boolean
  language?: string
  split?: string
  q?: string
  page?: number
  page_size?: number
}

export function listQuestions(
  args: ListQuestionsArgs = {},
  signal?: AbortSignal,
): Promise<QuestionPage> {
  return apiFetch<QuestionPage>('/benchmark/questions', {
    params: { ...args },
    signal,
  })
}

export function getQuestion(
  id: string,
  signal?: AbortSignal,
): Promise<QuestionDetail> {
  return apiFetch<QuestionDetail>(`/benchmark/questions/${seg(id)}`, { signal })
}

export function benchmarkStats(signal?: AbortSignal): Promise<Stats> {
  return apiFetch<Stats>('/benchmark/stats', { signal })
}

// ───────────────────────── results ─────────────────────────

export function getMetrics(signal?: AbortSignal): Promise<Metrics> {
  return apiFetch<Metrics>('/results/metrics', { signal })
}

export function getBaselines(signal?: AbortSignal): Promise<Baselines> {
  return apiFetch<Baselines>('/results/baselines', { signal })
}

export function getRuns(signal?: AbortSignal): Promise<RunInfo[]> {
  return apiFetch<RunInfo[]>('/results/runs', { signal })
}

export function getClassification(
  signal?: AbortSignal,
): Promise<Classification> {
  return apiFetch<Classification>('/results/classification', { signal })
}

// ───────────────────────── pipeline / answer ─────────────────────────

export function getPipelineConfig(
  signal?: AbortSignal,
): Promise<PipelineConfig> {
  return apiFetch<PipelineConfig>('/pipeline/config', { signal })
}

export function resetPipeline(signal?: AbortSignal): Promise<ResetResponse> {
  return apiFetch<ResetResponse>('/pipeline/reset', { method: 'POST', signal })
}

/** Live classifier preview. Throws ApiError(503) when the LLM is unavailable. */
export function classify(
  query: string,
  signal?: AbortSignal,
): Promise<ClassifyResponse> {
  return apiFetch<ClassifyResponse>('/classify', {
    method: 'POST',
    body: { query },
    signal,
  })
}

/** Live sync answer. Throws ApiError(503) on LLM/endpoint failure (see S15 fallback). */
export function answer(
  query: string,
  options?: Partial<AnswerOptions>,
  signal?: AbortSignal,
): Promise<AnswerResponse> {
  return apiFetch<AnswerResponse>('/answer', {
    method: 'POST',
    body: { query, options: options ?? {} },
    signal,
  })
}

/** Nearest precomputed example to replay as a RELEVANT offline fallback (S15) —
 *  powers the live-error surface's "Replay a relevant example". OFFLINE. */
export function getNearest(
  query?: string | null,
  queryType?: string | null,
  signal?: AbortSignal,
): Promise<NearestExample> {
  return apiFetch<NearestExample>('/answer/nearest', {
    params: { query: query ?? undefined, query_type: queryType ?? undefined },
    signal,
  })
}

// ───────────────────────── retrieval lab ─────────────────────────

export function compareRetrieval(
  req: CompareRequest,
  signal?: AbortSignal,
): Promise<CompareResponse> {
  return apiFetch<CompareResponse>('/retrieval/compare', {
    method: 'POST',
    body: req,
    signal,
  })
}
