import type { FastifyInstance } from 'fastify'
import { SignInRequest, type MeResponse, type SignInResponse } from '@odyssey/shared'
import { InvalidTokenError } from '../auth/providers.js'
import { AuthService, UnsupportedProviderError } from '../auth/service.js'
import { deviceIdFrom, requireIdentity, sessionTokenFrom } from '../auth/identity.js'
import type { AppRepository } from '../repo/types.js'

/**
 * Public: sign-in. It resolves the device's guest user itself (optional) rather
 * than going through requireIdentity, so a phone holding an expired token can
 * still sign in.
 */
export async function publicAuthRoutes(app: FastifyInstance, opts: { repo: AppRepository; auth: AuthService }) {
  const { repo, auth } = opts

  app.post('/auth/sign-in', async (req, reply): Promise<SignInResponse | void> => {
    const parsed = SignInRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues.map((i) => i.message).join('; ') })
    const deviceId = deviceIdFrom(req)
    const guest = deviceId ? await repo.getOrCreateUserByDevice(deviceId) : null
    try {
      return await auth.signIn(parsed.data, guest)
    } catch (err) {
      if (err instanceof InvalidTokenError) return reply.code(401).send({ error: err.message })
      if (err instanceof UnsupportedProviderError) return reply.code(400).send({ error: err.message })
      throw err
    }
  })
}

/** Inside requireIdentity: who am I, and sign out. */
export async function authRoutes(app: FastifyInstance, opts: { repo: AppRepository; auth: AuthService }) {
  const { repo, auth } = opts
  requireIdentity(app, repo)

  app.get('/me', async (req): Promise<MeResponse> => ({ user: await auth.describe(req.user) }))

  app.post('/auth/sign-out', async (req, reply) => {
    const token = sessionTokenFrom(req)
    if (token) await auth.signOut(token)
    return reply.code(204).send()
  })
}
