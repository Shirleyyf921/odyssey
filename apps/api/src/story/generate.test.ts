import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { generateStoryTurn } from './generate.js'

const REQ: CompletionRequest = { system: 'sys', messages: [{ role: 'user', content: 'hi' }] }
const silent = { warn() {} }

/** A provider that answers the first request with `first`, and any later one (the repair) with `then`. */
function scripted(first: string, then = '') {
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return requests.length === 1 ? first : then
  })
  return { gateway: new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider }), requests }
}

test('a complete output streams narration and line, and needs no repair', async () => {
  const { gateway, requests } = scripted(`[narration]\nThe lamp.\n[line]\n*looks up* you found it.\n[options]\nA. sit\nB. go`)
  const seen: string[] = []
  const r = await generateStoryTurn(gateway, 'EVERYDAY', REQ, { expectOptions: true, onEvent: (e) => seen.push(e.section), log: silent })
  assert.deepEqual(r.turn.options, ['sit', 'go'])
  assert.equal(r.repaired, false)
  assert.equal(requests.length, 1)
  assert.ok(seen.includes('narration') && seen.includes('line') && !seen.includes('options'))
  assert.ok(r.raw.startsWith('[narration]') && r.raw.includes('[line]') && !r.raw.includes('[options]'), 'stored text carries no options')
})

test('missing options on a STORY beat are repaired with one small follow-up on EVERYDAY', async () => {
  const { gateway, requests } = scripted(`[narration]\nThe lamp.\n[line]\n*looks up* hey.`, `[options]\nA. sit by him\nB. stay put`)
  const r = await generateStoryTurn(gateway, 'PIVOTAL', REQ, { expectOptions: true, log: silent })
  assert.deepEqual(r.turn.options, ['sit by him', 'stay put'])
  assert.equal(r.repaired, true)
  assert.equal(requests.length, 2)
  const repair = requests[1]!
  assert.equal(repair.messages.at(-2)?.role, 'assistant', 'the repair continues from what was written')
  assert.ok(repair.messages.at(-1)?.content.includes('[options]'))
  assert.equal(repair.maxTokens, 120)
})

test('when the repair also fails the turn still goes out, line intact', async () => {
  const { gateway } = scripted(`*looks up* hey.`, `I cannot do that.`)
  const r = await generateStoryTurn(gateway, 'EVERYDAY', REQ, { expectOptions: true, log: silent })
  assert.equal(r.turn.line, '*looks up* hey.')
  assert.deepEqual(r.turn.options, [])
  assert.equal(r.repaired, false)
})

test('an END beat drops options and never repairs', async () => {
  const { gateway, requests } = scripted(`[line]\n*at the door* next time, take the second staircase.\n[options]\nA. x\nB. y`)
  const r = await generateStoryTurn(gateway, 'EVERYDAY', REQ, { expectOptions: false, log: silent })
  assert.deepEqual(r.turn.options, [])
  assert.equal(requests.length, 1)
})
