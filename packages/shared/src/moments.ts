import {
  STAGE_ORDER,
  type Moment,
  type MomentCard,
  type MomentUnlock,
  type MomentUnlockRule,
  type Relationship,
} from './domain.js'

/**
 * Whether a relationship has earned a moment on its own. PURCHASE rules always
 * return false here: they are satisfied by an unlock record, never by state.
 */
export function relationshipSatisfies(
  rule: MomentUnlockRule,
  relationship: Pick<Relationship, 'stage' | 'affinity'>
): boolean {
  switch (rule.kind) {
    case 'FREE':
      return true
    case 'STAGE':
      return STAGE_ORDER.indexOf(relationship.stage) >= STAGE_ORDER.indexOf(rule.stage)
    case 'AFFINITY':
      return relationship.affinity >= rule.min
    case 'PURCHASE':
      return false
  }
}

/**
 * Build the client-facing card. The asset URL and caption are stripped unless an
 * unlock record exists — this is the enforcement point, keep it the only one.
 */
export function toMomentCard(
  moment: Moment,
  unlock: Pick<MomentUnlock, 'unlockedAt'> | null
): MomentCard {
  const base = {
    id: moment.id,
    characterId: moment.characterId,
    title: moment.title,
    position: moment.position,
    unlock: moment.unlock,
  }
  if (!unlock) {
    return { ...base, status: 'LOCKED', imageUrl: null, caption: null, unlockedAt: null }
  }
  return {
    ...base,
    status: 'UNLOCKED',
    imageUrl: moment.imageUrl,
    caption: moment.caption,
    unlockedAt: unlock.unlockedAt,
  }
}
