import {
  relationshipSatisfies,
  toMomentCard,
  type Moment,
  type MomentCard,
  type MomentUnlockSource,
} from '@odyssey/shared'
import type { AppRepository, RelationshipRecord } from '../repo/types.js'

export interface UnlockEvaluation {
  cards: MomentCard[]
  /** Cards whose unlock record was created by this call. */
  newlyUnlocked: MomentCard[]
}

/**
 * Earned unlocks (FREE, STAGE, AFFINITY) are recorded the first time the
 * relationship qualifies, so unlockedAt is stable and the same call can announce
 * them. PURCHASE unlocks when the user's purchases carry the moment's SKU; the
 * purchase itself is written by the billing reconcile, never here. This is the
 * only place unlock records are created.
 */
export async function evaluateUnlocks(
  repo: AppRepository,
  moments: Moment[],
  relationship: RelationshipRecord | null,
  purchasedSkus: ReadonlySet<string> = new Set()
): Promise<UnlockEvaluation> {
  if (!relationship) return { cards: moments.map((m) => toMomentCard(m, null)), newlyUnlocked: [] }
  const unlocks = new Map((await repo.listUnlocks(relationship.id)).map((u) => [u.momentId, u]))
  const cards: MomentCard[] = []
  const newlyUnlocked: MomentCard[] = []
  for (const moment of moments) {
    let unlock = unlocks.get(moment.id) ?? null
    let fresh = false
    const bought = moment.unlock.kind === 'PURCHASE' && purchasedSkus.has(moment.unlock.sku)
    if (!unlock && (bought || relationshipSatisfies(moment.unlock, relationship))) {
      unlock = await repo.insertUnlock({
        relationshipId: relationship.id,
        momentId: moment.id,
        source: moment.unlock.kind as MomentUnlockSource,
      })
      fresh = true
    }
    const card = toMomentCard(moment, unlock)
    cards.push(card)
    if (fresh) newlyUnlocked.push(card)
  }
  return { cards, newlyUnlocked }
}
