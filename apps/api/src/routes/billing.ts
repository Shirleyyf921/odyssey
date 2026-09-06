import type { FastifyInstance } from 'fastify'
import type { RestoreResponse } from '@odyssey/shared'
import { timingSafeEqual } from 'node:crypto'
import { RcWebhook } from '../billing/revenuecat.js'
import type { BillingService } from '../billing/service.js'

function secretMatches(header: unknown, secret: string): boolean {
  if (typeof header !== 'string') return false
  const given = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

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

/** Inside requireIdentity: the client asks for its own state to be re-read. */
export async function billingRoutes(app: FastifyInstance, opts: { billing: BillingService }) {
  const { billing } = opts

  app.post('/billing/restore', async (req): Promise<RestoreResponse> => {
    const status = (await billing.reconcile(req.user.id)) ?? (await billing.status(req.user.id))
    return { billing: status }
  })
}
