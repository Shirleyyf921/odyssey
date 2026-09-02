import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relationshipSatisfies, toMomentCard } from './moments.js'
import { MomentCard, type Moment } from './domain.js'

const moment: Moment = {
  id: '11111111-1111-4111-8111-111111111111',
  characterId: '22222222-2222-4222-8222-222222222222',
  title: 'Late shift',
  caption: 'Thought of you on the walk home.',
  imageUrl: 'https://cdn.example.com/m/late-shift.jpg',
  position: 0,
  unlock: { kind: 'STAGE', stage: 'CLOSE' },
}

test('a locked card carries neither the image nor the caption', () => {
  const card = toMomentCard(moment, null)
  assert.equal(card.status, 'LOCKED')
  assert.equal(card.imageUrl, null)
  assert.equal(card.caption, null)
  assert.equal(card.unlockedAt, null)
  assert.ok(MomentCard.safeParse(card).success)
})

test('an unlocked card reveals the asset', () => {
  const card = toMomentCard(moment, { unlockedAt: '2026-09-02T00:00:00.000Z' })
  assert.equal(card.status, 'UNLOCKED')
  assert.equal(card.imageUrl, moment.imageUrl)
  assert.equal(card.caption, moment.caption)
  assert.ok(MomentCard.safeParse(card).success)
})

test('stage rules compare by order, affinity by threshold, purchase never by state', () => {
  const rel = { stage: 'CLOSE' as const, affinity: 40 }
  assert.equal(relationshipSatisfies({ kind: 'FREE' }, rel), true)
  assert.equal(relationshipSatisfies({ kind: 'STAGE', stage: 'ACQUAINTED' }, rel), true)
  assert.equal(relationshipSatisfies({ kind: 'STAGE', stage: 'INTIMATE' }, rel), false)
  assert.equal(relationshipSatisfies({ kind: 'AFFINITY', min: 40 }, rel), true)
  assert.equal(relationshipSatisfies({ kind: 'AFFINITY', min: 41 }, rel), false)
  assert.equal(relationshipSatisfies({ kind: 'PURCHASE', sku: 'moment_pack_1' }, rel), false)
})
