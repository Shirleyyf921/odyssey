import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULES, applyFacts, applyUserMessage, evaluateStage, type ProgressState } from './rules.js'

const fresh = (): ProgressState => ({
  stage: 'STRANGER',
  affinity: 0,
  activeDays: 0,
  lastActiveDate: null,
  messageGainsToday: 0,
  factGainsToday: 0,
})

test('the first message ever counts a day and a message, but no return bonus', () => {
  const { next, events } = applyUserMessage(fresh(), '2026-09-02')
  assert.equal(next.activeDays, 1)
  assert.equal(next.affinity, RULES.perMessage)
  assert.deepEqual(events.map((e) => e.reason), ['message'])
})

test('message gains stop at the daily cap', () => {
  let state = fresh()
  for (let i = 0; i < 50; i++) state = applyUserMessage(state, '2026-09-02').next
  assert.equal(state.affinity, RULES.dailyMessageGains * RULES.perMessage)
  assert.equal(state.activeDays, 1)
})

test('coming back on a new day pays the return bonus and resets the counters', () => {
  let state = applyUserMessage(fresh(), '2026-09-02').next
  const { next, events } = applyUserMessage(state, '2026-09-03')
  assert.equal(next.activeDays, 2)
  assert.deepEqual(events.map((e) => e.reason), ['return', 'message'])
  assert.equal(next.affinity, RULES.perMessage + RULES.returnBonus + RULES.perMessage)
  assert.equal(next.messageGainsToday, 1)
})

test('facts are worth more than messages and also cap per day', () => {
  const { next } = applyFacts({ ...fresh(), lastActiveDate: '2026-09-02', activeDays: 1 }, 100, '2026-09-02')
  assert.equal(next.affinity, RULES.dailyFactGains * RULES.perFact)
  assert.equal(next.factGainsToday, RULES.dailyFactGains)
})

test('stages need both affinity and calendar days', () => {
  assert.equal(evaluateStage({ ...fresh(), affinity: 100, activeDays: 1 }), 'STRANGER')
  assert.equal(evaluateStage({ ...fresh(), affinity: 14, activeDays: 30 }), 'STRANGER')
  assert.equal(evaluateStage({ ...fresh(), affinity: 15, activeDays: 2 }), 'ACQUAINTED')
  assert.equal(evaluateStage({ ...fresh(), affinity: 100, activeDays: 7 }), 'CLOSE')
  assert.equal(evaluateStage({ ...fresh(), affinity: 80, activeDays: 21 }), 'INTIMATE')
})

test('stages never regress', () => {
  assert.equal(evaluateStage({ ...fresh(), stage: 'CLOSE', affinity: 0, activeDays: 0 }), 'CLOSE')
})

test('a full day-by-day run reaches CLOSE around the second week', () => {
  let state = fresh()
  let reached: number | null = null
  for (let day = 1; day <= 30; day++) {
    const key = `2026-09-${String(day).padStart(2, '0')}`
    for (let m = 0; m < 6; m++) state = applyUserMessage(state, key).next
    state = applyFacts(state, 1, key).next
    if (state.stage === 'CLOSE' && reached === null) reached = day
  }
  assert.ok(reached !== null && reached >= 7 && reached <= 14, `reached CLOSE on day ${reached}`)
  assert.equal(state.affinity, 100, 'a month of steady talking saturates affinity')
})
