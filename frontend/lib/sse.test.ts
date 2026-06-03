import { describe, expect, it } from 'vitest'

import { createSSEParser, parseSSEFrame, type SSEFrame } from './sse'

describe('parseSSEFrame', () => {
  it('parses an event + data frame', () => {
    expect(parseSSEFrame('event: step\ndata: {"index":1}')).toEqual({
      event: 'step',
      data: '{"index":1}',
    })
  })

  it('defaults the event name to "message"', () => {
    expect(parseSSEFrame('data: {}')).toEqual({ event: 'message', data: '{}' })
  })

  it('joins multiple data lines with a newline (SSE spec)', () => {
    expect(parseSSEFrame('event: x\ndata: a\ndata: b')).toEqual({
      event: 'x',
      data: 'a\nb',
    })
  })

  it('ignores `:`-prefixed comment / ping lines', () => {
    expect(parseSSEFrame(': ping\nevent: heartbeat\ndata: {}')).toEqual({
      event: 'heartbeat',
      data: '{}',
    })
  })

  it('strips only one leading space after the colon', () => {
    expect(parseSSEFrame('data:  x')).toEqual({ event: 'message', data: ' x' })
  })

  it('returns null for comment-only or empty frames', () => {
    expect(parseSSEFrame(': ping')).toBeNull()
    expect(parseSSEFrame('')).toBeNull()
  })
})

describe('createSSEParser', () => {
  function collect() {
    const frames: SSEFrame[] = []
    return { frames, parser: createSSEParser((f) => frames.push(f)) }
  }

  it('emits a frame that was split across chunk boundaries', () => {
    const { frames, parser } = collect()
    parser.push('event: step\nda')
    expect(frames).toHaveLength(0) // incomplete — buffered
    parser.push('ta: {"index":0}\n\nevent: done\ndata: {}\n\n')
    expect(frames).toEqual([
      { event: 'step', data: '{"index":0}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('tolerates CRLF frame separators', () => {
    const { frames, parser } = collect()
    parser.push('event: a\r\ndata: 1\r\n\r\nevent: b\r\ndata: 2\r\n\r\n')
    expect(frames.map((f) => f.event)).toEqual(['a', 'b'])
  })

  it('skips interleaved ping comments between frames', () => {
    const { frames, parser } = collect()
    parser.push(': ping\n\nevent: answer\ndata: {"ok":true}\n\n')
    expect(frames).toEqual([{ event: 'answer', data: '{"ok":true}' }])
  })

  it('flush() emits a trailing frame with no terminating blank line', () => {
    const { frames, parser } = collect()
    parser.push('event: answer\ndata: {"x":1}')
    expect(frames).toHaveLength(0)
    parser.flush()
    expect(frames).toEqual([{ event: 'answer', data: '{"x":1}' }])
  })
})
