import type { Channel, ContentRating, EpisodeCard, Tier } from '@odyssey/shared'
import { levelFor } from '../levels.js'
import { utcDayStart } from '../billing/rules.js'
import { toEpisodeCard } from '../episodes/availability.js'
import type { LlmGateway } from '../llm/gateway.js'
import type { AppRepository, UserRecord } from '../repo/types.js'
import { ScreenerUnavailable, unitsOf, type EpisodeScreener } from '../safety/episode-screen.js'
import { DraftUnavailable, draftEpisode, linearSkeleton } from '../story/draft.js'

/**
 * "Tonight, you decide" (docs/story-pipeline.md, 2026-09-14). She asks for a
 * night in one line, or picks one of his; the story model writes five beats
 * straight through in his voice; it is screened like anything a reader
 * writes; and it is hers alone: a PRIVATE episode that no shelf ever lists
 * and nobody else can start. Not the season, which is written by hand: an
 * extra, single-road, and it ends on his line.
 *
 * Who may: Plus, one a night. What it may reach: SFW anywhere; MATURE only on
 * the web build, past the age gate, on Plus, and once he is CLOSE to her.
 */
export class NightRefused extends Error {
  constructor(
    readonly code: 'NEEDS_PLUS' | 'USED_TODAY' | 'LEVEL' | 'REFUSED' | 'UNAVAILABLE',
    message: string
  ) {
    super(message)
  }
}

export interface NightRequest {
  characterId: string
  /** Her line, or one of his presets sent as its text. */
  wish: string
  heat: ContentRating
}

export interface NightDeps {
  repo: AppRepository
  gateway: LlmGateway
  screener: EpisodeScreener
  billing: { tierOf(userId: string): Promise<Tier> }
  log: { info(obj: Record<string, unknown>, msg: string): void; warn(obj: Record<string, unknown>, msg: string): void }
}

export const NIGHTS_PER_DAY_PLUS = 1
export const NIGHT_BEATS = 5

export class NightService {
  constructor(private readonly deps: NightDeps) {}

  async ask(user: UserRecord, channel: Channel, req: NightRequest, now = new Date()): Promise<EpisodeCard> {
    const { repo, gateway, screener, billing, log } = this.deps
    const character = await repo.getCharacter(req.characterId)
    if (!character) throw new NightRefused('UNAVAILABLE', 'He is not here.')
    const tier = await billing.tierOf(user.id)
    if (tier === 'FREE') throw new NightRefused('NEEDS_PLUS', 'Nights you choose are Plus.')
    const today = await repo.countPrivateEpisodesSince(user.id, utcDayStart(now))
    if (today >= NIGHTS_PER_DAY_PLUS) throw new NightRefused('USED_TODAY', 'He gave you one tonight already.')
    const relationship = await repo.findRelationship(user.id, character.id)
    const level = levelFor({ channel, ageVerified: user.ageVerifiedAt !== null, tier, stage: relationship?.stage ?? null })
    if (req.heat === 'MATURE' && level !== 'MATURE') throw new NightRefused('LEVEL', 'Not that one yet. He will, when you are closer.')

    let draft
    try {
      ;({ draft } = await draftEpisode({ gateway, log }, character, { characterId: character.id, premise: req.wish, rating: req.heat, skeleton: linearSkeleton(NIGHT_BEATS) }))
    } catch (err) {
      if (err instanceof DraftUnavailable) throw new NightRefused('UNAVAILABLE', 'He could not think of one just now.')
      throw err
    }
    // Screened like anything a reader writes: what he wrote, and what she asked for, both.
    let report
    try {
      // Her line is screened as what it is, a thing said to him; bare, an imperative reads to the screen as an order to the model.
      report = await screener.screen([{ at: 'wish', text: `What she asked him for tonight, in her words: "${req.wish}"` }, ...unitsOf(draft)])
    } catch (err) {
      if (err instanceof ScreenerUnavailable) throw new NightRefused('UNAVAILABLE', 'Not tonight; try again in a minute.')
      throw err
    }
    if (report.worst === 'BLOCK' || report.worst === 'INJECTION') {
      log.warn({ userId: user.id, characterId: character.id, worst: report.worst, flagged: report.units.filter((u) => u.label === 'BLOCK' || u.label === 'INJECTION').map((u) => `${u.at}:${u.label}:${u.source}`) }, 'night: refused by the screen')
      throw new NightRefused('REFUSED', 'Not that. Ask him for something else.')
    }
    // What he wrote reads hotter than she asked: it is a MATURE night, and only if she may have one.
    const rating: ContentRating = report.rating === 'MATURE' || req.heat === 'MATURE' ? 'MATURE' : 'SFW'
    if (rating === 'MATURE' && level !== 'MATURE') throw new NightRefused('LEVEL', 'That one got away from him. Ask for something else tonight.')

    const created = await repo.createEpisode(user.id, { ...draft, rating })
    const episode = await repo.updateEpisode(created.id, { status: 'PRIVATE' })
    log.info({ userId: user.id, characterId: character.id, episodeId: episode.id, rating, beats: episode.beats.length }, 'night: he wrote one for her')
    const runs = relationship ? await repo.listRuns(relationship.id) : []
    return { ...toEpisodeCard(episode, relationship, tier, runs, [episode]), private: true }
  }
}
