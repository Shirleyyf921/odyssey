import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryRepository } from '../repo/memory.js'
import { HashEmbeddings } from './embeddings.js'
import { MemoryService, parseFacts } from './service.js'

const silent = { info() {}, error() {} }

/** Answers extraction prompts with facts and summary prompts with a summary. */
function brain(req: CompletionRequest): string {
  if (req.system.startsWith('Extract durable facts')) {
    const line = req.system.split('\n').find((l) => l.startsWith('the user:')) ?? ''
    if (line.includes('sister')) return '[{"fact":"The user has a sister named Mia who lives in Leeds.","confidence":0.9}]'
    if (line.includes('cello')) return 'Sure: [{"fact":"The user plays the cello on Thursdays.","confidence":0.8}]'
    return '[]'
  }
  if (req.system.startsWith('You maintain the running summary')) return 'They talked about family and music.'
  return 'ok'
}

async function setup() {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const provider = new ScriptedProvider(brain)
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider })
  const memory = new MemoryService(repo, gateway, new HashEmbeddings(128), silent, { shortTermTurns: 4, summaryBatch: 2 })
  const ctx = (await repo.getConversationContext(demo.conversationId))!
  return { repo, memory, ctx, demo }
}

async function turn(repo: MemoryRepository, conversationId: string, user: string, reply: string) {
  const u = await repo.insertMessage({ conversationId, role: 'USER', content: user, clientMsgId: null, inReplyTo: null })
  const r = await repo.insertMessage({ conversationId, role: 'CHARACTER', content: reply, clientMsgId: null, inReplyTo: u.id })
  return { u, r }
}

test('facts are extracted after a turn and retrieved by similarity on the next', async () => {
  const { repo, memory, ctx, demo } = await setup()
  const a = await turn(repo, demo.conversationId, 'my sister Mia moved to Leeds', 'How is she finding it?')
  memory.afterTurn(ctx, a.u, a.r)
  const b = await turn(repo, demo.conversationId, 'I play cello on thursdays', 'I would like to hear that.')
  memory.afterTurn(ctx, b.u, b.r)
  await memory.drain()

  const stored = await repo.listMemories(ctx.relationship.id, 10)
  assert.equal(stored.length, 2)

  const assembled = await memory.assemble(ctx, 'how is my sister doing in leeds')
  assert.equal(assembled.memories[0], 'The user has a sister named Mia who lives in Leeds.')
})

test('LIGHT relationships skip long-term memory entirely', async () => {
  const { repo, memory, ctx, demo } = await setup()
  const light = { ...ctx, relationship: { ...ctx.relationship, depth: 'LIGHT' as const } }
  const a = await turn(repo, demo.conversationId, 'my sister Mia moved to Leeds', 'How is she finding it?')
  memory.afterTurn(light, a.u, a.r)
  await memory.drain()
  assert.equal((await repo.listMemories(ctx.relationship.id, 10)).length, 0)
  assert.deepEqual((await memory.assemble(light, 'sister')).memories, [])
})

test('older turns fold into the rolling summary and leave the short-term window', async () => {
  const { repo, memory, ctx, demo } = await setup()
  // shortTermTurns 4 + summaryBatch 2 = fold once 6 messages exist.
  let last: Awaited<ReturnType<typeof turn>> | null = null
  for (let i = 0; i < 3; i++) last = await turn(repo, demo.conversationId, `u${i}`, `c${i}`)
  memory.afterTurn(ctx, last!.u, last!.r)
  await memory.drain()

  const summary = await repo.getSummary(demo.conversationId)
  assert.equal(summary.text, 'They talked about family and music.')
  const assembled = await memory.assemble(ctx, 'x')
  assert.deepEqual(assembled.history.map((m) => m.content), ['u1', 'c1', 'u2', 'c2'])
  assert.equal(assembled.summary, summary.text)
})

test('parseFacts tolerates prose and drops malformed entries', () => {
  const facts = parseFacts('Here you go: [{"fact":"A","confidence":0.7},{"nope":1},{"fact":"B"}] thanks')
  assert.deepEqual(facts, [
    { fact: 'A', confidence: 0.7 },
    { fact: 'B', confidence: 0.5 },
  ])
  assert.deepEqual(parseFacts('no json here'), [])
})
