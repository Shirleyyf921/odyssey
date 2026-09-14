import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DevPhotoCreditsRequest, GRANT_SECRET_HEADER, type AskPhotoResponse } from '@odyssey/shared'
import { secretMatches } from '../auth/secret.js'
import type { ChatDeps } from '../chat/handler.js'
import { PhotoRefused, type PhotoService } from '../photos/service.js'
import type { AppRepository } from '../repo/types.js'

const Params = z.object({ conversationId: z.string().uuid() })

/**
 * Ask him for a picture (docs/story-pipeline.md, 2026-09-14). Behind identity:
 * the conversation must be the caller's. Refusals come back as 402 with a code
 * the client maps to the paywall or to a line; the picture itself is served
 * by the public route below, by an unguessable id, to the owner only in fact.
 */
export async function photoRoutes(
  app: FastifyInstance,
  opts: { repo: AppRepository; photos: PhotoService; deps: Omit<ChatDeps, 'user' | 'channel'>; grant: string | null }
) {
  const { repo, photos, grant } = opts

  app.post('/conversations/:conversationId/photos', async (req, reply): Promise<AskPhotoResponse | void> => {
    const { conversationId } = Params.parse(req.params)
    const ctx = await repo.getConversationContext(conversationId)
    if (!ctx || ctx.user.id !== req.user.id) return reply.code(404).send({ error: 'conversation not found' })
    try {
      return await photos.ask({ ...opts.deps, user: req.user, channel: req.channel }, ctx)
    } catch (err) {
      if (err instanceof PhotoRefused) return reply.code(err.code === 'UNAVAILABLE' ? 503 : 402).send({ error: err.message, code: err.code })
      throw err
    }
  })

  if (grant !== null) {
    /** Development and demo: pictures onto the caller's balance, the way a purchase will. */
    app.post('/billing/dev/photo-credits', async (req, reply): Promise<{ remaining: number } | void> => {
      if (grant !== 'open' && !secretMatches(req.headers[GRANT_SECRET_HEADER], grant)) {
        return reply.code(403).send({ error: 'grant secret required' })
      }
      const parsed = DevPhotoCreditsRequest.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'count required' })
      req.log.warn({ userId: req.user.id, count: parsed.data.count }, 'dev: photo credits granted')
      return { remaining: await repo.addPhotoCredits(req.user.id, parsed.data.count) }
    })
  }
}

/** The bytes, outside identity: an <img> carries no headers. The id is a v4 uuid nobody but the owner was ever sent. */
export async function photoFileRoutes(app: FastifyInstance, opts: { repo: AppRepository }) {
  app.get('/photos/:id.jpg', async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const blob = await opts.repo.getPhotoBlob(id)
    if (!blob) return reply.code(404).send({ error: 'not found' })
    return reply.header('cache-control', 'private, max-age=31536000, immutable').type(blob.contentType).send(blob.image)
  })
}
