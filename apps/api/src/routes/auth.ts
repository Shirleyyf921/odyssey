import type { FastifyInstance } from 'fastify'
import { AgeGateRequest, SignInRequest, type MeResponse, type SignInResponse } from '@odyssey/shared'
import { InvalidTokenError } from '../auth/providers.js'
import { AuthService, UnsupportedProviderError } from '../auth/service.js'
import { deviceIdFrom, requireIdentity, sessionTokenFrom } from '../auth/identity.js'
import type { AppRepository } from '../repo/types.js'
import type { BillingService } from '../billing/service.js'
import { ADULT_AGE, ageOn } from '../episodes/rating.js'

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
export async function authRoutes(
  app: FastifyInstance,
  opts: { repo: AppRepository; auth: AuthService; billing: BillingService }
) {
  const { repo, auth, billing } = opts
  requireIdentity(app, repo)

  app.get('/me', async (req): Promise<MeResponse> => {
    const [user, status] = await Promise.all([auth.describe(req.user), billing.status(req.user.id)])
    return { user, billing: status }
  })

  /**
   * The age declaration (ARCHITECTURE section 11). A typed date of birth is not
   * assurance and does not pretend to be; it puts the answer on the server,
   * where the MATURE rail can read it, instead of in the client's head. The
   * date itself is not stored: only whether it cleared the bar, and when.
   */
  app.post('/me/age', async (req, reply): Promise<MeResponse | void> => {
    const parsed = AgeGateRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'bornOn must be YYYY-MM-DD' })
    const age = ageOn(parsed.data.bornOn)
    if (age === null) return reply.code(400).send({ error: 'bornOn is not a real date' })
    if (age < ADULT_AGE) {
      req.log.info({ userId: req.user.id }, 'age gate: under age')
      return reply.code(403).send({ error: 'You need to be 18 or older.' })
    }
    const user = await repo.updateUser(req.user.id, { ageVerifiedAt: new Date() })
    req.log.info({ userId: user.id }, 'age gate: passed')
    const [described, status] = await Promise.all([auth.describe(user), billing.status(user.id)])
    return { user: described, billing: status }
  })

  app.post('/auth/sign-out', async (req, reply) => {
    const token = sessionTokenFrom(req)
    if (token) await auth.signOut(token)
    return reply.code(204).send()
  })
}
