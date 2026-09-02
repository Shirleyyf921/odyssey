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
 * them. PURCHASE only ever unlocks through a purchase record, which does not
 * exist yet. This is the only place unlock records are created.
 */
export async function evaluateUnlocks(
  repo: AppRepository,
  moments: Moment[],
  relationship: RelationshipRecord | null
): Promise<UnlockEvaluation> {
  if (!relationship) return { cards: moments.map((m) => toMomentCard(m, null)), newlyUnlocked: [] }
  const unlocks = new Map((await repo.listUnlocks(relationship.id)).map((u) => [u.momentId, u]))
  const cards: MomentCard[] = []
  const newlyUnlocked: MomentCard[] = []
  for (const moment of moments) {
    let unlock = unlocks.get(moment.id) ?? null
    let fresh = false
    if (!unlock && relationshipSatisfies(moment.unlock, relationship)) {
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
