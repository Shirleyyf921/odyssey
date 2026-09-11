import type { EpisodeRun } from '@odyssey/shared'
import type { ChatDeps } from '../chat/handler.js'
import type { ConversationContext, EpisodeRecord } from '../repo/types.js'

/**
 * What a completion is worth (docs/ugc-pipeline.md, section 3). One day of
 * Plus per finished run by someone else. The daily cap bounds what a burst of
 * alt accounts can extract; the sign-in requirement makes each alt cost an
 * identity rather than a device id, which is free.
 */
export const CREDIT_DAYS_PER_COMPLETION = 1
export const CREDIT_DAYS_PER_AUTHOR_PER_DAY = 3

/**
 * Called once, when a run reaches an END. Credits the author when the player
 * is someone else, signed in, the run was not credited before, and the author
 * is under today's cap. Never throws into the turn: a failed credit is a log
 * line and the episode still ended.
 */
export async function creditCompletion(deps: ChatDeps, ctx: ConversationContext, episode: EpisodeRecord, run: EpisodeRun): Promise<void> {
  const { repo, billing, log } = deps
  if (episode.origin !== 'UGC' || !episode.authorId || episode.authorId === ctx.user.id) return
  try {
    const identities = await repo.listIdentities(ctx.user.id)
    if (!identities.length) {
      log.info({ episodeId: episode.id, authorId: episode.authorId }, 'credit: player is not signed in; nothing earned')
      return
    }
    const today = await repo.creditedDaysSince(episode.authorId, new Date(Date.now() - 86_400_000))
    const days = Math.min(CREDIT_DAYS_PER_COMPLETION, Math.max(0, CREDIT_DAYS_PER_AUTHOR_PER_DAY - today))
    if (days === 0) {
      log.info({ episodeId: episode.id, authorId: episode.authorId, today }, 'credit: author at the daily cap')
      return
    }
    const fresh = await repo.insertCredit({ authorId: episode.authorId, episodeId: episode.id, runId: run.id, days })
    if (!fresh) return
    await billing.credit(episode.authorId, days)
    log.info({ episodeId: episode.id, authorId: episode.authorId, runId: run.id, days }, 'credit: completion earned Plus days')
  } catch (err) {
    log.error({ err, episodeId: episode.id, authorId: episode.authorId }, 'credit: failed; the episode still ended')
  }
}
