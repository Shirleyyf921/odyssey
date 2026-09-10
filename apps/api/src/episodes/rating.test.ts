import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_CHARACTERS } from '../content/seed.js'
import { ADULT_AGE, ageOn, canSee, visibleRatings } from './rating.js'

test('MATURE needs the web build and the age gate; anything else sees SFW only', () => {
  assert.deepEqual(visibleRatings('web', true), ['SFW', 'MATURE'])
  assert.deepEqual(visibleRatings('web', false), ['SFW'], 'the age gate is the one that matters')
  assert.deepEqual(visibleRatings('store', true), ['SFW'], 'the store build never, however old the user is')
  assert.deepEqual(visibleRatings('store', false), ['SFW'])
  assert.equal(canSee('SFW', 'store', false), true)
  assert.equal(canSee('MATURE', 'store', true), false)
  assert.equal(canSee('MATURE', 'web', true), true)
})

test('ages are whole years and a birthday later this year does not count yet', () => {
  const now = new Date('2026-09-10T00:00:00Z')
  assert.equal(ageOn('2008-09-10', now), ADULT_AGE, 'eighteen today')
  assert.equal(ageOn('2008-09-11', now), 17, 'eighteen tomorrow is seventeen')
  assert.equal(ageOn('2008-12-31', now), 17)
  assert.equal(ageOn('1992-01-05', now), 34)
  assert.equal(ageOn('not-a-date', now), null)
  assert.equal(ageOn('2030-01-01', now), null, 'the future is not an age')
})

test('the seeded MATURE episode is gated behind the SFW one', () => {
  const elliot = SEED_CHARACTERS[0]!
  const mature = elliot.episodes.find((e) => e.rating === 'MATURE')
  assert.ok(mature, 'there is one to hide')
  assert.equal(mature.unlock.kind, 'EPISODE', 'and it is not the first thing anyone sees')
  assert.ok(elliot.episodes.some((e) => e.rating === 'SFW'))
})
