import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { EpisodeRun } from '@odyssey/shared'
import type { ChatDeps } from '../chat/handler.js'
import { BillingService } from '../billing/service.js'
import { SEED_CHARACTERS } from '../content/seed.js'
import { MemoryRepository } from '../repo/memory.js'
import type { ConversationContext, EpisodeRecord } from '../repo/types.js'
import { CREDIT_DAYS_PER_AUTHOR_PER_DAY, creditCompletion } from './credits.js'

const silent = { info() {}, warn() {}, error() {} }
const rafe = SEED_CHARACTERS[1]!

async function setup() {
  const repo = new MemoryRepository()
  const billing = new BillingService(repo, null, silent)
  const author = await repo.getOrCreateUserByDevice(randomUUID())
  const source = rafe.episodes[0]!
  const ids = new Map(source.beats.map((b) => [b.id, randomUUID()] as const))
  const map = (id: string | null) => (id ? ids.get(id)! : null)
  const episode = await repo.createEpisode(author.id, {
    characterId: source.characterId, title: 'Theirs', premise: source.premise, setting: source.setting, opener: source.opener, sceneId: source.sceneId, rating: 'SFW',
    firstBeatId: map(source.firstBeatId)!,
    beats: source.beats.map(({ episodeId: _e, ...b }) => ({ ...b, id: map(b.id)!, next: map(b.next), options: b.options.map((o) => ({ ...o, next: map(o.next) })) })),
  })
  await repo.updateEpisode(episode.id, { status: 'LIVE' })
  const credited: Array<[string, number]> = []
  const deps = { repo, billing: { tierOf: (id: string) => billing.tierOf(id), credit: async (id: string, days: number) => { credited.push([id, days]); return billing.credit(id, days) } }, log: silent } as unknown as ChatDeps
  /** A player who finished it: signed in or not. */
  const finish = async (signedIn: boolean): Promise<{ ctx: ConversationContext; run: EpisodeRun; episode: EpisodeRecord }> => {
    const player = await repo.getOrCreateUserByDevice(randomUUID())
    if (signedIn) await repo.createIdentity({ userId: player.id, provider: 'dev', subject: randomUUID(), email: null })
    const rel = await repo.createRelationship(player.id, rafe.character.id, 'LIGHT')
    const run = await repo.createRun({ relationshipId: rel.id, episodeId: episode.id, currentBeatId: episode.firstBeatId, episodeVersion: 1 })
    await repo.updateRun(run.id, { endedAt: new Date() })
    return { ctx: { user: player } as ConversationContext, run, episode: (await repo.getEpisode(episode.id))! }
  }
  return { repo, billing, author, episode, deps, credited, finish }
}

test('a signed-in stranger finishing the episode earns the author a day of Plus; anonymous and the author earn nothing', async () => {
  const { billing, author, deps, credited, finish, repo } = await setup()
  assert.equal(await billing.tierOf(author.id), 'FREE')

  const anon = await finish(false)
  await creditCompletion(deps, anon.ctx, anon.episode, anon.run)
  assert.deepEqual(credited, [], 'a device id is free; it earns nothing')

  const self = await finish(true)
  await creditCompletion(deps, { user: author } as ConversationContext, self.episode, self.run)
  assert.deepEqual(credited, [], 'the author cannot pay themselves')

  const reader = await finish(true)
  await creditCompletion(deps, reader.ctx, reader.episode, reader.run)
  assert.deepEqual(credited, [[author.id, 1]])
  assert.equal(await billing.tierOf(author.id), 'PLUS')
  const status = await billing.status(author.id)
  assert.ok(status.expiresAt && new Date(status.expiresAt).getTime() - Date.now() > 23 * 3_600_000)

  // The same run again is not a second day.
  await creditCompletion(deps, reader.ctx, reader.episode, reader.run)
  assert.equal(credited.length, 1)
  assert.equal(await repo.creditedDaysSince(author.id, new Date(0)), 1)
})

test('the daily cap holds, and credit days queue behind Plus the author already holds', async () => {
  const { billing, author, deps, credited, finish } = await setup()
  // A creator who already pays: their days start when the paid ones end.
  const paidUntil = new Date(Date.now() + 10 * 86_400_000)
  await billing.grant(author.id, 'PLUS', 10)
  for (let i = 0; i < CREDIT_DAYS_PER_AUTHOR_PER_DAY + 2; i++) {
    const r = await finish(true)
    await creditCompletion(deps, r.ctx, r.episode, r.run)
  }
  assert.equal(credited.length, CREDIT_DAYS_PER_AUTHOR_PER_DAY, 'the cap')
  const status = await billing.status(author.id)
  const expected = paidUntil.getTime() + CREDIT_DAYS_PER_AUTHOR_PER_DAY * 86_400_000
  assert.ok(Math.abs(new Date(status.expiresAt!).getTime() - expected) < 5_000, 'stacked after the paid days')
  assert.equal(status.tier, 'PLUS')
})
