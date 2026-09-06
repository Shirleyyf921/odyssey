import type { Tier } from '@odyssey/shared'

/**
 * What a tier buys, from the table in ARCHITECTURE.md section 7. Product rules,
 * kept in one place so the numbers can be tuned without touching the chat path.
 */
export interface TierRules {
  /** Hard daily cap on user messages across every relationship. Null is unmetered. */
  dailyMessages: number | null
  /** Past this many messages in a day, pivotal routing is suspended. Invisible to the user. */
  softCeiling: number | null
  /** Whether long-term memory is retrieved for the reply. Extraction always runs. */
  longTermMemory: boolean
  /** Memories retrieved per turn. */
  retrieveK: number
  /** Whether a pivotal moment may route to the strong model. */
  pivotal: boolean
}

/** A new relationship runs with all four memory layers for this long, on every tier. */
export const NEW_RELATIONSHIP_GRACE_DAYS = 7

const BY_TIER: Record<Tier, TierRules> = {
  FREE: { dailyMessages: 30, softCeiling: null, longTermMemory: false, retrieveK: 6, pivotal: false },
  PLUS: { dailyMessages: null, softCeiling: 200, longTermMemory: true, retrieveK: 6, pivotal: true },
  PREMIUM: { dailyMessages: null, softCeiling: 400, longTermMemory: true, retrieveK: 12, pivotal: true },
}

/**
 * Rules for one turn. The grace window is per relationship: the free tier must
 * demonstrate the moat before it asks for money, so he remembers everything for
 * the first week and only then stops bringing things up.
 */
export function rulesFor(tier: Tier, relationship: { startedAt: string }, now = new Date()): TierRules {
  const base = BY_TIER[tier]
  if (base.longTermMemory) return base
  const ageMs = now.getTime() - new Date(relationship.startedAt).getTime()
  const inGrace = ageMs < NEW_RELATIONSHIP_GRACE_DAYS * 86_400_000
  return inGrace ? { ...base, longTermMemory: true } : base
}

/** Start of the current UTC day; the day boundary the relationship rules already use. */
export function utcDayStart(now = new Date()): Date {
  const d = new Date(now)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Copy, not persona: sent as an error so the client renders it outside his voice. */
export const DAILY_CAP_MESSAGE = "He's turned in for the night. He'll be here tomorrow, or keep talking with Plus."

/**
 * The one place the free cap surfaces in character: his last message of the
 * day closes the conversation instead of ending it. Never names a limit.
 */
export const LAST_MESSAGE_DIRECTIVE =
  'This is the last thing you get to say tonight. Bring it to a close in your own way: you have somewhere to be, or you want them to sleep. Make it clear you will be here tomorrow. Do not mention limits, time, plans, or anything outside the two of you.'
