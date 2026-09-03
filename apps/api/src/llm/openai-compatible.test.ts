import { test } from 'node:test'
import assert from 'node:assert/strict'
import { OpenAiCompatibleProvider } from './openai-compatible.js'

test('parses OpenAI-style stream chunks into deltas and usage', async () => {
  const lines = [
    'data: {"model":"m","choices":[{"delta":{"content":"Hel"}}]}\n\n',
    'data: {"model":"m","choices":[{"delta":{"content":"lo"}}]}\n\n',
    'data: {"model":"m","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\n',
    'data: [DONE]\n\n',
  ]
  let captured: { url: string; body: unknown } | null = null
  const fakeFetch: typeof fetch = async (url, init) => {
    captured = { url: String(url), body: JSON.parse(String(init?.body)) }
    return new Response(lines.join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const provider = new OpenAiCompatibleProvider({
    name: 'novita', baseUrl: 'https://api.example.com/v3/openai/', apiKey: 'k', model: 'm', fetch: fakeFetch,
  })
  const events = []
  for await (const e of provider.stream({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] })) events.push(e)

  assert.deepEqual(events, [
    { type: 'delta', text: 'Hel' },
    { type: 'delta', text: 'lo' },
    { type: 'done', model: 'm', usage: { inputTokens: 10, outputTokens: 2 } },
  ])
  assert.equal(captured!.url, 'https://api.example.com/v3/openai/chat/completions')
  const body = captured!.body as { messages: Array<{ role: string }>; stream: boolean }
  assert.equal(body.stream, true)
  assert.equal(body.messages[0]?.role, 'system')
})

test('non-2xx responses throw with the vendor status', async () => {
  const fakeFetch: typeof fetch = async () => new Response('nope', { status: 401 })
  const provider = new OpenAiCompatibleProvider({ name: 'x', baseUrl: 'https://x', apiKey: 'k', model: 'm', fetch: fakeFetch })
  await assert.rejects(async () => {
    for await (const _ of provider.stream({ system: '', messages: [] })) void _
  }, /x 401/)
})
