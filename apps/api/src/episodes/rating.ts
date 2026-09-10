import type { Channel, ContentRating } from '@odyssey/shared'

/**
 * The rating rail (docs/story-pipeline.md, step 6). SFW ships everywhere;
 * MATURE exists only on the web build, and only for someone who has passed the
 * age gate. Two gates, deliberately of different kinds:
 *
 *  - The **channel** is a client assertion, so it is not a security boundary.
 *    It is a distribution boundary: the store binary is compiled to say
 *    `store`, and an absent header is read as `store`, because the wrong
 *    default here is a delisting rather than an inconvenience.
 *  - The **age gate** is server-side (`users.ageVerifiedAt`) and is the one
 *    that matters legally. ARCHITECTURE section 11 still owes real assurance;
 *    a typed date of birth is a declaration, not a check.
 *
 * Both must pass. Nothing else in the codebase decides who sees MATURE.
 */
export function visibleRatings(channel: Channel, ageVerified: boolean): ContentRating[] {
  return channel === 'web' && ageVerified ? ['SFW', 'MATURE'] : ['SFW']
}

export function canSee(rating: ContentRating, channel: Channel, ageVerified: boolean): boolean {
  return visibleRatings(channel, ageVerified).includes(rating)
}

/** Minimum age for MATURE. */
export const ADULT_AGE = 18

/** Whole years between a date of birth and now. Returns null when the date is not a real one. */
export function ageOn(bornOn: string, now = new Date()): number | null {
  const born = new Date(`${bornOn}T00:00:00Z`)
  if (Number.isNaN(born.getTime())) return null
  if (born > now) return null
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const monthDiff = now.getUTCMonth() - born.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age--
  return age
}
