import type { FastifyInstance } from 'fastify'
import { secretMatches } from '../auth/secret.js'
import { DevGrantRequest, DevPurchaseRequest, GRANT_SECRET_HEADER, type RestoreResponse } from '@odyssey/shared'
import { RcWebhook } from '../billing/revenuecat.js'
import type { BillingService } from '../billing/service.js'

/**
 * Public: the RevenueCat webhook. RevenueCat sends the value configured in its
 * dashboard as the Authorization header; we compare it to REVENUECAT_WEBHOOK_SECRET.
 * The body is only used to learn which app_user_ids to re-read. Always 200 once
 * authenticated, so RevenueCat does not retry an event we chose to skip.
 */
export async function billingWebhookRoutes(
  app: FastifyInstance,
  opts: { billing: BillingService; webhookSecret: string }
) {
  const { billing, webhookSecret } = opts

  app.post('/billing/revenuecat', async (req, reply) => {
    if (!secretMatches(req.headers.authorization, webhookSecret)) return reply.code(401).send({ error: 'bad webhook secret' })
    const parsed = RcWebhook.safeParse(req.body)
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, 'billing: webhook body did not parse')
      return reply.code(400).send({ error: 'unrecognized webhook body' })
    }
    const { event } = parsed.data
    const ids = new Set<string>([event.app_user_id, ...(event.transferred_to ?? []), ...(event.transferred_from ?? [])])
    req.log.info({ eventId: event.id, type: event.type, ids: [...ids] }, 'billing: webhook')
    for (const id of ids) {
      try {
        await billing.reconcile(id)
      } catch (err) {
        // A RevenueCat read failure is worth a retry from their side: fail the whole delivery.
        req.log.error({ err, appUserId: id }, 'billing: reconcile failed')
        return reply.code(502).send({ error: 'reconcile failed' })
      }
    }
    return reply.code(200).send({ ok: true })
  })
}

/**
 * Inside requireIdentity: the client asks for its own state to be re-read, and
 * the dogfood grant.
 *
 * `grant` controls the grant route: `'open'` outside production, a secret string
 * in production (the caller must send it in x-grant-secret), or `null` to leave
 * the route unregistered.
 */
export async function billingRoutes(app: FastifyInstance, opts: { billing: BillingService; grant?: 'open' | string | null }) {
  const { billing, grant = null } = opts

  app.post('/billing/restore', async (req): Promise<RestoreResponse> => {
    const status = (await billing.reconcile(req.user.id)) ?? (await billing.status(req.user.id))
    return { billing: status }
  })

  if (grant !== null) {
    app.post('/billing/dev/grant', async (req, reply): Promise<RestoreResponse | void> => {
      if (grant !== 'open' && !secretMatches(req.headers[GRANT_SECRET_HEADER], grant)) {
        return reply.code(403).send({ error: 'grant secret required' })
      }
      const parsed = DevGrantRequest.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.map((i) => i.message).join('; ') })
      req.log.warn({ userId: req.user.id, tier: parsed.data.tier, days: parsed.data.days }, 'dev: tier granted')
      return { billing: await billing.grant(req.user.id, parsed.data.tier, parsed.data.days) }
    })

    app.post('/billing/dev/purchase', async (req, reply): Promise<RestoreResponse | void> => {
      if (grant !== 'open' && !secretMatches(req.headers[GRANT_SECRET_HEADER], grant)) {
        return reply.code(403).send({ error: 'grant secret required' })
      }
      const parsed = DevPurchaseRequest.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'sku required' })
      req.log.warn({ userId: req.user.id, sku: parsed.data.sku }, 'dev: purchase granted')
      return { billing: await billing.grantPurchase(req.user.id, parsed.data.sku) }
    })
  }
}
