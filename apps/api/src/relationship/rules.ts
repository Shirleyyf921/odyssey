import { STAGE_ORDER, type RelationshipStage } from '@odyssey/shared'
import type { RelationshipProgress } from '../repo/types.js'

/**
 * Relationship progression. Deterministic, no model call, every number in one
 * place. See ARCHITECTURE.md section 15 for why each rule is shaped the way it is.
 *
 * Design constraints, in order:
 *   1. Cannot be ground: daily caps on every source of affinity.
 *   2. Cannot be rushed: stages need calendar days, not just points.
 *   3. Does not punish absence: no decay, no streak loss.
 *   4. Rewards sharing over volume: facts are worth more than messages.
 */
export const RULES = {
  /** Per user message, up to the daily cap. */
  perMessage: 1,
  dailyMessageGains: 10,
  /** First message of a new day. */
  returnBonus: 3,
  /** Per durable fact the memory layer extracts, up to the daily cap. */
  perFact: 2,
  dailyFactGains: 6,
  maxAffinity: 100,
  /** Both gates must hold. Stages never regress. */
  stages: {
    ACQUAINTED: { affinity: 15, activeDays: 2 },
    CLOSE: { affinity: 45, activeDays: 7 },
    INTIMATE: { affinity: 80, activeDays: 21 },
  } satisfies Record<Exclude<RelationshipStage, 'STRANGER'>, { affinity: number; activeDays: number }>,
} as const

export interface ProgressState extends RelationshipProgress {
  stage: RelationshipStage
  affinity: number
}

export interface AffinityEvent {
  delta: number
  reason: 'message' | 'return' | 'fact'
}

export interface ProgressResult {
  next: ProgressState
  events: AffinityEvent[]
  previousStage: RelationshipStage | null
}

/** UTC calendar day. Good enough until users carry a timezone. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Roll daily counters when the day changed. Pure; returns a copy. */
function rollDay(state: ProgressState, today: string): { state: ProgressState; newDay: boolean } {
  if (state.lastActiveDate === today) return { state: { ...state }, newDay: false }
  return {
    state: {
      ...state,
      lastActiveDate: today,
      activeDays: state.activeDays + 1,
      messageGainsToday: 0,
      factGainsToday: 0,
    },
    newDay: true,
  }
}

function addAffinity(state: ProgressState, delta: number): number {
  return Math.max(0, Math.min(RULES.maxAffinity, state.affinity + delta))
}

/** Highest stage whose gates hold, never below the current one. */
export function evaluateStage(state: ProgressState): RelationshipStage {
  let best = state.stage
  for (const stage of STAGE_ORDER) {
    if (stage === 'STRANGER') continue
    const gate = RULES.stages[stage]
    const meets = state.affinity >= gate.affinity && state.activeDays >= gate.activeDays
    if (meets && STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(best)) best = stage
  }
  return best
}

/** A user message arrived. Applies message and return gains, then re-evaluates the stage. */
export function applyUserMessage(state: ProgressState, today = dayKey()): ProgressResult {
  const rolled = rollDay(state, today)
  let next = rolled.state
  const events: AffinityEvent[] = []

  if (rolled.newDay && state.lastActiveDate !== null) {
    next = { ...next, affinity: addAffinity(next, RULES.returnBonus) }
    events.push({ delta: RULES.returnBonus, reason: 'return' })
  }
  if (next.messageGainsToday < RULES.dailyMessageGains) {
    next = {
      ...next,
      affinity: addAffinity(next, RULES.perMessage),
      messageGainsToday: next.messageGainsToday + 1,
    }
    events.push({ delta: RULES.perMessage, reason: 'message' })
  }

  const stage = evaluateStage(next)
  const previousStage = stage !== next.stage ? next.stage : null
  return { next: { ...next, stage }, events, previousStage }
}

/**
 * The memory layer stored `count` durable facts from the last turn. Affinity only;
 * the stage is re-evaluated on the next message so the transition can be announced
 * in the conversation rather than in a background job.
 */
export function applyFacts(state: ProgressState, count: number, today = dayKey()): ProgressResult {
  const rolled = rollDay(state, today)
  let next = rolled.state
  const events: AffinityEvent[] = []
  const room = Math.max(0, RULES.dailyFactGains - next.factGainsToday)
  const credited = Math.min(count, room)
  if (credited > 0) {
    const delta = credited * RULES.perFact
    next = { ...next, affinity: addAffinity(next, delta), factGainsToday: next.factGainsToday + credited }
    events.push({ delta, reason: 'fact' })
  }
  return { next, events, previousStage: null }
}
