import type { FastifyInstance, FastifyRequest } from 'fastify'
import { CHANNEL_HEADER, Channel, DEVICE_ID_HEADER } from '@odyssey/shared'
import { z } from 'zod'
import type { AppRepository, UserRecord } from '../repo/types.js'
import { hashToken } from './service.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRecord
    /** How the caller was identified. */
    authVia: 'session' | 'device'
    /** Which build is asking. See episodes/rating.ts: absent means `store`. */
    channel: Channel
  }
}

const DeviceId = z.string().uuid()

export function deviceIdFrom(req: FastifyRequest): string | null {
  const header = req.headers[DEVICE_ID_HEADER]
  const query = (req.query as Record<string, unknown> | undefined)?.deviceId
  const candidate = typeof header === 'string' ? header : typeof query === 'string' ? query : null
  const parsed = DeviceId.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/** The asking build. Anything but an explicit `web` is read as `store`, so the default never leaks MATURE. */
export function channelFrom(req: FastifyRequest): Channel {
  const header = req.headers[CHANNEL_HEADER]
  const query = (req.query as Record<string, unknown> | undefined)?.channel
  const candidate = typeof header === 'string' ? header : typeof query === 'string' ? query : null
  return Channel.safeParse(candidate).data ?? 'store'
}

export function sessionTokenFrom(req: FastifyRequest): string | null {
  const header = req.headers.authorization
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7).trim() || null
  const query = (req.query as Record<string, unknown> | undefined)?.token
  return typeof query === 'string' && query ? query : null
}

/**
 * Who is calling. A session token wins; a device id falls back to an anonymous
 * user so the roster can be browsed before sign-in. A token that is expired or
 * revoked is a 401 rather than a silent downgrade to guest, so the client knows
 * to clear it.
 */
export async function resolveIdentity(
  repo: AppRepository,
  req: FastifyRequest
): Promise<{ user: UserRecord; via: 'session' | 'device' } | { error: string }> {
  const token = sessionTokenFrom(req)
  if (token) {
    const user = await repo.findUserBySession(hashToken(token), new Date())
    return user ? { user, via: 'session' } : { error: 'session expired' }
  }
  const deviceId = deviceIdFrom(req)
  if (deviceId) return { user: await repo.getOrCreateUserByDevice(deviceId), via: 'device' }
  return { error: `missing bearer token or ${DEVICE_ID_HEADER}` }
}

/** Registers an onRequest hook in the calling scope; routes outside it stay public. */
export function requireIdentity(app: FastifyInstance, repo: AppRepository) {
  app.addHook('onRequest', async (req, reply) => {
    const resolved = await resolveIdentity(repo, req)
    if ('error' in resolved) return reply.code(401).send({ error: resolved.error })
    req.user = resolved.user
    req.authVia = resolved.via
    req.channel = channelFrom(req)
  })
}
