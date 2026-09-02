import type { FastifyInstance, FastifyRequest } from 'fastify'
import { DEVICE_ID_HEADER } from '@odyssey/shared'
import { z } from 'zod'
import type { AppRepository, UserRecord } from '../repo/types.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRecord
  }
}

const DeviceId = z.string().uuid()

/**
 * Anonymous device identity. The client generates a UUID once, keeps it in the
 * secure store, and sends it on every request. Good enough to give a person their
 * own relationships and unlocks; not good enough to survive a reinstall or to gate
 * age. Real sign-in replaces this without changing the routes.
 */
export function deviceIdFrom(req: FastifyRequest): string | null {
  const header = req.headers[DEVICE_ID_HEADER]
  const query = (req.query as Record<string, unknown> | undefined)?.deviceId
  const candidate = typeof header === 'string' ? header : typeof query === 'string' ? query : null
  const parsed = DeviceId.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/** Registers an onRequest hook in the calling scope; routes outside it stay public. */
export function requireDevice(app: FastifyInstance, repo: AppRepository) {
  app.addHook('onRequest', async (req, reply) => {
    const deviceId = deviceIdFrom(req)
    if (!deviceId) {
      return reply.code(401).send({ error: `missing or invalid ${DEVICE_ID_HEADER}` })
    }
    req.user = await repo.getOrCreateUserByDevice(deviceId)
  })
}
