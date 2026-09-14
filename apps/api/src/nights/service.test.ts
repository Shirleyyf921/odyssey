import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tier } from '@odyssey/shared'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryRepository } from '../repo/memory.js'
import type { ScreenReport, ScreenUnit } from '../safety/episode-screen.js'
import { NightRefused, NightService } from './service.js'

const silent = { info() {}, warn() {}, error() {} }
const DRAFT = JSON.stringify({
  title: 'The roof nobody knows',
  setting: 'A roof he has a key to, past midnight.',
  opener: '*holds the door* nobody knows this one. now you do.',
  beats: [0, 1, 2, 3].map((position) => ({ position, brief: `Beat ${position}: he shows her the city and says one true thing.`, options: ['Go along with it', 'Hold back'] })).concat([{ position: 4, brief: 'It closes on his line.', options: [] }]),
})

function screener(worst: ScreenReport['worst'] = 'CLEAN', rating: ScreenReport['rating'] = 'SFW') {
  const seen: ScreenUnit[][] = []
  return {
    seen,
    async screen(units: ScreenUnit[]): Promise<ScreenReport> {
      seen.push(units)
      return { units: units.map((u) => ({ ...u, label: 'CLEAN' as const, source: 'model' as const })), worst, rating }
    },
  }
}

async function setup(tier: Tier = 'PLUS', reply = DRAFT, screen = screener()) {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return reply
  })
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider })
  const nights = new NightService({ repo, gateway, screener: screen, billing: { async tierOf() { return tier } }, log: silent })
  const user = (await repo.getUser(demo.userId))!
  return { repo, demo, requests, nights, user, screen }
}

test('Plus asks in one line: five beats straight through, screened, PRIVATE, hers alone, once a night', async () => {
  const { repo, demo, requests, nights, user, screen } = await setup('PLUS')
  const card = await nights.ask(user, 'store', { characterId: demo.characterId, wish: 'Take me somewhere nobody knows about.', heat: 'SFW' })
  assert.equal(card.title, 'The roof nobody knows')
  assert.equal(card.private, true)
  assert.equal(card.status, 'AVAILABLE')
  assert.equal(card.beatCount, 5)
  assert.ok(requests[0]!.system.includes('Take me somewhere nobody knows about.'), 'her line is the premise')
  assert.equal(screen.seen[0]![0]!.at, 'wish', 'her line is screened too')

  const stored = (await repo.getEpisode(card.id))!
  assert.equal(stored.status, 'PRIVATE')
  assert.equal(stored.authorId, demo.userId)
  assert.equal(stored.origin, 'UGC')
  assert.ok(!(await repo.listEpisodes(demo.characterId)).some((e) => e.id === card.id), 'no shelf lists it')
  assert.ok(!(await repo.listEpisodesForReview()).some((e) => e.id === card.id), 'no reviewer sees it')

  await assert.rejects(nights.ask(user, 'store', { characterId: demo.characterId, wish: 'Again.', heat: 'SFW' }), (err: unknown) => err instanceof NightRefused && err.code === 'USED_TODAY')
})

test('Free is the paywall; the MATURE kind needs the web build, the age gate, Plus and CLOSE', async () => {
  const free = await setup('FREE')
  await assert.rejects(free.nights.ask(free.user, 'web', { characterId: free.demo.characterId, wish: 'Anything.', heat: 'SFW' }), (err: unknown) => err instanceof NightRefused && err.code === 'NEEDS_PLUS')

  const { repo, demo, nights, user } = await setup('PLUS')
  // Demo relationships start ACQUAINTED and the user has not declared an age.
  await assert.rejects(nights.ask(user, 'web', { characterId: demo.characterId, wish: "Don't ask me anything tonight.", heat: 'MATURE' }), (err: unknown) => err instanceof NightRefused && err.code === 'LEVEL')
  await repo.updateUser(user.id, { ageVerifiedAt: new Date() })
  await repo.updateRelationship(demo.relationshipId, { stage: 'CLOSE' })
  const verified = (await repo.getUser(user.id))!
  await assert.rejects(nights.ask(verified, 'store', { characterId: demo.characterId, wish: "Don't ask me anything tonight.", heat: 'MATURE' }), (err: unknown) => err instanceof NightRefused && err.code === 'LEVEL', 'never on the store build')
  const card = await nights.ask(verified, 'web', { characterId: demo.characterId, wish: "Don't ask me anything tonight.", heat: 'MATURE' })
  assert.equal(card.rating, 'MATURE')
})

test('what the screen blocks is refused; what reads MATURE without the level is refused too', async () => {
  const blocked = await setup('PLUS', DRAFT, screener('BLOCK'))
  await assert.rejects(blocked.nights.ask(blocked.user, 'web', { characterId: blocked.demo.characterId, wish: 'Something he must not.', heat: 'SFW' }), (err: unknown) => err instanceof NightRefused && err.code === 'REFUSED')
  assert.equal((await blocked.repo.listEpisodesByAuthor(blocked.demo.userId)).length, 0, 'nothing kept')

  const hot = await setup('PLUS', DRAFT, screener('CLEAN', 'MATURE'))
  await assert.rejects(hot.nights.ask(hot.user, 'store', { characterId: hot.demo.characterId, wish: 'Just a walk.', heat: 'SFW' }), (err: unknown) => err instanceof NightRefused && err.code === 'LEVEL')
})

test('when he cannot write one, nothing is spent and nothing is kept', async () => {
  const { repo, demo, nights, user } = await setup('PLUS', 'I would rather not.')
  await assert.rejects(nights.ask(user, 'web', { characterId: demo.characterId, wish: 'A walk.', heat: 'SFW' }), (err: unknown) => err instanceof NightRefused && err.code === 'UNAVAILABLE')
  assert.equal(await repo.countPrivateEpisodesSince(demo.userId, new Date(0)), 0)
})
