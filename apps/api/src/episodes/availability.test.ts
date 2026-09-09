import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { EpisodeRun, EpisodeUnlockRule } from '@odyssey/shared'
import { SEED_CHARACTERS } from '../content/seed.js'
import type { EpisodeRecord } from '../repo/types.js'
import { availability, toEpisodeCard } from './availability.js'

const elliot = SEED_CHARACTERS[0]!
const ep1 = elliot.episodes[0]!

function episode(id: string, unlock: EpisodeUnlockRule, position = 1): EpisodeRecord {
  return { ...ep1, id, position, title: `ep ${position}`, unlock, beats: ep1.beats }
}

function run(episodeId: string, ended: boolean, currentBeatId = ep1.beats[2]!.id): EpisodeRun {
  return {
    id: randomUUID(),
    relationshipId: randomUUID(),
    episodeId,
    currentBeatId,
    path: [ep1.firstBeatId, currentBeatId],
    startedAt: new Date().toISOString(),
    endedAt: ended ? new Date().toISOString() : null,
  }
}

test('the seeded episode is well formed: first beat exists, every next resolves, END has no options', () => {
  for (const seed of SEED_CHARACTERS) {
    for (const e of seed.episodes) {
      const ids = new Set(e.beats.map((b) => b.id))
      assert.ok(ids.has(e.firstBeatId), `${e.title}: firstBeatId`)
      for (const b of e.beats) {
        assert.equal(b.episodeId, e.id)
        if (b.next) assert.ok(ids.has(b.next), `${e.title}/${b.position}: next`)
        for (const o of b.options) if (o.next) assert.ok(ids.has(o.next), `${e.title}/${b.position}: option next`)
        if (b.kind === 'END') {
          assert.equal(b.options.length, 0)
          assert.equal(b.next, null)
        }
        if (b.kind === 'STORY') assert.equal(b.options.length, 2, 'a STORY beat has two authored options; free text is the third')
        if (b.photoMomentId) assert.ok(seed.moments.some((m) => m.id === b.photoMomentId), `${e.title}/${b.position}: photo exists`)
      }
      assert.ok(e.beats.some((b) => b.kind === 'END'), `${e.title}: has an ending`)
    }
  }
  assert.equal(elliot.episodes.length, 1)
})

test('FREE is available without a relationship; a run makes it in progress or done', () => {
  const all = [ep1]
  assert.equal(availability(ep1, null, 'FREE', [], all).status, 'AVAILABLE')
  assert.equal(availability(ep1, null, 'FREE', [run(ep1.id, false)], all).status, 'IN_PROGRESS')
  assert.equal(availability(ep1, null, 'FREE', [run(ep1.id, true)], all).status, 'DONE')
  const card = toEpisodeCard(ep1, null, 'FREE', [run(ep1.id, false)], all)
  assert.equal(card.currentBeat, 3)
  assert.equal(card.beatCount, 5)
  assert.ok(!('beats' in card) && !('opener' in card), 'briefs and beats never reach the client')
})

test('STAGE, PLUS and EPISODE gates say what to do, never a number', () => {
  const ep2 = episode(randomUUID(), { kind: 'STAGE', stage: 'CLOSE' }, 1)
  const ep3 = episode(randomUUID(), { kind: 'PLUS' }, 2)
  const ep4 = episode(randomUUID(), { kind: 'EPISODE', episodeId: ep1.id }, 3)
  const all = [ep1, ep2, ep3, ep4]

  const stranger = availability(ep2, { stage: 'ACQUAINTED' }, 'FREE', [], all)
  assert.equal(stranger.status, 'LOCKED')
  assert.ok(stranger.lockReason && !/\d/.test(stranger.lockReason))
  assert.equal(availability(ep2, { stage: 'CLOSE' }, 'FREE', [], all).status, 'AVAILABLE')

  assert.equal(availability(ep3, { stage: 'CLOSE' }, 'FREE', [], all).status, 'LOCKED')
  assert.equal(availability(ep3, { stage: 'CLOSE' }, 'PLUS', [], all).status, 'AVAILABLE')

  const gated = availability(ep4, { stage: 'CLOSE' }, 'FREE', [], all)
  assert.equal(gated.status, 'LOCKED')
  assert.ok(gated.lockReason?.includes(ep1.title))
  assert.equal(availability(ep4, { stage: 'CLOSE' }, 'FREE', [run(ep1.id, true)], all).status, 'AVAILABLE')
})
