import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AskNightRequest, type AskNightResponse } from '@odyssey/shared'
import { NightRefused, type NightService } from '../nights/service.js'

const Params = z.object({ id: z.string().uuid() })

/**
 * Tonight, you decide (docs/story-pipeline.md). Behind identity. Refusals are
 * 402 for the plan, 403 for the level, 422 for the screen, 503 when he cannot
 * write; each carries a code the client maps to the paywall or to a line.
 */
export async function nightRoutes(app: FastifyInstance, opts: { nights: NightService }) {
  app.post('/characters/:id/nights', async (req, reply): Promise<AskNightResponse | void> => {
    const { id } = Params.parse(req.params)
    const parsed = AskNightRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'a wish of three to a hundred and forty characters' })
    try {
      const episode = await opts.nights.ask(req.user, req.channel, { characterId: id, wish: parsed.data.wish, heat: parsed.data.heat })
      return { episode }
    } catch (err) {
      if (err instanceof NightRefused) {
        const status = err.code === 'LEVEL' ? 403 : err.code === 'REFUSED' ? 422 : err.code === 'UNAVAILABLE' ? 503 : 402
        return reply.code(status).send({ error: err.message, code: err.code })
      }
      throw err
    }
  })
}
