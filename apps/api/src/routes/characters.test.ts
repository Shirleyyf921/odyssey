import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { CharacterDetail, CharactersResponse, MomentsResponse, StartRelationshipResponse } from '@odyssey/shared'
import { requireIdentity } from '../auth/identity.js'
import { MemoryRepository } from '../repo/memory.js'
import { characterRoutes } from './characters.js'

async function build() {
  const repo = new MemoryRepository()
  const app = Fastify()
  await app.register(async (scoped) => {
    requireIdentity(scoped, repo)
    await scoped.register(characterRoutes, { repo })
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
  assert.equal(detail.momentCount, 5)
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
