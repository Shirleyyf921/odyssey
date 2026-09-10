import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { episodeIssues, type EpisodeRun, type EpisodeUnlockRule } from '@odyssey/shared'
import { SEED_CHARACTERS } from '../content/seed.js'
import type { EpisodeRecord } from '../repo/types.js'
import { availability, toEpisodeCard, tonight } from './availability.js'

const primary = SEED_CHARACTERS[0]!
const ep1 = primary.episodes[0]!

function episode(id: string, unlock: EpisodeUnlockRule, position = 1): EpisodeRecord {
  return { ...ep1, id, position, title: `ep ${position}`, unlock, beats: ep1.beats }
}

function run(episodeId: string, ended: boolean, currentBeatId = ep1.beats[2]!.id): EpisodeRun {
  return {
    id: randomUUID(),
    relationshipId: randomUUID(),
    episodeId,
    currentBeatId,
    episodeVersion: 1,
    path: [ep1.firstBeatId, currentBeatId],
    startedAt: new Date().toISOString(),
    endedAt: ended ? new Date().toISOString() : null,
  }
}

test('the seeded episode is well formed: first beat exists, every next resolves, END has no options', () => {
  for (const seed of SEED_CHARACTERS) {
    for (const e of seed.episodes) {
      assert.deepEqual(episodeIssues(e), [], `${e.title}: the same rule the author API applies`)
      for (const b of e.beats) {
        assert.equal(b.episodeId, e.id)
        if (b.photoMomentId) assert.ok(seed.moments.some((m) => m.id === b.photoMomentId), `${e.title}/${b.position}: photo exists`)
      }
      assert.deepEqual(
        { authorId: e.authorId, origin: e.origin, status: e.status, version: e.version },
        { authorId: null, origin: 'OFFICIAL', status: 'LIVE', version: 1 },
        `${e.title}: ours, and on the shelf`
      )
    }
  }
  assert.equal(primary.episodes.length, 2, 'one SFW, one MATURE')
})

test('FREE is available without a relationship; a run makes it in progress or done', () => {
  const all = [ep1]
  assert.equal(availability(ep1, null, 'FREE', [], all).status, 'AVAILABLE')
  assert.equal(availability(ep1, null, 'FREE', [run(ep1.id, false)], all).status, 'IN_PROGRESS')
  assert.equal(availability(ep1, null, 'FREE', [run(ep1.id, true)], all).status, 'DONE')
  const card = toEpisodeCard(ep1, null, 'FREE', [run(ep1.id, false)], all)
  assert.equal(card.currentBeat, 3)
  assert.equal(card.beatCount, 7)
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

test('tonight prefers what is open over what is shut, and what is shut over what is played', () => {
  const card = (id: string, position: number, status: 'IN_PROGRESS' | 'AVAILABLE' | 'LOCKED' | 'DONE') =>
    ({ ...toEpisodeCard(episode(id, { kind: 'FREE' }, position), null, 'FREE', [], []), status })

  assert.equal(tonight([]), null, 'a character with no episodes has no card')
  assert.equal(tonight([card('a', 0, 'DONE'), card('b', 1, 'LOCKED')])?.id, 'b', 'what is next but shut beats what is played')
  assert.equal(tonight([card('a', 0, 'LOCKED'), card('b', 1, 'AVAILABLE')])?.id, 'b', 'what is open beats what is shut')
  assert.equal(tonight([card('a', 0, 'AVAILABLE'), card('b', 1, 'IN_PROGRESS')])?.id, 'b', 'what they are in the middle of comes first')
  assert.equal(tonight([card('a', 0, 'DONE'), card('b', 1, 'DONE')])?.id, 'b', 'all played: the last one, so the card still says something')
  assert.equal(tonight([card('b', 2, 'AVAILABLE'), card('a', 1, 'AVAILABLE')])?.id, 'a', 'ties break on position, not order')
})
