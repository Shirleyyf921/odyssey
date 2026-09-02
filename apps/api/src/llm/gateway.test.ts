import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LlmGateway } from './gateway.js'
import { ScriptedProvider } from './scripted.js'
import type { CompletionEvent, LlmProvider } from './types.js'

const refusing: LlmProvider = {
  name: 'refuser',
  async *stream(): AsyncIterable<CompletionEvent> {
    yield { type: 'refusal', model: 'strict-model' }
  },
}

async function drain(it: AsyncIterable<CompletionEvent>) {
  const out: CompletionEvent[] = []
  for await (const e of it) out.push(e)
  return out
}

test('a PIVOTAL refusal with no output falls back to EVERYDAY', async () => {
  const gw = new LlmGateway({ EVERYDAY: new ScriptedProvider('fine.'), PIVOTAL: refusing })
  const events = await drain(gw.stream('PIVOTAL', { system: '', messages: [] }))
  assert.equal(events.filter((e) => e.type === 'refusal').length, 0)
  assert.equal(events.map((e) => (e.type === 'delta' ? e.text : '')).join(''), 'fine.')
})

test('an EVERYDAY refusal is surfaced, there is nothing cheaper to try', async () => {
  const gw = new LlmGateway({ EVERYDAY: refusing, PIVOTAL: new ScriptedProvider('x') })
  const events = await drain(gw.stream('EVERYDAY', { system: '', messages: [] }))
  assert.deepEqual(events, [{ type: 'refusal', model: 'strict-model' }])
})
