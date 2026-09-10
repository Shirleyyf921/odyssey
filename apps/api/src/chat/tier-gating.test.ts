import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { ServerEvent, Tier } from '@odyssey/shared'
import { LAST_MESSAGE_DIRECTIVE, NEW_RELATIONSHIP_GRACE_DAYS, rulesFor } from '../billing/rules.js'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryService } from '../memory/service.js'
import { RelationshipService } from '../relationship/service.js'
import { MemoryRepository } from '../repo/memory.js'
import type { RelationshipPatch } from '../repo/types.js'
import { NoopCrisisDetector } from '../safety/crisis.js'
import { handleClientEvent, type ChatDeps } from './handler.js'

const silent = { info() {}, warn() {}, error() {} }
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Two distinguishable providers, and every request captured so prompts can be inspected. */
async function setup(tier: Tier) {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const requests: Array<{ tier: string; req: CompletionRequest }> = []
  const record = (name: string, reply: string) =>
    new ScriptedProvider((req) => {
      requests.push({ tier: name, req })
      return reply
    })
  const gateway = new LlmGateway({ EVERYDAY: record('EVERYDAY', 'everyday reply'), PIVOTAL: record('PIVOTAL', 'pivotal reply') })
  // No embeddings: retrieval falls back to listMemories, so a stored fact is enough to test the gate.
  const memory = new MemoryService(repo, gateway, null, silent)
  const deps: ChatDeps = {
    repo,
    gateway,
    memory,
    relationship: new RelationshipService(repo, silent),
    crisis: new NoopCrisisDetector(),
    channel: 'store',
    billing: { async tierOf() { return tier } },
    user: { id: demo.userId, displayName: null, locale: 'en-US', ageVerifiedAt: null },
    log: silent,
  }
  const sent: ServerEvent[] = []
  const send = (e: ServerEvent) => void sent.push(e)
  const say = (content = 'hi') =>
    handleClientEvent(deps, { type: 'send_message', conversationId: demo.conversationId, clientMsgId: randomUUID(), content }, send)
  const ctx = (await repo.getConversationContext(demo.conversationId))!
  /** Persona requests only: memory extraction and summaries also go through the gateway after each turn. */
  const personaRequests = () => requests.filter((r) => r.req.system.startsWith('You are '))
  return { repo, deps, memory, ctx, sent, send, say, requests: personaRequests, conversationId: demo.conversationId }
}

/** Pretend the user already sent n messages today. */
async function preload(repo: MemoryRepository, conversationId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await repo.insertMessage({ conversationId, role: 'USER', content: `m${i}`, clientMsgId: null, inReplyTo: null })
  }
}

/** Only the tests reach in here: startedAt is not a product-writable field. */
async function ageRelationship(repo: MemoryRepository, id: string, days: number) {
  await repo.updateRelationship(id, { startedAt: daysAgo(days) } as RelationshipPatch)
}

test('rulesFor: free gets the four layers for the first week, paid tiers always', () => {
  const fresh = { startedAt: daysAgo(1) }
  const old = { startedAt: daysAgo(NEW_RELATIONSHIP_GRACE_DAYS + 1) }
  assert.equal(rulesFor('FREE', fresh).longTermMemory, true)
  assert.equal(rulesFor('FREE', old).longTermMemory, false)
  assert.equal(rulesFor('FREE', old).pivotal, false)
  assert.equal(rulesFor('FREE', old).dailyMessages, 15)
  assert.equal(rulesFor('PLUS', old).longTermMemory, true)
  assert.equal(rulesFor('PLUS', old).dailyMessages, null)
  assert.equal(rulesFor('PLUS', old).softCeiling, 200)
  assert.equal(rulesFor('PREMIUM', old).retrieveK, 12)
})

test('free: the 15th message of the day closes the evening in character, the 16th is refused unstored', async () => {
  const { repo, sent, say, requests, conversationId } = await setup('FREE')
  await preload(repo, conversationId, 14)

  await say('one more')
  assert.ok(sent.some((e) => e.type === 'message_end'))
  assert.ok(requests().at(-1)!.req.system.includes(LAST_MESSAGE_DIRECTIVE), 'his last message of the day carries the sign-off directive')
  const storedBefore = (await repo.listRecentMessages(conversationId, 100)).length

  sent.length = 0
  await say('still here?')
  assert.deepEqual(sent.map((e) => e.type), ['error'])
  const err = sent[0]
  if (err?.type !== 'error') return
  assert.equal(err.code, 'QUOTA_EXCEEDED')
  assert.equal((await repo.listRecentMessages(conversationId, 100)).length, storedBefore, 'a refused message leaves no row')
  assert.equal(requests().length, 1, 'and costs no generation')
})

test('plus: no daily cap and no sign-off directive', async () => {
  const { repo, sent, say, requests, conversationId } = await setup('PLUS')
  await preload(repo, conversationId, 40)
  await say()
  assert.ok(sent.some((e) => e.type === 'message_end'))
  assert.ok(!requests()[0]!.req.system.includes(LAST_MESSAGE_DIRECTIVE))
})

test('a stage change routes to PIVOTAL on plus, EVERYDAY on free, and EVERYDAY past the plus ceiling', async () => {
  const nearClose = { affinity: 44, activeDays: 7, lastActiveDate: '2000-01-01' }

  const plus = await setup('PLUS')
  await plus.repo.updateRelationship(plus.ctx.relationship.id, nearClose)
  await plus.say()
  assert.equal((await plus.repo.getConversationContext(plus.conversationId))!.relationship.stage, 'CLOSE')
  assert.equal(plus.requests()[0]!.tier, 'PIVOTAL')

  const free = await setup('FREE')
  await free.repo.updateRelationship(free.ctx.relationship.id, nearClose)
  await free.say()
  assert.equal((await free.repo.getConversationContext(free.conversationId))!.relationship.stage, 'CLOSE')
  assert.equal(free.requests()[0]!.tier, 'EVERYDAY', 'free never pays for the strong model')

  const heavy = await setup('PLUS')
  await heavy.repo.updateRelationship(heavy.ctx.relationship.id, nearClose)
  await preload(heavy.repo, heavy.conversationId, 200)
  await heavy.say()
  assert.equal((await heavy.repo.getConversationContext(heavy.conversationId))!.relationship.stage, 'CLOSE')
  assert.equal(heavy.requests()[0]!.tier, 'EVERYDAY', 'past the soft ceiling the strong model is suspended')
  assert.ok(heavy.sent.some((e) => e.type === 'message_end'), 'but the conversation is not interrupted')
})

test('long-term memory: free recalls during the first week, then stops; plus always recalls', async () => {
  const fact = 'they keep a cactus named Gerald on the windowsill'
  const cases: Array<{ tier: Tier; ageDays: number; recalls: boolean }> = [
    { tier: 'FREE', ageDays: 2, recalls: true },
    { tier: 'FREE', ageDays: NEW_RELATIONSHIP_GRACE_DAYS + 3, recalls: false },
    { tier: 'PLUS', ageDays: NEW_RELATIONSHIP_GRACE_DAYS + 3, recalls: true },
  ]
  for (const c of cases) {
    const t = await setup(c.tier)
    await t.repo.insertMemories([{ relationshipId: t.ctx.relationship.id, fact, embedding: null, confidence: 1 }])
    await ageRelationship(t.repo, t.ctx.relationship.id, c.ageDays)
    await t.say('morning')
    await t.memory.drain()
    const system = t.requests()[0]!.req.system
    assert.equal(system.includes(fact), c.recalls, `${c.tier} at ${c.ageDays} days: recalls=${c.recalls}`)
  }
})

test('after three messages he sends a locked photo: teaser only, and it stays in history', async () => {
  const { repo, sent, say, conversationId } = await setup('PLUS')
  await say('one')
  await say('two')
  assert.ok(!sent.some((e) => e.type === 'moment_offer'), 'too early')
  await say('three')
  const offer = sent.find((e) => e.type === 'moment_offer')
  assert.ok(offer && offer.type === 'moment_offer')
  assert.equal(offer.moment.status, 'LOCKED')
  assert.equal(offer.moment.imageUrl, null, 'the asset never leaves the server while locked')
  assert.ok(offer.moment.teaserUrl?.startsWith('data:image/jpeg'), 'the teaser does')
  assert.equal(offer.moment.unlock.kind, 'PURCHASE')
  assert.equal(offer.message.momentId, offer.moment.id)
  assert.equal(offer.message.role, 'CHARACTER')

  const history = await repo.listRecentMessages(conversationId, 50)
  assert.ok(history.some((m) => m.momentId === offer.moment.id), 'the photo is a real message')

  sent.length = 0
  await say('four')
  assert.ok(!sent.some((e) => e.type === 'moment_offer'), 'one a day')
})
