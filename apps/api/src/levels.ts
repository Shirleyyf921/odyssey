import { STAGE_ORDER, type Channel, type ContentRating, type RelationshipStage, type Tier } from '@odyssey/shared'

/**
 * The four levels (2026-09-14, the boss's "分级放资源"): what a reader may be
 * given of the hotter kind depends on the build (the store build never), her
 * age declaration, her plan, and how close he is to her. One rule, used by
 * the nights she asks for and the pictures she asks for. The client keeps a
 * copy to decide what to show; the server decides what to give.
 */
export const MATURE_STAGE: RelationshipStage = 'CLOSE'

export function levelFor(input: { channel: Channel; ageVerified: boolean; tier: Tier; stage: RelationshipStage | null }): ContentRating {
  const closeEnough = input.stage !== null && STAGE_ORDER.indexOf(input.stage) >= STAGE_ORDER.indexOf(MATURE_STAGE)
  return input.channel === 'web' && input.ageVerified && input.tier !== 'FREE' && closeEnough ? 'MATURE' : 'SFW'
}
