import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { ServerEvent } from '@odyssey/shared'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import { MemoryRepository } from '../repo/memory.js'
import { NoopCrisisDetector, type CrisisDetector } from '../safety/crisis.js'
import { handleClientEvent, type ChatDeps } from './handler.js'

const silent = { info() {}, error() {} }

function setup(opts: { crisis?: CrisisDetector; reply?: string } = {}) {
  const repo = new MemoryRepository()
  const { conversationId } = repo.seedDemo()
  const provider = new ScriptedProvider(opts.reply ?? 'Hey, you. Long day?')
  const deps: ChatDeps = {
    repo,
    gateway: new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider }),
    crisis: opts.crisis ?? new NoopCrisisDetector(),
    log: silent,
  }
  const sent: ServerEvent[] = []
  const send = (e: ServerEvent) => void sent.push(e)
  return { repo, deps, conversationId, sent, send }
}

test('send_message streams start, deltas, end and persists both sides', async () => {
  const { repo, deps, conversationId, sent, send } = setup()
  const clientMsgId = randomUUID()
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId, content: 'hi' }, send)

  assert.equal(sent[0]?.type, 'message_start')
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
  const { repo, deps, conversationId, sent, send } = setup()
  const clientMsgId = randomUUID()
  const ev = { type: 'send_message' as const, conversationId, clientMsgId, content: 'hi' }
  await handleClientEvent(deps, ev, send)
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
  const { repo, deps, conversationId, sent, send } = setup({ crisis: always })
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: '...' }, send)

  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.type, 'safety_intervention')
  if (sent[0]?.type !== 'safety_intervention') return
  assert.equal(sent[0].resources[0]?.region, 'US')
  const stored = await repo.listRecentMessages(conversationId, 10)
  assert.deepEqual(stored.map((m) => m.role), ['USER', 'SYSTEM'])
})

test('resume replays everything after the last message the client had', async () => {
  const { deps, conversationId, sent, send } = setup()
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: 'one' }, send)
  const firstEnd = sent.find((e) => e.type === 'message_end')
  assert.ok(firstEnd && firstEnd.type === 'message_end')
  await handleClientEvent(deps, { type: 'send_message', conversationId, clientMsgId: randomUUID(), content: 'two' }, send)
  sent.length = 0

  await handleClientEvent(deps, { type: 'resume', conversationId, lastMessageId: firstEnd.messageId }, send)
  assert.equal(sent[0]?.type, 'history')
  if (sent[0]?.type !== 'history') return
  assert.deepEqual(sent[0].messages.map((m) => m.content), ['two', 'Hey, you. Long day?'])
})

test('an unknown conversation is rejected before anything is stored', async () => {
  const { deps, sent, send } = setup()
  await handleClientEvent(deps, { type: 'send_message', conversationId: randomUUID(), clientMsgId: randomUUID(), content: 'hi' }, send)
  assert.equal(sent[0]?.type, 'error')
})
