import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { MeResponse, MomentsResponse, RestoreResponse, SignInResponse } from '@odyssey/shared'
import { requireIdentity } from '../auth/identity.js'
import { devVerifier } from '../auth/providers.js'
import { AuthService } from '../auth/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { authRoutes, publicAuthRoutes } from '../routes/auth.js'
import { billingRoutes, billingWebhookRoutes } from '../routes/billing.js'
import { characterRoutes } from '../routes/characters.js'
import type { RcSubscriber, RevenueCatClient } from './revenuecat.js'
import { BillingService } from './service.js'

const silent = { info() {}, warn() {}, error() {} }
const SECRET = 'webhook-secret-for-tests-0123456789'
const PLUS_PRODUCT = 'odyssey_plus_monthly'
/** The seeded PURCHASE moment (content/seed.ts). */
const MOMENT_SKU = 'moment_elliot_05'

function inDays(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}

function subscriber(overrides: Partial<RcSubscriber> = {}): RcSubscriber {
  return {
    original_app_user_id: 'x',
    entitlements: {},
    subscriptions: {},
    non_subscriptions: {},
    ...overrides,
  }
}

function plusSubscriber(expires: string, extra: Partial<RcSubscriber> = {}): RcSubscriber {
  return subscriber({
    entitlements: { plus: { expires_date: expires, purchase_date: inDays(-1), product_identifier: PLUS_PRODUCT } },
    subscriptions: { [PLUS_PRODUCT]: { expires_date: expires, purchase_date: inDays(-1), store: 'app_store', is_sandbox: true } },
    ...extra,
  })
}

/** A RevenueCat that answers from a map, keyed by app_user_id. */
class FakeRc implements RevenueCatClient {
  calls: string[] = []
  constructor(readonly byUser = new Map<string, RcSubscriber>()) {}
  async getSubscriber(appUserId: string) {
    this.calls.push(appUserId)
    return this.byUser.get(appUserId) ?? subscriber({ original_app_user_id: appUserId })
  }
}

async function build(rc: RevenueCatClient | null = new FakeRc()) {
  const repo = new MemoryRepository()
  const billing = new BillingService(repo, rc, silent)
  const auth = new AuthService(repo, [devVerifier()], silent)
  const app = Fastify()
  await app.register(publicAuthRoutes, { repo, auth })
  await app.register(authRoutes, { repo, auth, billing })
  if (rc) await app.register(billingWebhookRoutes, { billing, webhookSecret: SECRET })
  await app.register(async (scoped) => {
    requireIdentity(scoped, repo)
    await scoped.register(characterRoutes, { repo })
    await scoped.register(billingRoutes, { billing, grant: 'open' })
  })
  await app.ready()
  return { app, repo, billing }
}

const asDevice = (device: string) => ({ 'x-device-id': device })

async function userIdOf(app: Awaited<ReturnType<typeof build>>['app'], device: string) {
  return MeResponse.parse((await app.inject({ method: 'GET', url: '/me', headers: asDevice(device) })).json()).user.id
}

test('without RevenueCat everyone is FREE and billing is reported disabled', async () => {
  const { app } = await build(null)
  const res = await app.inject({ method: 'GET', url: '/me', headers: asDevice(randomUUID()) })
  const body = MeResponse.parse(res.json())
  assert.deepEqual(body.billing, { tier: 'FREE', expiresAt: null, willRenew: false, purchasedSkus: [], enabled: false })
})

test('the webhook refuses a wrong or missing secret and does not call RevenueCat', async () => {
  const rc = new FakeRc()
  const { app } = await build(rc)
  const body = { event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: randomUUID() } }
  assert.equal((await app.inject({ method: 'POST', url: '/billing/revenuecat', payload: body })).statusCode, 401)
  assert.equal(
    (await app.inject({ method: 'POST', url: '/billing/revenuecat', payload: body, headers: { authorization: 'Bearer nope' } })).statusCode,
    401
  )
  assert.deepEqual(rc.calls, [])
})

test('a webhook event re-reads the subscriber and the user becomes PLUS', async () => {
  const rc = new FakeRc()
  const { app } = await build(rc)
  const device = randomUUID()
  const userId = await userIdOf(app, device)
  const expires = inDays(30)
  rc.byUser.set(userId, plusSubscriber(expires))

  const res = await app.inject({
    method: 'POST',
    url: '/billing/revenuecat',
    headers: { authorization: `Bearer ${SECRET}` },
    payload: { event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: userId } },
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(rc.calls, [userId])

  const me = MeResponse.parse((await app.inject({ method: 'GET', url: '/me', headers: asDevice(device) })).json())
  assert.equal(me.billing.tier, 'PLUS')
  assert.equal(me.billing.expiresAt, new Date(expires).toISOString())
  assert.equal(me.billing.willRenew, true)
  assert.equal(me.billing.enabled, true)
})

test('an expired entitlement is FREE, and cancelling shows willRenew false while the term runs', async () => {
  const rc = new FakeRc()
  const { app, billing } = await build(rc)
  const userId = await userIdOf(app, randomUUID())

  rc.byUser.set(userId, plusSubscriber(inDays(-1)))
  await billing.reconcile(userId)
  assert.equal((await billing.status(userId)).tier, 'FREE')

  const expires = inDays(10)
  rc.byUser.set(
    userId,
    plusSubscriber(expires, {
      subscriptions: {
        [PLUS_PRODUCT]: { expires_date: expires, purchase_date: inDays(-20), store: 'app_store', is_sandbox: true, unsubscribe_detected_at: inDays(-1) },
      },
    })
  )
  const status = await billing.reconcile(userId)
  assert.equal(status?.tier, 'PLUS')
  assert.equal(status?.willRenew, false)
})

test('a bought SKU unlocks its moment; a refund stops unlocking new ones', async () => {
  const rc = new FakeRc()
  const { app, billing, repo } = await build(rc)
  const device = randomUUID()
  const userId = await userIdOf(app, device)
  const elliot = (await repo.listCharacters()).find((c) => c.kind === 'PRIMARY')!
  await app.inject({ method: 'POST', url: `/characters/${elliot.id}/start`, headers: asDevice(device) })

  const before = MomentsResponse.parse((await app.inject({ method: 'GET', url: `/characters/${elliot.id}/moments`, headers: asDevice(device) })).json())
  const target = before.moments.find((m) => m.unlock.kind === 'PURCHASE' && m.unlock.sku === MOMENT_SKU)!
  assert.equal(target.status, 'LOCKED')

  rc.byUser.set(
    userId,
    subscriber({
      non_subscriptions: { [MOMENT_SKU]: [{ id: 'txn-1', purchase_date: inDays(0), store: 'app_store', is_sandbox: true }] },
    })
  )
  const restored = RestoreResponse.parse((await app.inject({ method: 'POST', url: '/billing/restore', headers: asDevice(device) })).json())
  assert.deepEqual(restored.billing.purchasedSkus, [MOMENT_SKU])

  const after = MomentsResponse.parse((await app.inject({ method: 'GET', url: `/characters/${elliot.id}/moments`, headers: asDevice(device) })).json())
  const card = after.moments.find((m) => m.id === target.id)!
  assert.equal(card.status, 'UNLOCKED')
  assert.ok(card.imageUrl)
  const unlock = (await repo.listUnlocks(before.relationship!.id)).find((u) => u.momentId === target.id)
  assert.equal(unlock?.source, 'PURCHASE')

  // The same transaction seen again is one row, not two.
  await billing.reconcile(userId)
  assert.equal((await repo.listPurchases(userId)).length, 1)

  rc.byUser.set(
    userId,
    subscriber({
      non_subscriptions: { [MOMENT_SKU]: [{ id: 'txn-1', purchase_date: inDays(0), store: 'app_store', is_sandbox: true, refunded_at: inDays(0) }] },
    })
  )
  const refunded = await billing.reconcile(userId)
  assert.deepEqual(refunded?.purchasedSkus, [])
})

test('paid state follows a guest into an existing account they sign in to', async () => {
  const rc = new FakeRc()
  const { app, billing } = await build(rc)
  const signIn = (device: string) =>
    app.inject({ method: 'POST', url: '/auth/sign-in', headers: asDevice(device), payload: { provider: 'dev', identityToken: 'shirley' } })

  // The account exists from an earlier phone.
  const first = SignInResponse.parse((await signIn(randomUUID())).json())
  const accountId = first.user.id

  // A guest on a new phone buys before signing in.
  const device = randomUUID()
  const guestId = await userIdOf(app, device)
  assert.notEqual(guestId, accountId)
  rc.byUser.set(
    guestId,
    plusSubscriber(inDays(30), {
      non_subscriptions: { [MOMENT_SKU]: [{ id: 'txn-g', purchase_date: inDays(0), store: 'app_store', is_sandbox: true }] },
    })
  )
  await billing.reconcile(guestId)

  const signed = SignInResponse.parse((await signIn(device)).json())
  assert.equal(signed.user.id, accountId)
  assert.equal(signed.merged, true)
  const me = MeResponse.parse((await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${signed.token}` } })).json())
  assert.equal(me.billing.tier, 'PLUS')
  assert.deepEqual(me.billing.purchasedSkus, [MOMENT_SKU])

  // The guest id no longer names a user: a late TRANSFER webhook for it is skipped, not an error.
  const res = await app.inject({
    method: 'POST',
    url: '/billing/revenuecat',
    headers: { authorization: `Bearer ${SECRET}` },
    payload: { event: { id: 'e2', type: 'TRANSFER', app_user_id: accountId, transferred_from: [guestId], transferred_to: [accountId] } },
  })
  assert.equal(res.statusCode, 200)
})

test('an unknown entitlement name is ignored rather than granting a tier', async () => {
  const rc = new FakeRc()
  const { app, billing } = await build(rc)
  const userId = await userIdOf(app, randomUUID())
  rc.byUser.set(
    userId,
    subscriber({ entitlements: { gold: { expires_date: inDays(30), purchase_date: inDays(0), product_identifier: 'gold_monthly' } } })
  )
  const status = await billing.reconcile(userId)
  assert.equal(status?.tier, 'FREE')
})

test('dev grant: open outside production, secret-gated in production, FREE revokes', async () => {
  // Open.
  {
    const { app } = await build(null)
    const device = randomUUID()
    const res = await app.inject({ method: 'POST', url: '/billing/dev/grant', headers: asDevice(device), payload: { tier: 'PLUS' } })
    assert.equal(res.statusCode, 200)
    assert.equal(RestoreResponse.parse(res.json()).billing.tier, 'PLUS')
    const me = MeResponse.parse((await app.inject({ method: 'GET', url: '/me', headers: asDevice(device) })).json())
    assert.equal(me.billing.tier, 'PLUS')
    assert.equal(me.billing.willRenew, false, 'a grant never renews')

    const revoked = await app.inject({ method: 'POST', url: '/billing/dev/grant', headers: asDevice(device), payload: { tier: 'FREE' } })
    assert.equal(RestoreResponse.parse(revoked.json()).billing.tier, 'FREE')
  }
  // Secret-gated.
  {
    const repo = new MemoryRepository()
    const billing = new BillingService(repo, null, silent)
    const app = Fastify()
    await app.register(async (scoped) => {
      requireIdentity(scoped, repo)
      await scoped.register(billingRoutes, { billing, grant: 'grant-secret-for-tests-0123456789' })
    })
    await app.ready()
    const device = randomUUID()
    const denied = await app.inject({ method: 'POST', url: '/billing/dev/grant', headers: asDevice(device), payload: { tier: 'PREMIUM' } })
    assert.equal(denied.statusCode, 403)
    const ok = await app.inject({
      method: 'POST',
      url: '/billing/dev/grant',
      headers: { ...asDevice(device), 'x-grant-secret': 'grant-secret-for-tests-0123456789' },
      payload: { tier: 'PREMIUM', days: 7 },
    })
    assert.equal(RestoreResponse.parse(ok.json()).billing.tier, 'PREMIUM')
  }
  // Unregistered.
  {
    const repo = new MemoryRepository()
    const app = Fastify()
    await app.register(async (scoped) => {
      requireIdentity(scoped, repo)
      await scoped.register(billingRoutes, { billing: new BillingService(repo, null, silent), grant: null })
    })
    await app.ready()
    const res = await app.inject({ method: 'POST', url: '/billing/dev/grant', headers: asDevice(randomUUID()), payload: { tier: 'PLUS' } })
    assert.equal(res.statusCode, 404)
  }
})
