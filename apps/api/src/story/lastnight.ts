import type { LastNight } from '@odyssey/prompts'
import type { AppRepository } from '../repo/types.js'

/** Nights he keeps referring to; after this it is old. */
const REMEMBERED_NIGHTS = 7

/**
 * The story they finished most recently, for the everyday turn and for his
 * first message of a new day (docs/story-pipeline.md, "Between stories"):
 * the title, how many nights ago, the road she took through it as her
 * choices, and how it ended, from the END beat's brief. Null when no story
 * has ended, when one is still open, or when the last one is more than a
 * week old. Server-side only; the briefs never reach a client.
 */
export async function lastNight(repo: AppRepository, relationshipId: string, now = new Date()): Promise<LastNight | null> {
  const runs = await repo.listRuns(relationshipId)
  if (runs.some((r) => !r.endedAt)) return null
  const ended = runs.filter((r) => r.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))[0]
  if (!ended) return null
  const nightsAgo = Math.max(0, Math.round((now.getTime() - Date.parse(ended.endedAt!)) / 86_400_000))
  if (nightsAgo > REMEMBERED_NIGHTS) return null
  const episode = await repo.getEpisode(ended.episodeId)
  if (!episode) return null
  const byId = new Map(episode.beats.map((b) => [b.id, b]))
  const choices: string[] = []
  for (let i = 1; i < ended.path.length; i++) {
    const from = byId.get(ended.path[i - 1]!)
    const to = ended.path[i]!
    const chosen = from?.options.find((o) => o.next === to)
    if (chosen && chosen.intent) choices.push(chosen.intent)
  }
  const last = byId.get(ended.path[ended.path.length - 1] ?? ended.currentBeatId)
  return {
    title: episode.title,
    nightsAgo,
    choices,
    ending: (last?.brief ?? '').slice(0, 400),
  }
}
