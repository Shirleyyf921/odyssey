import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSse } from './sse.js'

function bodyFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out: string[] = []
  for await (const d of readSse(body)) out.push(d)
  return out
}

test('events split across network chunks are reassembled', async () => {
  const events = await collect(bodyFrom(['data: {"a":1}\n\nda', 'ta: {"b":2}\n\n', 'data: [DONE]\n\n']))
  assert.deepEqual(events, ['{"a":1}', '{"b":2}', '[DONE]'])
})

test('comments and CRLF line endings are tolerated', async () => {
  const events = await collect(bodyFrom([': keepalive\r\n\r\ndata: x\r\n\r\n']))
  assert.deepEqual(events, ['x'])
})

test('a final event without a trailing blank line is not lost', async () => {
  const events = await collect(bodyFrom(['data: last']))
  assert.deepEqual(events, ['last'])
})
