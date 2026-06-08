/**
 * S15 — SSE transport-drop resilience. A transient network drop mid-run is
 * retried (onReconnect fires, the re-stream completes); a server `error` frame
 * is terminal (no retry); deterministic HTTP errors are terminal.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { streamAnswer } from './sse'

const enc = new TextEncoder()

/** A fake Response whose reader yields the given SSE text once, then closes. */
function okResponse(sseText: string) {
  let sent = false
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          read: async () =>
            sent
              ? { done: true, value: undefined }
              : ((sent = true), { done: false, value: enc.encode(sseText) }),
        }
      },
    },
  } as unknown as Response
}

/** A fake Response whose reader rejects mid-read (a network drop). */
function droppedResponse() {
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return { read: async () => { throw new TypeError('network error') } }
      },
    },
  } as unknown as Response
}

const ANSWER_FRAME =
  'event: answer\ndata: {"answer_text":"ok","trajectory":[]}\n\n' +
  'event: done\ndata: {"ok":true,"mode":"live","n_steps":0}\n\n'

afterEach(() => vi.restoreAllMocks())

describe('streamAnswer transport resilience', () => {
  it('retries a transient drop and completes on reconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(droppedResponse()) // attempt 1: drops mid-read
      .mockResolvedValueOnce(okResponse(ANSWER_FRAME)) // attempt 2: succeeds
    vi.stubGlobal('fetch', fetchMock)

    const reconnects: number[] = []
    let answered = false
    let done = false
    let errored = false

    await streamAnswer(
      { mode: 'live', query: 'q' },
      {
        onReconnect: (n) => reconnects.push(n),
        onAnswer: () => { answered = true },
        onDone: () => { done = true },
        onError: () => { errored = true },
      },
    )

    expect(reconnects).toEqual([1]) // one reconnect, before the retry
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(answered).toBe(true)
    expect(done).toBe(true)
    expect(errored).toBe(false)
  })

  it('does NOT retry a server error frame (terminal)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okResponse('event: error\ndata: {"detail":"LLM down"}\n\n'),
      )
    vi.stubGlobal('fetch', fetchMock)

    const reconnects: number[] = []
    let errorDetail = ''
    await streamAnswer(
      { mode: 'live', query: 'q' },
      {
        onReconnect: (n) => reconnects.push(n),
        onError: (e) => { errorDetail = e.detail },
      },
    )

    expect(reconnects).toEqual([]) // server error is NOT a transport retry
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(errorDetail).toBe('LLM down')
  })

  it('surfaces an error after exhausting transport retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(droppedResponse())
    vi.stubGlobal('fetch', fetchMock)

    const reconnects: number[] = []
    let errored = false
    await streamAnswer(
      { mode: 'live', query: 'q' }, // live → 1 retry cap
      {
        onReconnect: (n) => reconnects.push(n),
        onError: () => { errored = true },
      },
    )

    expect(reconnects).toEqual([1]) // capped at 1 for live
    expect(fetchMock).toHaveBeenCalledTimes(2) // initial + 1 retry
    expect(errored).toBe(true)
  })
})
