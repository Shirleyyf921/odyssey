import type { EpisodeCard, EpisodeLifecycle } from '@odyssey/shared'
import type { RunCounts } from '../repo/types.js'

/**
 * Serving rules for what readers wrote (docs/ugc-pipeline.md, section 1).
 * Official episodes keep their authored order; user-made ones are ranked by
 * how often they were finished. Nothing here reads a brief or a beat.
 */

/**
 * Reports before a LIVE episode is taken off the shelf pending review. Three,
 * because one is a grudge, two can be a pair, and the review queue reads every
 * one of them anyway (build order, step 6). Reports on an episode already
 * UNLISTED or REMOVED are counted and change nothing.
 */
export const UNLIST_AT = 3

export function statusAfterReport(current: EpisodeLifecycle, reportCount: number): EpisodeLifecycle {
  return current === 'LIVE' && reportCount >= UNLIST_AT ? 'UNLISTED' : current
}

/** Share of runs that reached an END. Zero when nobody has started it. */
export function completionRate(counts: RunCounts | undefined): number {
  if (!counts || counts.started === 0) return 0
  return counts.finished / counts.started
}

/**
 * Best-finished first. Rate decides, then raw completions so a well-played
 * episode outranks one finished by its only reader, then position so a new
 * episode with no plays has a stable place at the end.
 */
export function rankCommunity(cards: EpisodeCard[], counts: Map<string, RunCounts>): EpisodeCard[] {
  return [...cards].sort((a, b) => {
    const rate = completionRate(counts.get(b.id)) - completionRate(counts.get(a.id))
    if (rate !== 0) return rate
    if (b.completions !== a.completions) return b.completions - a.completions
    return a.position - b.position
  })
}
