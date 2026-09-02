import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { appleVerifier, devVerifier, googleVerifier } from './providers.js'

async function issuer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
  const jwks = createLocalJWKSet({ keys: [jwk] })
  const sign = (claims: Record<string, unknown>, opts: { iss: string; aud: string; exp?: string }) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(opts.iss)
      .setAudience(opts.aud)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(privateKey)
  return { jwks, sign }
}

test('an Apple token with the right issuer and bundle id yields its subject and email', async () => {
  const { jwks, sign } = await issuer()
  const token = await sign({ sub: 'apple-123', email: 'a@privaterelay.appleid.com' }, { iss: 'https://appleid.apple.com', aud: 'com.odyssey.app' })
  const out = await appleVerifier('com.odyssey.app', jwks).verify(token)
  assert.deepEqual(out, { subject: 'apple-123', email: 'a@privaterelay.appleid.com' })
})

test('a token for another app is rejected', async () => {
  const { jwks, sign } = await issuer()
  const token = await sign({ sub: 'apple-123' }, { iss: 'https://appleid.apple.com', aud: 'com.someone.else' })
  await assert.rejects(appleVerifier('com.odyssey.app', jwks).verify(token), /apple token rejected/)
})

test('an expired token is rejected', async () => {
  const { jwks, sign } = await issuer()
  const token = await sign({ sub: 'apple-123' }, { iss: 'https://appleid.apple.com', aud: 'com.odyssey.app', exp: '-1h' })
  await assert.rejects(appleVerifier('com.odyssey.app', jwks).verify(token), /apple token rejected/)
})

test('Google accepts either issuer form and any configured client id', async () => {
  const { jwks, sign } = await issuer()
  const verifier = googleVerifier(['ios.apps.googleusercontent.com', 'web.apps.googleusercontent.com'], jwks)
  const a = await sign({ sub: 'g-1', email: 'x@gmail.com' }, { iss: 'accounts.google.com', aud: 'ios.apps.googleusercontent.com' })
  const b = await sign({ sub: 'g-1' }, { iss: 'https://accounts.google.com', aud: 'web.apps.googleusercontent.com' })
  assert.equal((await verifier.verify(a)).subject, 'g-1')
  assert.equal((await verifier.verify(b)).email, null)
  const wrong = await sign({ sub: 'g-1' }, { iss: 'accounts.google.com', aud: 'other.apps.googleusercontent.com' })
  await assert.rejects(verifier.verify(wrong), /google token rejected/)
})

test('a token signed by an unknown key is rejected', async () => {
  const a = await issuer()
  const b = await issuer()
  const token = await b.sign({ sub: 'x' }, { iss: 'https://appleid.apple.com', aud: 'com.odyssey.app' })
  await assert.rejects(appleVerifier('com.odyssey.app', a.jwks).verify(token), /apple token rejected/)
})

test('the dev verifier uses the token as the subject', async () => {
  assert.deepEqual(await devVerifier().verify('shirley'), { subject: 'shirley', email: null })
  await assert.rejects(devVerifier().verify('   '), /dev token rejected/)
})
