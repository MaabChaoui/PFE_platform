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

/**
 * Open the trajectory stream and dispatch frames to callbacks. Resolves when the
 * stream closes (or is aborted). Transport failures are reported via `onError`,
 * never thrown — the caller's UI stays alive offline.
 */
export async function streamAnswer(
  body: StreamRequest,
  cb: StreamCallbacks = {},
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/answer/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: cb.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    cb.onError?.({
      detail:
        err instanceof Error
          ? `stream connection failed: ${err.message}`
          : 'stream connection failed',
    })
    return
  }

  if (!res.ok || !res.body) {
    let detail = `stream failed (${res.status})`
    try {
      const data = (await res.json()) as { detail?: unknown }
      if (typeof data?.detail === 'string') detail = data.detail
    } catch {
      /* keep status detail */
    }
    cb.onError?.({ detail })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = createSSEParser((frame) => dispatch(frame, cb))

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
    if (err instanceof DOMException && err.name === 'AbortError') return
    cb.onError?.({
      detail:
        err instanceof Error ? `stream read error: ${err.message}` : 'stream read error',
    })
  }
}
