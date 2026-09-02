import { createHash, randomBytes } from 'node:crypto'
import type { AuthProvider, AuthUser, SignInRequest, SignInResponse } from '@odyssey/shared'
import type { AppRepository, UserRecord } from '../repo/types.js'
import type { TokenVerifier } from './providers.js'

export class UnsupportedProviderError extends Error {
  constructor(provider: AuthProvider) {
    super(`${provider} sign-in is not configured`)
  }
}

interface Log {
  info(obj: Record<string, unknown>, msg: string): void
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Sign-in, sessions, and the guest → account merge.
 *
 * Sessions are opaque random tokens; only their hash is stored, and they can be
 * revoked. Intimate conversation history needs "sign out everywhere" to mean
 * something, which a stateless JWT cannot offer.
 */
export class AuthService {
  private readonly verifiers: Map<AuthProvider, TokenVerifier>

  constructor(
    private readonly repo: AppRepository,
    verifiers: TokenVerifier[],
    private readonly log: Log,
    private readonly sessionTtlMs = 30 * 24 * 60 * 60 * 1000
  ) {
    this.verifiers = new Map(verifiers.map((v) => [v.provider, v]))
  }

  get providers(): AuthProvider[] {
    return [...this.verifiers.keys()]
  }

  /**
   * `guest` is the anonymous user behind the caller's device id, if any. A new
   * account adopts the guest row outright, so nothing is copied. An existing
   * account absorbs the guest's relationships where it has none of its own.
   */
  async signIn(req: SignInRequest, guest: UserRecord | null): Promise<SignInResponse> {
    const verifier = this.verifiers.get(req.provider)
    if (!verifier) throw new UnsupportedProviderError(req.provider)
    const identity = await verifier.verify(req.identityToken)

    let user: UserRecord
    let merged = false
    const existing = await this.repo.findIdentity(req.provider, identity.subject)

    if (existing) {
      user = await this.mustUser(existing.userId)
      if (guest && guest.id !== user.id && (await this.repo.listIdentities(guest.id)).length === 0) {
        const { moved } = await this.repo.mergeUsers(guest.id, user.id)
        merged = true
        this.log.info({ from: guest.id, into: user.id, moved }, 'guest merged into account')
      }
    } else if (guest && (await this.repo.listIdentities(guest.id)).length === 0) {
      // Promote the anonymous row: every relationship and message stays put.
      user = guest
      await this.repo.createIdentity({ userId: user.id, provider: req.provider, subject: identity.subject, email: identity.email })
      merged = true
    } else {
      user = await this.repo.createUser({ displayName: null })
      await this.repo.createIdentity({ userId: user.id, provider: req.provider, subject: identity.subject, email: identity.email })
    }

    if (req.fullName && !user.displayName) {
      user = await this.repo.updateUser(user.id, { displayName: req.fullName })
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + this.sessionTtlMs)
    await this.repo.createSession({ userId: user.id, tokenHash: hashToken(token), expiresAt })
    this.log.info({ userId: user.id, provider: req.provider, merged }, 'signed in')

    return { token, expiresAt: expiresAt.toISOString(), user: await this.describe(user), merged }
  }

  async signOut(token: string): Promise<void> {
    await this.repo.revokeSession(hashToken(token))
  }

  async describe(user: UserRecord): Promise<AuthUser> {
    const identities = await this.repo.listIdentities(user.id)
    return {
      id: user.id,
      displayName: user.displayName,
      locale: user.locale,
      signedIn: identities.length > 0,
      providers: [...new Set(identities.map((i) => i.provider))],
    }
  }

  private async mustUser(id: string): Promise<UserRecord> {
    const user = await this.repo.getUser(id)
    if (!user) throw new Error(`identity points at missing user ${id}`)
    return user
  }
}
