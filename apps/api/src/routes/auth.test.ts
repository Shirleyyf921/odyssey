import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { CharacterDetail, CharactersResponse, MeResponse, SignInResponse } from '@odyssey/shared'
import { requireIdentity } from '../auth/identity.js'
import { devVerifier } from '../auth/providers.js'
import { AuthService } from '../auth/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { authRoutes, publicAuthRoutes } from './auth.js'
import { characterRoutes } from './characters.js'

const silent = { info() {} }

async function build(ttlMs?: number) {
  const repo = new MemoryRepository()
  const auth = new AuthService(repo, [devVerifier()], silent, ttlMs)
  const app = Fastify()
  await app.register(publicAuthRoutes, { repo, auth })
  await app.register(authRoutes, { repo, auth })
  await app.register(async (scoped) => {
    requireIdentity(scoped, repo)
    await scoped.register(characterRoutes, { repo })
  })
  await app.ready()
  return { app, repo }
}

const signIn = (app: Awaited<ReturnType<typeof build>>['app'], subject: string, deviceId?: string, fullName?: string) =>
  app.inject({
    method: 'POST',
    url: '/auth/sign-in',
    headers: deviceId ? { 'x-device-id': deviceId } : {},
    payload: { provider: 'dev', identityToken: subject, ...(fullName ? { fullName } : {}) },
  })

test('a guest who signs in keeps the relationship they started on the device', async () => {
  const { app } = await build()
  const device = randomUUID()
  const roster = CharactersResponse.parse((await app.inject({ method: 'GET', url: '/characters', headers: { 'x-device-id': device } })).json())
  const primary = roster.characters[0]!
  await app.inject({ method: 'POST', url: `/characters/${primary.id}/start`, headers: { 'x-device-id': device } })

  const res = signIn(app, 'shirley', device, 'Shirley F')
  const body = SignInResponse.parse((await res).json())
  assert.equal(body.merged, true)
  assert.equal(body.user.signedIn, true)
  assert.equal(body.user.displayName, 'Shirley F')
  assert.deepEqual(body.user.providers, ['dev'])

  // The bearer token, with no device header at all, sees the same relationship.
  const detail = CharacterDetail.parse(
    (await app.inject({ method: 'GET', url: `/characters/${primary.id}`, headers: { authorization: `Bearer ${body.token}` } })).json()
  )
  assert.ok(detail.relationship, 'relationship survived the promotion')
})

test('signing in to an existing account from a new device merges what does not collide', async () => {
  const { app } = await build()
  const phoneA = randomUUID()
  const first = SignInResponse.parse((await signIn(app, 'shirley', phoneA)).json())
  const roster = CharactersResponse.parse((await app.inject({ method: 'GET', url: '/characters', headers: { authorization: `Bearer ${first.token}` } })).json())
  const [primary, explore] = roster.characters
  await app.inject({ method: 'POST', url: `/characters/${primary!.id}/start`, headers: { authorization: `Bearer ${first.token}` } })

  // Phone B as a guest talks to the primary (collides) and an explore character (does not).
  const phoneB = randomUUID()
  await app.inject({ method: 'POST', url: `/characters/${primary!.id}/start`, headers: { 'x-device-id': phoneB } })
  await app.inject({ method: 'POST', url: `/characters/${explore!.id}/start`, headers: { 'x-device-id': phoneB } })

  const second = SignInResponse.parse((await signIn(app, 'shirley', phoneB)).json())
  assert.equal(second.user.id, first.user.id, 'same account')
  assert.equal(second.merged, true)
  const after = CharactersResponse.parse((await app.inject({ method: 'GET', url: '/characters', headers: { authorization: `Bearer ${second.token}` } })).json())
  assert.ok(after.characters.find((c) => c.id === primary!.id)?.relationship, 'account keeps its own primary')
  assert.ok(after.characters.find((c) => c.id === explore!.id)?.relationship, 'the explore relationship moved over')

  // Phone B's old anonymous identity now resolves to the account too.
  const viaDevice = MeResponse.parse((await app.inject({ method: 'GET', url: '/me', headers: { 'x-device-id': phoneB } })).json())
  assert.equal(viaDevice.user.id, first.user.id)
})

test('sign-out revokes the token and an expired session is a 401, not a guest', async () => {
  const { app } = await build(50)
  const body = SignInResponse.parse((await signIn(app, 'shirley')).json())
  const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${body.token}` } })
  assert.equal(me.statusCode, 200)

  await new Promise((r) => setTimeout(r, 60))
  const expired = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${body.token}`, 'x-device-id': randomUUID() } })
  assert.equal(expired.statusCode, 401)

  const fresh = SignInResponse.parse((await signIn(app, 'shirley')).json())
  const out = await app.inject({ method: 'POST', url: '/auth/sign-out', headers: { authorization: `Bearer ${fresh.token}` } })
  assert.equal(out.statusCode, 204)
  const afterOut = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${fresh.token}` } })
  assert.equal(afterOut.statusCode, 401)
})

test('a bad payload is 400 and an unknown provider is refused', async () => {
  const { app } = await build()
  const bad = await app.inject({ method: 'POST', url: '/auth/sign-in', payload: { provider: 'dev' } })
  assert.equal(bad.statusCode, 400)
  const google = await app.inject({ method: 'POST', url: '/auth/sign-in', payload: { provider: 'google', identityToken: 'x' } })
  assert.equal(google.statusCode, 400)
})
