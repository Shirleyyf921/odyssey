import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryService } from '../memory/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { ReachOutService, dayKey } from './reachout.js'

const silent = { info() {}, warn() {}, error() {} }
const daysAgo = (n: number) => dayKey(new Date(Date.now() - n * 86_400_000))

async function setup() {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return '*puts the mug back where it was* the noodle place downstairs closed for good tonight. thought of you before I thought of dinner.'
  })
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider })
  const memory = new MemoryService(repo, gateway, null, silent)
  const service = new ReachOutService(repo, gateway, memory, silent)
  const rel = () => repo.listRelationships(demo.userId).then((rs) => rs.find((r) => r.id === demo.relationshipId)!)
  return { repo, demo, requests, service, rel }
}

test('due: not today, once a day, never twice unanswered', () => {
  const today = '2026-09-11'
  assert.equal(ReachOutService.due({ lastActiveDate: null, reachedOutOn: null }, today), false, 'never spoke')
  assert.equal(ReachOutService.due({ lastActiveDate: '2026-09-11', reachedOutOn: null }, today), false, 'they wrote today')
  assert.equal(ReachOutService.due({ lastActiveDate: '2026-09-10', reachedOutOn: null }, today), true, 'gone one night')
  assert.equal(ReachOutService.due({ lastActiveDate: '2026-09-10', reachedOutOn: '2026-09-11' }, today), false, 'already today')
  assert.equal(ReachOutService.due({ lastActiveDate: '2026-09-08', reachedOutOn: '2026-09-10' }, today), false, 'he wrote, they never answered: he does not nag')
  assert.equal(ReachOutService.due({ lastActiveDate: '2026-09-10', reachedOutOn: '2026-09-09' }, today), true, 'they answered since; he may write again')
})

test('he writes first, once, with what he remembers and where they left off; it lands in the conversation', async () => {
  const { repo, demo, requests, service, rel } = await setup()
  await repo.updateRelationship(demo.relationshipId, { lastActiveDate: daysAgo(2), activeDays: 3 })
  await repo.insertMemories([{ relationshipId: demo.relationshipId, fact: 'Shirley lives above a noodle place', confidence: 0.9, embedding: null }])
  const [episode] = await repo.listEpisodes(demo.characterId)
  await repo.createRun({ relationshipId: demo.relationshipId, episodeId: episode!.id, currentBeatId: episode!.beats[2]!.id, episodeVersion: 1 })

  const message = await service.maybeReachOut(await rel())
  assert.ok(message)
  assert.equal(message.role, 'CHARACTER')
  assert.match(message.content, /noodle place/)
  const system = requests.at(-1)!.system
  assert.match(system, /not written for 2 nights/)
  assert.match(system, /in the middle of "Four minutes", at beat 3 of 7/)
  assert.match(system, /noodle place/, 'what he remembers is in the prompt')
  assert.equal((await repo.listRecentMessages(demo.conversationId, 1)).at(-1)?.id, message.id, 'it is in the conversation')
  assert.equal((await rel()).reachedOutOn, dayKey())

  assert.equal(await service.maybeReachOut(await rel()), null, 'not twice today')
  assert.equal(requests.length, 1)
})

test('an empty reply sends nothing and leaves the day open', async () => {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  await repo.updateRelationship(demo.relationshipId, { lastActiveDate: daysAgo(1) })
  const provider = new ScriptedProvider('   ')
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider })
  const service = new ReachOutService(repo, gateway, new MemoryService(repo, gateway, null, silent), silent)
  const rel = (await repo.listRelationships(demo.userId))[0]!
  assert.equal(await service.maybeReachOut(rel), null)
  assert.equal((await repo.listRelationships(demo.userId))[0]!.reachedOutOn, null)
})
