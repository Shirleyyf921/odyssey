import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { ServerEvent } from '@odyssey/shared'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import { HashEmbeddings } from '../memory/embeddings.js'
import { MemoryService } from '../memory/service.js'
import { RelationshipService } from '../relationship/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { NoopCrisisDetector, type CrisisDetector } from '../safety/crisis.js'
import { handleClientEvent, type ChatDeps } from './handler.js'

const silent = { info() {}, error() {} }

async function setup(opts: { crisis?: CrisisDetector; reply?: string } = {}) {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const provider = new ScriptedProvider(opts.reply ?? 'Hey, you. Long day?')
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider })
  const memory = new MemoryService(repo, gateway, new HashEmbeddings(64), silent)
  const relationship = new RelationshipService(repo, silent)
  const deps: ChatDeps = {
    repo,
    gateway,
    memory,
    relationship,
    crisis: opts.crisis ?? new NoopCrisisDetector(),
    user: { id: demo.userId, displayName: null, locale: 'en-US' },
    log: silent,
  }
  const sent: ServerEvent[] = []
  const send = (e: ServerEvent) => void sent.push(e)
  return { repo, deps, memory, conversationId: demo.conversationId, sent, send }
}

test('send_message streams start, deltas, end and persists both sides', async () => {
  const { repo, deps, memory, conversationId, sent, send } = await setup()
  const clientMsgId = randomUUID()
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId, content: 'hi' }, send)
  await memory.drain()

  // Progression events precede the reply; everything after message_start is the reply itself.
  const startAt = sent.findIndex((e) => e.type === 'message_start')
  assert.ok(startAt >= 0)
  assert.equal(sent[0]?.type, 'message_ack', 'the user message is acknowledged first')
  if (sent[0]?.type === 'message_ack') assert.equal(sent[0].message.clientMsgId, clientMsgId)
  assert.ok(sent.slice(1, startAt).every((e) => e.type === 'relationship_updated' || e.type === 'moment_unlocked'))
  const update = sent.find((e) => e.type === 'relationship_updated')
  assert.ok(update && update.type === 'relationship_updated' && update.previousStage === null, 'affinity-only updates are announced too')
  assert.equal(update.relationship.affinity, 21, 'seeded 20 plus one message')
  const deltas = sent.filter((e) => e.type === 'message_delta')
  assert.ok(deltas.length > 1, 'reply arrives in more than one delta')
  const end = sent.at(-1)
  assert.equal(end?.type, 'message_end')
  if (end?.type !== 'message_end') return
  assert.equal(end.message.content, 'Hey, you. Long day?')
  assert.equal(end.message.role, 'CHARACTER')

  const stored = await repo.listRecentMessages(conversationId, 10)
  assert.deepEqual(stored.map((m) => m.role), ['USER', 'CHARACTER'])
  assert.equal(stored[1]?.inReplyTo, stored[0]?.id)
  assert.equal(stored[0]?.clientMsgId, clientMsgId)
})

test('a retried clientMsgId replays the original reply instead of generating again', async () => {
  const { repo, deps, memory, conversationId, sent, send } = await setup()
  const clientMsgId = randomUUID()
  const ev = { type: 'send_message' as const, conversationId, clientMsgId, content: 'hi' }
  await handleClientEvent(deps, ev, send)
  await memory.drain()
  sent.length = 0
  await handleClientEvent(deps, ev, send)

  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.type, 'history')
  if (sent[0]?.type !== 'history') return
  assert.deepEqual(sent[0].messages.map((m) => m.role), ['USER', 'CHARACTER'])
  assert.equal((await repo.listRecentMessages(conversationId, 10)).length, 2)
})

test('a crisis verdict short-circuits generation with a scripted intervention', async () => {
  const always: CrisisDetector = { async screen() { return { crisis: true } } }
  const { repo, deps, conversationId, sent, send } = await setup({ crisis: always })
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: '...' }, send)

  assert.deepEqual(sent.map((e) => e.type), ['message_ack', 'safety_intervention'])
  const intervention = sent[1]
  if (intervention?.type !== 'safety_intervention') return
  assert.equal(intervention.resources[0]?.region, 'US')
  const stored = await repo.listRecentMessages(conversationId, 10)
  assert.deepEqual(stored.map((m) => m.role), ['USER', 'SYSTEM'])
})

test('resume replays everything after the last message the client had', async () => {
  const { deps, memory, conversationId, sent, send } = await setup()
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: 'one' }, send)
  const firstEnd = sent.find((e) => e.type === 'message_end')
  assert.ok(firstEnd && firstEnd.type === 'message_end')
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: 'two' }, send)
  await memory.drain()
  sent.length = 0

  await handleClientEvent(deps, { type: 'resume', conversationId, lastMessageId: firstEnd.messageId }, send)
  assert.equal(sent[0]?.type, 'history')
  if (sent[0]?.type !== 'history') return
  assert.deepEqual(sent[0].messages.map((m) => m.content), ['two', 'Hey, you. Long day?'])
})

test('an unknown conversation is rejected before anything is stored', async () => {
  const { deps, sent, send } = await setup()
  await handleClientEvent(deps, { type: 'send_message', conversationId: randomUUID(), clientMsgId: randomUUID(), content: 'hi' }, send)
  assert.equal(sent[0]?.type, 'error')
})

test('a message moves affinity and a qualifying one announces the stage before the reply', async () => {
  const { repo, deps, memory, conversationId, sent, send } = await setup()
  const ctx = (await repo.getConversationContext(conversationId))!
  // seedDemo warms the relationship to ACQUAINTED/20. Put it one message from CLOSE.
  await repo.updateRelationship(ctx.relationship.id, { affinity: 44, activeDays: 7, lastActiveDate: '2000-01-01' })

  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: 'hi' }, send)
  await memory.drain()

  const types = sent.map((e) => e.type)
  assert.equal(types[0], 'message_ack')
  assert.equal(types[1], 'relationship_updated', 'the update precedes message_start')
  const startAt = types.indexOf('message_start')
  const unlocked = sent.slice(2, startAt)
  assert.ok(unlocked.length > 0 && unlocked.every((e) => e.type === 'moment_unlocked'), 'earned moments arrive before the reply')
  assert.ok(
    unlocked.some((e) => e.type === 'moment_unlocked' && e.moment.unlock.kind === 'STAGE' && e.moment.unlock.stage === 'CLOSE'),
    'the CLOSE moment unlocks on the same turn'
  )
  const update = sent[1]
  if (update?.type !== 'relationship_updated') return
  assert.equal(update.previousStage, 'ACQUAINTED')
  assert.equal(update.relationship.stage, 'CLOSE')
  assert.ok(!('userId' in update.relationship), 'server-only fields do not reach the client')
  assert.ok(repo.relationshipEvents.length >= 2, 'return bonus and message gain are both logged')
})

test("someone else's conversation is refused as UNAUTHORIZED", async () => {
  const { deps, conversationId, sent, send } = await setup()
  const stranger: ChatDeps = { ...deps, user: { id: randomUUID(), displayName: null, locale: 'en-US' } }
  await handleClientEvent(stranger, { type: 'resume', conversationId, lastMessageId: null }, send)
  assert.equal(sent[0]?.type, 'error')
  if (sent[0]?.type !== 'error') return
  assert.equal(sent[0].code, 'UNAUTHORIZED')
})
