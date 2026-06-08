/**
 * SSE helper for `POST /api/answer/stream`. The stream is a POST with a JSON
 * body, so the browser `EventSource` (GET-only) cannot be used — we read the
 * response body as a stream and parse `event:` / `data:` frames by hand.
 *
 * Event names (from S4): `step`, `heartbeat`, `answer`, `error`, `done`.
 * IMPORTANT: `error` is stream-terminal — the server emits NO trailing `done`
 * after it. Replay/success streams end in `done`. Consumers should treat either
 * `onError` or `onDone` as the end of the stream.
 *
 * The parser is split out (`createSSEParser` / `parseSSEFrame`) so it can be
 * unit-tested without a network: chunk boundaries do not align to frames, UTF-8
 * (Arabic) can split across chunks, and `sse-starlette` interleaves `:`-comment
 * pings — all handled here.
 */
import type {
  AnswerResponse,
  DoneEvent,
  ErrorEvent,
  HeartbeatEvent,
  StepEvent,
  StreamRequest,
} from './types'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000/api'

export interface SSEFrame {
  event: string
  data: string
}

/** Parse one raw SSE frame (the text between blank-line separators). */
export function parseSSEFrame(raw: string): SSEFrame | null {
  const lines = raw.split(/\r?\n/)
  let event = 'message'
  const dataLines: string[] = []
  let sawField = false

  for (const line of lines) {
    // Blank line shouldn't appear inside a frame; `:`-prefixed lines are
    // comments/pings (sse-starlette sends these) — skip both.
    if (line === '' || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') {
      event = value
      sawField = true
    } else if (field === 'data') {
      dataLines.push(value)
      sawField = true
    }
    // `id` / `retry` fields are ignored.
  }

  if (!sawField) return null
  return { event, data: dataLines.join('\n') }
}

/**
 * Stateful frame extractor. Feed it decoded text chunks via `push`; it invokes
 * `onFrame` for every complete frame and buffers the trailing partial. Frame
 * separator tolerates `\n\n`, `\r\n\r\n`, and `\r\r`.
 */
export function createSSEParser(onFrame: (frame: SSEFrame) => void) {
  let buffer = ''
  const SEP = /\r\n\r\n|\n\n|\r\r/

  return {
    push(chunk: string): void {
      buffer += chunk
      let match: RegExpExecArray | null
      while ((match = SEP.exec(buffer)) !== null) {
        const raw = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        const frame = parseSSEFrame(raw)
        if (frame) onFrame(frame)
      }
    },
    flush(): void {
      const raw = buffer
      buffer = ''
      if (raw.trim() === '') return
      const frame = parseSSEFrame(raw)
      if (frame) onFrame(frame)
    },
  }
}

export interface StreamCallbacks {
  onStep?: (event: StepEvent) => void
  onHeartbeat?: (event: HeartbeatEvent) => void
  onAnswer?: (event: AnswerResponse) => void
  onError?: (event: ErrorEvent) => void
  onDone?: (event: DoneEvent) => void
  /** Fired when a transient TRANSPORT drop is being retried (network blip mid-
   *  run), BEFORE re-issuing the request. `attempt` is 1-based. Consumers reset
   *  accumulated steps so the re-stream renders cleanly. NOT fired for a server
   *  `error` event (that is terminal). */
  onReconnect?: (attempt: number) => void
  signal?: AbortSignal
}

function dispatch(frame: SSEFrame, cb: StreamCallbacks): void {
  let payload: unknown
  try {
    payload = frame.data ? JSON.parse(frame.data) : {}
  } catch {
    // Malformed JSON in a data frame — surface as an error rather than crash.
    cb.onError?.({ detail: `unparseable ${frame.event} frame` })
    return
  }
  switch (frame.event) {
    case 'step':
      cb.onStep?.(payload as StepEvent)
      break
    case 'heartbeat':
      cb.onHeartbeat?.(payload as HeartbeatEvent)
      break
    case 'answer':
      cb.onAnswer?.(payload as AnswerResponse)
      break
    case 'error':
      cb.onError?.(payload as ErrorEvent)
      break
    case 'done':
      cb.onDone?.(payload as DoneEvent)
      break
    default:
      // unknown event — ignore
      break
  }
}

/** Outcome of a single connect+read attempt. Only `transport-error` is retried
 *  (a network blip); `http-error` (4xx/5xx, e.g. 422/404) and `server-error`
 *  (an SSE `error` frame) are deterministic + terminal; `done`/`aborted` end. */
type AttemptResult =
  | { kind: 'done' }
  | { kind: 'aborted' }
  | { kind: 'server-error' } // an SSE `error` frame already went to onError
  | { kind: 'http-error'; detail: string }
  | { kind: 'transport-error'; detail: string }

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

/** One connect+read pass. Does NOT call `onError` for transport/http failures —
 *  the retry wrapper owns that decision so a retried blip doesn't surface an
 *  error. A server `error` frame is dispatched here (terminal). */
async function streamOnce(
  body: StreamRequest,
  cb: StreamCallbacks,
): Promise<AttemptResult> {
  let sawServerError = false
  const frameCb: StreamCallbacks = {
    ...cb,
    onError: (event) => {
      sawServerError = true
      cb.onError?.(event)
    },
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/answer/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: cb.signal,
    })
  } catch (err) {
    if (isAbort(err)) return { kind: 'aborted' }
    return {
      kind: 'transport-error',
      detail:
        err instanceof Error
          ? `stream connection failed: ${err.message}`
          : 'stream connection failed',
    }
  }

  if (!res.ok || !res.body) {
    // Deterministic HTTP error (422 bad request, 404 unknown replay, …) — not a
    // transient blip, so don't retry; report it.
    let detail = `stream failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (typeof data?.detail === 'string') detail = data.detail
    } catch {
      /* keep status detail */
    }
    return { kind: 'http-error', detail }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = createSSEParser((frame) => dispatch(frame, frameCb))

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      // {stream:true} keeps multi-byte UTF-8 (Arabic) intact across chunks.
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.flush()
  } catch (err) {
    if (isAbort(err)) return { kind: 'aborted' }
    // A mid-run read failure (network drop) — retryable transport error.
    return {
      kind: 'transport-error',
      detail:
        err instanceof Error ? `stream read error: ${err.message}` : 'stream read error',
    }
  }

  return sawServerError ? { kind: 'server-error' } : { kind: 'done' }
}

/** Max TRANSPORT retries. Live re-runs the (billed) pipeline, so cap at 1;
 *  replay is idempotent + cheap, so allow 2. */
function maxRetriesFor(mode: StreamRequest['mode']): number {
  return mode === 'live' ? 1 : 2
}

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      resolve()
    }, { once: true })
  })

/**
 * Open the trajectory stream and dispatch frames to callbacks. Resolves when the
 * stream closes (or is aborted). Transport failures are NEVER thrown — they are
 * retried a bounded number of times (a transient SSE drop mid-run reconnects),
 * then surfaced via `onError`. A server `error` frame and deterministic HTTP
 * errors are terminal (no retry). The caller's UI stays alive offline.
 */
export async function streamAnswer(
  body: StreamRequest,
  cb: StreamCallbacks = {},
): Promise<void> {
  const maxRetries = maxRetriesFor(body.mode)
  for (let attempt = 0; ; attempt++) {
    const result = await streamOnce(body, cb)
    if (
      result.kind === 'transport-error' &&
      attempt < maxRetries &&
      !cb.signal?.aborted
    ) {
      const next = attempt + 1
      cb.onReconnect?.(next)
      await delay(300 * next, cb.signal) // 300ms, 600ms backoff
      if (cb.signal?.aborted) return
      continue
    }
    if (result.kind === 'transport-error') {
      cb.onError?.({ detail: result.detail }) // retries exhausted
    } else if (result.kind === 'http-error') {
      cb.onError?.({ detail: result.detail })
    }
    // 'done' | 'server-error' | 'aborted' → nothing more to do.
    return
  }
}
