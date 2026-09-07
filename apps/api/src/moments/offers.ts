import type { Moment, MomentUnlock } from '@odyssey/shared'

/**
 * When he sends a photo in the conversation (ARCHITECTURE.md section 14).
 *
 * The photo is a locked PURCHASE moment he has not sent before, and one that has
 * art: a card without a teaser has nothing to show under the blur, so it waits.
 * The card arrives with the teaser and no asset; unlocking it is the purchase. Cadence is product
 * copy, not engineering: one offer per conversation per UTC day, and not before
 * the conversation has some warmth in it that day.
 */
export const OFFER_AFTER_MESSAGES_TODAY = 3

export interface OfferSignals {
  /** USER messages today across the account, including the current one. */
  sentToday: number
  /** The relationship advanced a stage on this message; that alone earns an offer. */
  stageChanged: boolean
  now: Date
}

export function pickOffer(
  moments: Moment[],
  unlocks: Pick<MomentUnlock, 'momentId'>[],
  offered: Array<{ momentId: string; createdAt: string }>,
  signals: OfferSignals
): Moment | null {
  if (!signals.stageChanged && signals.sentToday < OFFER_AFTER_MESSAGES_TODAY) return null
  const day = signals.now.toISOString().slice(0, 10)
  if (offered.some((o) => o.createdAt.slice(0, 10) === day)) return null
  const unlocked = new Set(unlocks.map((u) => u.momentId))
  const sent = new Set(offered.map((o) => o.momentId))
  return (
    [...moments]
      .sort((a, b) => a.position - b.position)
      .find((m) => m.unlock.kind === 'PURCHASE' && !!m.teaserUrl && !unlocked.has(m.id) && !sent.has(m.id)) ?? null
  )
}
