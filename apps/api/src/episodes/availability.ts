import {
  STAGE_ORDER,
  type EpisodeCard,
  type EpisodeRun,
  type EpisodeStatus,
  type Relationship,
  type Tier,
} from '@odyssey/shared'
import type { EpisodeRecord } from '../repo/types.js'

export interface Availability {
  status: EpisodeStatus
  lockReason: string | null
}

/**
 * Whether an episode is open tonight. This is the hidden relationship showing
 * through: the copy says what to do, never a number. Rating is not decided here;
 * the route filters MATURE episodes by build (story pipeline, step 6).
 */
export function availability(
  episode: EpisodeRecord,
  relationship: Pick<Relationship, 'stage'> | null,
  tier: Tier,
  runs: EpisodeRun[],
  all: EpisodeRecord[]
): Availability {
  const run = runs.find((r) => r.episodeId === episode.id) ?? null
  if (run?.endedAt) return { status: 'DONE', lockReason: null }
  if (run) return { status: 'IN_PROGRESS', lockReason: null }
  const rule = episode.unlock
  switch (rule.kind) {
    case 'FREE':
      return { status: 'AVAILABLE', lockReason: null }
    case 'STAGE': {
      const have = relationship ? STAGE_ORDER.indexOf(relationship.stage) : -1
      if (have >= STAGE_ORDER.indexOf(rule.stage)) return { status: 'AVAILABLE', lockReason: null }
      return { status: 'LOCKED', lockReason: 'Not yet. Keep showing up.' }
    }
    case 'PLUS':
      if (tier !== 'FREE') return { status: 'AVAILABLE', lockReason: null }
      return { status: 'LOCKED', lockReason: 'Plus opens this one.' }
    case 'EPISODE': {
      const done = runs.some((r) => r.episodeId === rule.episodeId && r.endedAt)
      if (done) return { status: 'AVAILABLE', lockReason: null }
      const title = all.find((e) => e.id === rule.episodeId)?.title ?? 'the one before'
      return { status: 'LOCKED', lockReason: `Finish "${title}" first.` }
    }
  }
}

export function toEpisodeCard(
  episode: EpisodeRecord,
  relationship: Pick<Relationship, 'stage'> | null,
  tier: Tier,
  runs: EpisodeRun[],
  all: EpisodeRecord[]
): EpisodeCard {
  const { status, lockReason } = availability(episode, relationship, tier, runs, all)
  const run = runs.find((r) => r.episodeId === episode.id) ?? null
  const currentIndex = run && !run.endedAt ? episode.beats.findIndex((b) => b.id === run.currentBeatId) : -1
  return {
    id: episode.id,
    characterId: episode.characterId,
    position: episode.position,
    title: episode.title,
    premise: episode.premise,
    sceneId: episode.sceneId,
    rating: episode.rating,
    unlock: episode.unlock,
    status,
    lockReason,
    beatCount: episode.beats.length,
    currentBeat: currentIndex >= 0 ? currentIndex + 1 : null,
  }
}
