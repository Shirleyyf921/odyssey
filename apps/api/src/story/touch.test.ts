import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_CHARACTERS } from '../content/seed.js'
import { HOTSPOT_MIN_STAGE, TOUCH_PHRASE, allowedHotspots } from './touch.js'

const beat = { hotspots: ['hand', 'shoulder', 'hair', 'face'] as const }

test('a stage opens hotspots in order and never more than the beat allows', () => {
  assert.deepEqual(allowedHotspots({ hotspots: [...beat.hotspots] }, 'STRANGER'), ['hand'])
  assert.deepEqual(allowedHotspots({ hotspots: [...beat.hotspots] }, 'ACQUAINTED'), ['hand', 'shoulder'])
  assert.deepEqual(allowedHotspots({ hotspots: [...beat.hotspots] }, 'INTIMATE'), ['hand', 'shoulder', 'hair', 'face'])
  assert.deepEqual(allowedHotspots({ hotspots: ['hand'] }, 'INTIMATE'), ['hand'], 'the beat is the ceiling')
  assert.deepEqual(allowedHotspots({ hotspots: [] }, 'INTIMATE'), [])
})

test("every hotspot has a stage and a phrase, and the phrases are the server's own words", () => {
  for (const h of ['hand', 'shoulder', 'hair', 'face'] as const) {
    assert.ok(HOTSPOT_MIN_STAGE[h])
    assert.ok(TOUCH_PHRASE[h].length > 0)
  }
  assert.equal(TOUCH_PHRASE.hand, 'reaches out and takes his hand')
})

test('the seeded heroes carry a hotspot map inside the frame', () => {
  for (const seed of SEED_CHARACTERS) {
    const hero = seed.portraits[0]
    assert.ok(hero?.hotspots?.length, `${seed.character.name}: hero has a map`)
    for (const r of hero.hotspots!) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1, `${seed.character.name}/${r.hotspot} stays inside the portrait`)
    }
  }
})
