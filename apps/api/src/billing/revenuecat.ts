import { z } from 'zod'
import { fetchWithRetry } from '../llm/http.js'

/**
 * The slice of RevenueCat's v1 `GET /subscribers/{app_user_id}` response we read.
 * Everything else is passed through untouched by `.passthrough()` so a new field
 * on their side never breaks parsing.
 */
const Iso = z.string().datetime({ offset: true })

export const RcStore = z.enum(['app_store', 'play_store', 'stripe', 'promotional', 'amazon', 'mac_app_store'])

export const RcSubscriber = z
  .object({
    original_app_user_id: z.string(),
    entitlements: z.record(
      z
        .object({
          expires_date: Iso.nullable(),
          purchase_date: Iso,
          product_identifier: z.string(),
          grace_period_expires_date: Iso.nullable().optional(),
        })
        .passthrough()
    ),
    subscriptions: z.record(
      z
        .object({
          expires_date: Iso.nullable(),
          purchase_date: Iso,
          store: z.string(),
          is_sandbox: z.boolean(),
          unsubscribe_detected_at: Iso.nullable().optional(),
          billing_issues_detected_at: Iso.nullable().optional(),
        })
        .passthrough()
    ),
    non_subscriptions: z.record(
      z.array(
        z
          .object({
            id: z.string(),
            purchase_date: Iso,
            store: z.string(),
            is_sandbox: z.boolean(),
            store_transaction_id: z.string().optional(),
            refunded_at: Iso.nullable().optional(),
          })
          .passthrough()
      )
    ),
  })
  .passthrough()
export type RcSubscriber = z.infer<typeof RcSubscriber>

/** Webhook envelope. Only the routing fields are typed; the reconcile re-reads the subscriber anyway. */
export const RcWebhook = z
  .object({
    api_version: z.string().optional(),
    event: z
      .object({
        id: z.string(),
        type: z.string(),
        app_user_id: z.string(),
        original_app_user_id: z.string().optional(),
        /** TRANSFER events carry both sides. */
        transferred_from: z.array(z.string()).optional(),
        transferred_to: z.array(z.string()).optional(),
        environment: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
      })
      .passthrough(),
  })
  .passthrough()
export type RcWebhook = z.infer<typeof RcWebhook>

export interface RevenueCatClient {
  /** The subscriber as RevenueCat sees them right now. RevenueCat creates an empty one for an unknown id. */
  getSubscriber(appUserId: string): Promise<RcSubscriber>
}

export class RevenueCatHttpClient implements RevenueCatClient {
  constructor(
    private readonly secretKey: string,
    private readonly baseUrl = 'https://api.revenuecat.com/v1',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async getSubscriber(appUserId: string): Promise<RcSubscriber> {
    const res = await fetchWithRetry(
      `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${this.secretKey}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      },
      this.fetchImpl
    )
    if (!res.ok) throw new Error(`RevenueCat ${res.status} for subscriber ${appUserId}`)
    const json: unknown = await res.json()
    const parsed = z.object({ subscriber: RcSubscriber }).safeParse(json)
    if (!parsed.success) throw new Error(`RevenueCat subscriber response did not parse: ${parsed.error.message}`)
    return parsed.data.subscriber
  }
}
