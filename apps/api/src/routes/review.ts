import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { REVIEW_SECRET_HEADER, ReviewDecisionRequest, type EpisodeLifecycle, type ReviewDecisionResponse, type ReviewItem, type ReviewQueueResponse } from '@odyssey/shared'
import { secretMatches } from '../auth/secret.js'
import type { AppRepository, EpisodeRecord } from '../repo/types.js'

const Params = z.object({ id: z.string().uuid() })

/** From a status, what a reviewer may turn it into. Anything else is a 409. */
const MOVES: Record<string, ReadonlyArray<EpisodeLifecycle>> = {
  SUBMITTED: ['LIVE', 'REJECTED'],
  UNLISTED: ['LIVE', 'REMOVED'],
  LIVE: ['REMOVED'],
}

/**
 * The human step (docs/ugc-pipeline.md, "Moderation"): a route behind a
 * secret, like the grant route, listing what a person still has to read with
 * the dry-run transcript, and the decision. Inside requireIdentity so a
 * decision has a user id on it in the log; the secret is what admits.
 */
export async function reviewRoutes(app: FastifyInstance, opts: { repo: AppRepository; secret: string | 'open' }) {
  const { repo, secret } = opts

  app.addHook('preHandler', async (req, reply) => {
    if (secret !== 'open' && !secretMatches(req.headers[REVIEW_SECRET_HEADER], secret)) {
      return reply.code(403).send({ error: 'review secret required' })
    }
  })

  app.get('/review/episodes', async (): Promise<ReviewQueueResponse> => {
    const waiting = await repo.listEpisodesForReview()
    return { items: await Promise.all(waiting.map((e) => item(e))) }
  })

  app.post('/review/episodes/:id', async (req, reply): Promise<ReviewDecisionResponse | void> => {
    const { id } = Params.parse(req.params)
    const parsed = ReviewDecisionRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'decision required' })
    const { decision, note } = parsed.data
    const current = await repo.getEpisode(id)
    if (!current || current.origin !== 'UGC') return reply.code(404).send({ error: 'episode not found' })
    if (!(MOVES[current.status] ?? []).includes(decision)) {
      return reply.code(409).send({ error: `a ${current.status} episode cannot be made ${decision}` })
    }
    if (decision !== 'LIVE' && !note) return reply.code(400).send({ error: 'tell the author why' })
    const episode = await repo.updateEpisode(id, {
      status: decision,
      reviewNote: note ?? null,
      lastReviewedAt: new Date(),
      // Back on the shelf with a clean count: the reports that took it down have been read.
      ...(decision === 'LIVE' && current.status === 'UNLISTED' ? { reportCount: 0 } : {}),
    })
    req.log.warn({ episodeId: id, authorId: current.authorId, from: current.status, to: decision, by: req.user.id }, 'review: decision')
    return { episode }
  })

  async function item(e: EpisodeRecord): Promise<ReviewItem> {
    const [character, author, reports, theirs] = await Promise.all([
      repo.getCharacter(e.characterId),
      e.authorId ? repo.getUser(e.authorId) : null,
      repo.listReports(e.id),
      e.authorId ? repo.listEpisodesByAuthor(e.authorId) : [],
    ])
    return {
      ...e,
      characterName: character?.name ?? '?',
      authorName: author?.displayName ?? null,
      authorLiveCount: theirs.filter((t) => t.status === 'LIVE').length,
      reports,
    }
  }
}
