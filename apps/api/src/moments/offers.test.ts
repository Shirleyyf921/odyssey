import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Moment } from '@odyssey/shared'
import { OFFER_AFTER_MESSAGES_TODAY, pickOffer } from './offers.js'

const m = (id: string, position: number, sku: string | null): Moment => ({
  id,
  characterId: 'c',
  title: id,
  caption: `caption ${id}`,
  imageUrl: 'https://cdn.example.com/x.png',
  teaserUrl: sku ? 'data:image/jpeg;base64,AAAA' : null,
  position,
  unlock: sku ? { kind: 'PURCHASE', sku } : { kind: 'FREE' },
})
const moments = [m('free', 0, null), m('paid-a', 1, 'sku_a'), m('paid-b', 2, 'sku_b'), { ...m('no-art', 3, 'sku_c'), teaserUrl: null }]
const now = new Date('2026-09-07T12:00:00Z')

test('no offer until the conversation has warmed up today, unless a stage changed', () => {
  assert.equal(pickOffer(moments, [], [], { sentToday: OFFER_AFTER_MESSAGES_TODAY - 1, stageChanged: false, now }), null)
  assert.equal(pickOffer(moments, [], [], { sentToday: 1, stageChanged: true, now })?.id, 'paid-a')
  assert.equal(pickOffer(moments, [], [], { sentToday: OFFER_AFTER_MESSAGES_TODAY, stageChanged: false, now })?.id, 'paid-a')
})

test('one offer a day, never a bought or already-sent card, in gallery order', () => {
  const today = { momentId: 'paid-a', createdAt: '2026-09-07T08:00:00Z' }
  const yesterday = { momentId: 'paid-a', createdAt: '2026-09-06T08:00:00Z' }
  assert.equal(pickOffer(moments, [], [today], { sentToday: 9, stageChanged: true, now }), null, 'already offered today')
  assert.equal(pickOffer(moments, [], [yesterday], { sentToday: 9, stageChanged: false, now })?.id, 'paid-b', 'skips the one sent yesterday')
  assert.equal(pickOffer(moments, [{ momentId: 'paid-a' }], [], { sentToday: 9, stageChanged: false, now })?.id, 'paid-b', 'skips a bought one')
  assert.equal(pickOffer(moments, [{ momentId: 'paid-a' }, { momentId: 'paid-b' }], [], { sentToday: 9, stageChanged: false, now }), null, 'nothing left with art to offer')
})
