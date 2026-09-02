import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { AuthProvider } from '@odyssey/shared'

export interface VerifiedIdentity {
  subject: string
  email: string | null
}

export interface TokenVerifier {
  readonly provider: AuthProvider
  verify(token: string): Promise<VerifiedIdentity>
}

export class InvalidTokenError extends Error {
  constructor(provider: AuthProvider, cause: unknown) {
    super(`${provider} token rejected: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

interface JwtVerifierOptions {
  provider: AuthProvider
  issuer: string | string[]
  audience: string | string[]
  jwksUrl: string
  /** Injected in tests; defaults to the provider's published JWKS. */
  jwks?: JWTVerifyGetKey
}

/** RS256 identity tokens from an OpenID provider. Apple and Google differ only in constants. */
class JwtVerifier implements TokenVerifier {
  readonly provider: AuthProvider
  private readonly jwks: JWTVerifyGetKey

  constructor(private readonly opts: JwtVerifierOptions) {
    this.provider = opts.provider
    this.jwks = opts.jwks ?? createRemoteJWKSet(new URL(opts.jwksUrl))
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.opts.issuer,
        audience: this.opts.audience,
        algorithms: ['RS256'],
      })
      if (!payload.sub) throw new Error('missing sub')
      const email = typeof payload.email === 'string' ? payload.email : null
      return { subject: payload.sub, email }
    } catch (err) {
      throw new InvalidTokenError(this.provider, err)
    }
  }
}

/** Sign in with Apple. `audience` is the app's bundle id. */
export function appleVerifier(bundleId: string, jwks?: JWTVerifyGetKey): TokenVerifier {
  return new JwtVerifier({
    provider: 'apple',
    issuer: 'https://appleid.apple.com',
    audience: bundleId,
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    jwks,
  })
}

/** Google Sign-In. `clientIds` lists every OAuth client (iOS, Android, web) that may mint tokens. */
export function googleVerifier(clientIds: string[], jwks?: JWTVerifyGetKey): TokenVerifier {
  return new JwtVerifier({
    provider: 'google',
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientIds,
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    jwks,
  })
}

/**
 * Local development only. The token itself is the subject, so `dev:shirley`
 * signs in as the same account every time. index.ts refuses to construct this
 * in production.
 */
export function devVerifier(): TokenVerifier {
  return {
    provider: 'dev',
    async verify(token) {
      const subject = token.trim()
      if (!subject) throw new InvalidTokenError('dev', 'empty token')
      return { subject, email: null }
    },
  }
}
