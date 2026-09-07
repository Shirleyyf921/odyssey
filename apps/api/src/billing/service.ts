import {
  ENTITLEMENTS,
  TIER_BY_ENTITLEMENT,
  TIER_ORDER,
  type BillingStatus,
  type EntitlementId,
  type Store,
  type Tier,
} from '@odyssey/shared'
import type { AppRepository, BillingEnvironment, SubscriptionRecord } from '../repo/types.js'
import type { RcSubscriber, RevenueCatClient } from './revenuecat.js'

interface Log {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

const STORE_BY_RC: Record<string, Store> = {
  app_store: 'APP_STORE',
  play_store: 'PLAY_STORE',
  stripe: 'STRIPE',
  promotional: 'PROMOTIONAL',
  amazon: 'AMAZON',
  mac_app_store: 'MAC_APP_STORE',
}

const KNOWN_ENTITLEMENTS = new Set<string>(Object.values(ENTITLEMENTS))

function storeOf(rc: string): Store {
  return STORE_BY_RC[rc] ?? 'UNKNOWN'
}

function envOf(isSandbox: boolean): BillingEnvironment {
  return isSandbox ? 'SANDBOX' : 'PRODUCTION'
}

function date(s: string | null | undefined): Date | null {
  return s ? new Date(s) : null
}

/**
 * Paid state. The only writer of `subscriptions` and `purchases`, and the only
 * reader the rest of the app goes through.
 *
 * Design: every signal (webhook, restore, sign-in) ends in `reconcile`, which
 * re-reads the subscriber from RevenueCat and overwrites our copy. Webhook
 * payloads are never trusted as state, only as a nudge to re-read, so ordering
 * and duplicate delivery cannot corrupt anything.
 *
 * The RevenueCat app_user_id is our user id: the client configures the SDK with
 * it and never lets an anonymous RevenueCat id exist. When a guest signs in and
 * the client logs the SDK into the account id, RevenueCat transfers the guest's
 * receipts and sends a TRANSFER event for the account; mergeUsers has already
 * moved the rows by then, so the reconcile is a no-op in the common case.
 */
export class BillingService {
  constructor(
    private readonly repo: AppRepository,
    private readonly rc: RevenueCatClient | null,
    private readonly log: Log
  ) {}

  get enabled(): boolean {
    return this.rc !== null
  }

  /** Re-read one subscriber and write the rows. Unknown users are logged and skipped, not created. */
  async reconcile(appUserId: string): Promise<BillingStatus | null> {
    if (!this.rc) return null
    const user = await this.repo.getUser(appUserId)
    if (!user) {
      // A guest id that has since merged into an account, or a sandbox id from another build.
      this.log.warn({ appUserId }, 'billing: RevenueCat app_user_id is not a user; skipped')
      return null
    }
    const subscriber = await this.rc.getSubscriber(appUserId)
    await this.write(user.id, appUserId, subscriber)
    const status = await this.status(user.id)
    this.log.info({ userId: user.id, tier: status.tier, purchases: status.purchasedSkus.length }, 'billing: reconciled')
    return status
  }

  private async write(userId: string, appUserId: string, s: RcSubscriber) {
    for (const [entitlement, e] of Object.entries(s.entitlements)) {
      if (!KNOWN_ENTITLEMENTS.has(entitlement)) {
        this.log.warn({ entitlement }, 'billing: unknown entitlement in RevenueCat; ignored')
        continue
      }
      const sub = s.subscriptions[e.product_identifier]
      const record: SubscriptionRecord = {
        userId,
        entitlement,
        productId: e.product_identifier,
        store: storeOf(sub?.store ?? 'promotional'),
        environment: envOf(sub?.is_sandbox ?? false),
        purchasedAt: new Date(e.purchase_date),
        // Grace period keeps the entitlement alive while the store retries the card.
        expiresAt: date(e.grace_period_expires_date) ?? date(e.expires_date),
        unsubscribedAt: date(sub?.unsubscribe_detected_at),
        billingIssueAt: date(sub?.billing_issues_detected_at),
        rcAppUserId: appUserId,
      }
      await this.repo.upsertSubscription(record)
    }
    for (const [productId, list] of Object.entries(s.non_subscriptions)) {
      for (const p of list) {
        await this.repo.upsertPurchase({
          userId,
          productId,
          store: storeOf(p.store),
          environment: envOf(p.is_sandbox),
          storeTransactionId: p.store_transaction_id ?? p.id,
          purchasedAt: new Date(p.purchase_date),
          refundedAt: date(p.refunded_at),
          rcAppUserId: appUserId,
        })
      }
    }
  }

  /** What the client is told. Derived from the rows; nothing here calls RevenueCat. */
  async status(userId: string, now = new Date()): Promise<BillingStatus> {
    const [subs, purchases] = await Promise.all([this.repo.listSubscriptions(userId), this.repo.listPurchases(userId)])
    let tier: Tier = 'FREE'
    let best: SubscriptionRecord | null = null
    for (const sub of subs) {
      if (sub.expiresAt && sub.expiresAt <= now) continue
      const t = TIER_BY_ENTITLEMENT[sub.entitlement as EntitlementId]
      if (!t) continue
      if (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(tier)) {
        tier = t
        best = sub
      }
    }
    return {
      tier,
      expiresAt: best?.expiresAt?.toISOString() ?? null,
      willRenew: best ? best.unsubscribedAt === null && best.expiresAt !== null : false,
      purchasedSkus: [...new Set(purchases.filter((p) => !p.refundedAt).map((p) => p.productId))].sort(),
      enabled: this.enabled,
    }
  }

  /**
   * Manual grant, for dogfooding and support. Written as a PROMOTIONAL subscription
   * so it is visible as such in the table and in status(). A later reconcile only
   * overwrites it if RevenueCat also holds that entitlement. FREE ends every
   * promotional grant the user holds.
   */
  async grant(userId: string, tier: Tier, days: number, now = new Date()): Promise<BillingStatus> {
    const held = await this.repo.listSubscriptions(userId)
    if (tier === 'FREE') {
      for (const sub of held) {
        if (sub.store === 'PROMOTIONAL' && (!sub.expiresAt || sub.expiresAt > now)) {
          await this.repo.upsertSubscription({ ...sub, expiresAt: now })
        }
      }
    } else {
      const entitlement = tier === 'PLUS' ? ENTITLEMENTS.PLUS : ENTITLEMENTS.PREMIUM
      await this.repo.upsertSubscription({
        userId,
        entitlement,
        productId: `grant_${entitlement}`,
        store: 'PROMOTIONAL',
        environment: 'SANDBOX',
        purchasedAt: now,
        expiresAt: new Date(now.getTime() + days * 86_400_000),
        unsubscribedAt: now,
        billingIssueAt: null,
        rcAppUserId: userId,
      })
    }
    const status = await this.status(userId, now)
    this.log.info({ userId, tier: status.tier, days }, 'billing: manual grant')
    return status
  }

  /** The tier alone, for the chat path. */
  async tierOf(userId: string, now = new Date()): Promise<Tier> {
    return (await this.status(userId, now)).tier
  }

  /** SKUs that may unlock PURCHASE moments. Refunded purchases are excluded. */
  async purchasedSkus(userId: string): Promise<Set<string>> {
    const purchases = await this.repo.listPurchases(userId)
    return new Set(purchases.filter((p) => !p.refundedAt).map((p) => p.productId))
  }
}
