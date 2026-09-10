import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { CharacterDetail, CharactersResponse, EpisodesResponse, MeResponse, MomentsResponse, StartRelationshipResponse, TonightResponse } from '@odyssey/shared'
import { requireIdentity } from '../auth/identity.js'
import { devVerifier } from '../auth/providers.js'
import { AuthService } from '../auth/service.js'
import { BillingService } from '../billing/service.js'
import { authRoutes } from './auth.js'
import { MemoryRepository } from '../repo/memory.js'
import { characterRoutes } from './characters.js'

const silent = { info() {}, warn() {} }

async function build(devTools = false) {
  const repo = new MemoryRepository()
  const app = Fastify()
  // authRoutes comes along for /me/age, which the rating rail reads.
  await app.register(authRoutes, {
    repo,
    auth: new AuthService(repo, [devVerifier()], silent),
    billing: new BillingService(repo, null, silent),
  })
  await app.register(async (scoped) => {
    requireIdentity(scoped, repo)
    await scoped.register(characterRoutes, { repo, devTools })
  })
  await app.ready()
  return { app, repo }
}

test('requests without a device id are refused', async () => {
  const { app } = await build()
  const res = await app.inject({ method: 'GET', url: '/characters' })
  assert.equal(res.statusCode, 401)
})

test('the roster lists every character with no relationship for a new device', async () => {
  const { app } = await build()
  const res = await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': randomUUID() } })
  assert.equal(res.statusCode, 200)
  const body = CharactersResponse.parse(res.json())
  assert.equal(body.characters.length, 3)
  assert.ok(body.characters.every((c) => c.relationship === null))
  assert.ok(!('personaNotes' in body.characters[0]!), 'persona notes never leave the server')
})

test('start is idempotent and gives PRIMARY characters a DEEP relationship', async () => {
  const { app } = await build()
  const device = randomUUID()
  const roster = CharactersResponse.parse(
    (await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json()
  )
  const primary = roster.characters.find((c) => c.kind === 'PRIMARY')!

  const first = StartRelationshipResponse.parse(
    (await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })).json()
  )
  const second = StartRelationshipResponse.parse(
    (await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })).json()
  )
  assert.equal(first.relationship.id, second.relationship.id)
  assert.equal(first.relationship.depth, 'DEEP')

  const detail = CharacterDetail.parse(
    (await app.inject({ method: 'GET', url: `/characters/${primary.id}`, headers: { 'x-device-id': device } })).json()
  )
  assert.equal(detail.relationship?.conversationId, first.relationship.conversationId)
  assert.equal(detail.momentCount, 8)
})

test('moments: FREE unlocks on first read, the rest stay locked without the asset URL', async () => {
  const { app } = await build()
  const device = randomUUID()
  const roster = CharactersResponse.parse(
    (await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json()
  )
  const primary = roster.characters.find((c) => c.kind === 'PRIMARY')!

  const before = MomentsResponse.parse(
    (await app.inject({ method: 'GET', url: `/characters/${primary.id}/moments`, headers: { 'x-device-id': device } })).json()
  )
  assert.ok(before.moments.every((m) => m.status === 'LOCKED'), 'nothing unlocks without a relationship')

  await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })
  const after = MomentsResponse.parse(
    (await app.inject({ method: 'GET', url: `/characters/${primary.id}/moments`, headers: { 'x-device-id': device } })).json()
  )
  const free = after.moments.find((m) => m.unlock.kind === 'FREE')!
  assert.equal(free.status, 'UNLOCKED')
  assert.ok(free.imageUrl)
  for (const m of after.moments.filter((m) => m.unlock.kind !== 'FREE')) {
    assert.equal(m.status, 'LOCKED')
    assert.equal(m.imageUrl, null)
    assert.equal(m.caption, null)
  }
})

test('a different device cannot see another device\'s relationship', async () => {
  const { app } = await build()
  const a = randomUUID()
  const b = randomUUID()
  const roster = CharactersResponse.parse(
    (await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': a } })).json()
  )
  const primary = roster.characters[0]!
  await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': a } })
  const detail = CharacterDetail.parse(
    (await app.inject({ method: 'GET', url: `/characters/${primary.id}`, headers: { 'x-device-id': b } })).json()
  )
  assert.equal(detail.relationship, null)
})

test('the dev stage override exists only when enabled, and satisfies the stage gates', async () => {
  const prod = await build(false)
  const device = randomUUID()
  const roster = CharactersResponse.parse(
    (await prod.app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json()
  )
  const primary = roster.characters[0]!
  const missing = await prod.app.inject({
    method: 'POST', url: `/characters/${primary.id}/dev/stage`, headers: { 'x-device-id': device }, payload: { stage: 'CLOSE' },
  })
  assert.equal(missing.statusCode, 404)

  const dev = await build(true)
  await dev.app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })
  const res = await dev.app.inject({
    method: 'POST', url: `/characters/${primary.id}/dev/stage`, headers: { 'x-device-id': device }, payload: { stage: 'CLOSE' },
  })
  assert.equal(res.statusCode, 200)
  const body = StartRelationshipResponse.parse(res.json())
  assert.equal(body.relationship.stage, 'CLOSE')
  assert.ok(body.relationship.affinity >= 45)

  const moments = MomentsResponse.parse(
    (await dev.app.inject({ method: 'GET', url: `/characters/${primary.id}/moments`, headers: { 'x-device-id': device } })).json()
  )
  const sunday = moments.moments.find((m) => m.unlock.kind === 'STAGE' && m.unlock.stage === 'CLOSE')!
  assert.equal(sunday.status, 'UNLOCKED', 'forcing the stage unlocks what it earns')
})

test('starting a relationship opens in the first scene with his opener as the first message', async () => {
  const { app, repo } = await build()
  const device = randomUUID()
  const roster = CharactersResponse.parse((await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json())
  const primary = roster.characters.find((c) => c.kind === 'PRIMARY')!

  const detail = CharacterDetail.parse((await app.inject({ method: 'GET', url: `/characters/${primary.id}`, headers: { 'x-device-id': device } })).json())
  assert.ok(detail.scenes.length >= 1, 'scenes ship with the character')

  const started = StartRelationshipResponse.parse(
    (await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })).json()
  )
  assert.equal(started.relationship.sceneId, detail.scenes[0]!.id)

  const history = await repo.listRecentMessages(started.relationship.conversationId, 5)
  assert.equal(history.length, 1)
  assert.equal(history[0]?.role, 'CHARACTER')
  assert.equal(history[0]?.content, detail.scenes[0]!.opener)

  const ctx = await repo.getConversationContext(started.relationship.conversationId)
  assert.equal(ctx?.conversation.scene?.id, detail.scenes[0]!.id)

  // Idempotent: a second start neither creates a second opener nor moves the scene.
  await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })
  assert.equal((await repo.listRecentMessages(started.relationship.conversationId, 5)).length, 1)
})

test('episodes: cards only, status follows the run, briefs stay on the server', async () => {
  const { app, repo } = await build()
  const device = randomUUID()
  const roster = CharactersResponse.parse((await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json())
  const primary = roster.characters.find((c) => c.kind === 'PRIMARY')!

  const before = EpisodesResponse.parse((await app.inject({ method: 'GET', url: `/characters/${primary.id}/episodes`, headers: { 'x-device-id': device } })).json())
  assert.equal(before.relationship, null)
  assert.equal(before.episodes.length, 1)
  assert.equal(before.episodes[0]!.status, 'AVAILABLE')
  const raw = (await app.inject({ method: 'GET', url: `/characters/${primary.id}/episodes`, headers: { 'x-device-id': device } })).body
  assert.ok(!raw.includes('brief'), 'the brief is not in the payload')

  const started = StartRelationshipResponse.parse((await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })).json())
  const [episode] = await repo.listEpisodes(primary.id)
  await repo.createRun({ relationshipId: started.relationship.id, episodeId: episode!.id, currentBeatId: episode!.firstBeatId })
  const during = EpisodesResponse.parse((await app.inject({ method: 'GET', url: `/characters/${primary.id}/episodes`, headers: { 'x-device-id': device } })).json())
  assert.equal(during.episodes[0]!.status, 'IN_PROGRESS')
  assert.equal(during.episodes[0]!.currentBeat, 1)

  // Every character has at least one episode now; an explore character's is his own, not the primary's.
  const explore = roster.characters.find((c) => c.kind === 'EXPLORE')!
  const theirs = EpisodesResponse.parse((await app.inject({ method: 'GET', url: `/characters/${explore.id}/episodes`, headers: { 'x-device-id': device } })).json())
  assert.ok(theirs.episodes.length >= 1)
  assert.ok(theirs.episodes.every((e) => e.characterId === explore.id))
  assert.ok(!theirs.episodes.some((e) => e.title === 'Four minutes'))
})

test('tonight gives one card per character, the open one for the primary and nothing for the others', async () => {
  const { app, repo } = await build()
  const device = randomUUID()
  const before = TonightResponse.parse((await app.inject({ method: 'GET', url: '/tonight', headers: { 'x-device-id': device } })).json())
  assert.equal(before.items.length, 3)
  const primaryItem = before.items.find((i) => i.character.kind === 'PRIMARY')!
  assert.equal(primaryItem.episode?.title, 'Four minutes')
  assert.equal(primaryItem.episode?.status, 'AVAILABLE')
  assert.ok(before.items.every((i) => i.episode !== null), 'every man has something open tonight')
  assert.ok(
    before.items.every((i) => i.episode!.characterId === i.character.id),
    "and it is his own, not someone else's"
  )
  assert.ok(!(await app.inject({ method: 'GET', url: '/tonight', headers: { 'x-device-id': device } })).body.includes('brief'))

  const started = StartRelationshipResponse.parse((await app.inject({ method: 'POST', url: `/characters/${primaryItem.character.id}/start`, headers: { 'x-device-id': device } })).json())
  const [episode] = await repo.listEpisodes(primaryItem.character.id)
  await repo.createRun({ relationshipId: started.relationship.id, episodeId: episode!.id, currentBeatId: episode!.firstBeatId })
  const during = TonightResponse.parse((await app.inject({ method: 'GET', url: '/tonight', headers: { 'x-device-id': device } })).json())
  const now = during.items.find((i) => i.character.kind === 'PRIMARY')!
  assert.equal(now.episode?.status, 'IN_PROGRESS')
  assert.equal(now.episode?.currentBeat, 1)
  assert.ok(now.character.relationship, 'the card carries the relationship for the client to route with')
})

test('the rating rail: a store build never sees MATURE, and the web build only after the age gate', async () => {
  const { app, repo } = await build()
  const device = randomUUID()
  const primary = (await repo.listCharacters()).find((c) => c.kind === 'PRIMARY')!
  const url = `/characters/${primary.id}/episodes`
  const titles = async (headers: Record<string, string>) =>
    EpisodesResponse.parse((await app.inject({ method: 'GET', url, headers })).json()).episodes.map((e) => e.title)

  const asDevice = { 'x-device-id': device }
  const asWeb = { ...asDevice, 'x-odyssey-channel': 'web' }
  const all = (await repo.listEpisodes(primary.id)).map((e) => e.title)
  assert.equal(all.length, 2, 'the seed has one of each rating')

  assert.deepEqual(await titles(asDevice), [all[0]], 'no channel header is read as store')
  assert.deepEqual(await titles({ ...asDevice, 'x-odyssey-channel': 'store' }), [all[0]])
  assert.deepEqual(await titles(asWeb), [all[0]], 'the web build still needs the age gate')

  const under = await app.inject({ method: 'POST', url: '/me/age', headers: asWeb, payload: { bornOn: '2015-01-01' } })
  assert.equal(under.statusCode, 403)
  assert.deepEqual(await titles(asWeb), [all[0]], 'a refused declaration changes nothing')

  const ok = await app.inject({ method: 'POST', url: '/me/age', headers: asWeb, payload: { bornOn: '1992-01-05' } })
  assert.equal(ok.statusCode, 200)
  assert.equal(MeResponse.parse(ok.json()).user.ageVerified, true)
  assert.deepEqual(await titles(asWeb), all, 'web plus age sees both')
  assert.deepEqual(await titles(asDevice), [all[0]], 'the store build is unaffected by the same user being verified')

  const tonight = TonightResponse.parse((await app.inject({ method: 'GET', url: '/tonight', headers: asDevice })).json())
  assert.equal(tonight.items.find((i) => i.character.kind === 'PRIMARY')?.episode?.title, all[0], 'tonight rides the same rail')
})
