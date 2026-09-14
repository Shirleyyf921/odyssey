import { Platform } from 'react-native'
import { STAGE_ORDER, type RelationshipStage } from '@odyssey/shared'

/**
 * The client's copy of the four levels (apps/api/src/levels.ts): the web build,
 * the age declaration, the plan, and CLOSE or past. It decides what to show;
 * the server decides what to give.
 */
export function canMature(me: { user: { ageVerified: boolean }; billing: { tier: string } } | undefined, stage: RelationshipStage | null | undefined): boolean {
  if (Platform.OS !== 'web' || !me || !me.user.ageVerified || me.billing.tier === 'FREE' || !stage) return false
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf('CLOSE')
}
