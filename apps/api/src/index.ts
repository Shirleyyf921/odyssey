import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { env } from './env.js'
import { healthRoutes } from './routes/health.js'
import { characterRoutes } from './routes/characters.js'
import { chatWebsocket } from './ws/chat.js'
import { requireIdentity } from './auth/identity.js'
import { appleVerifier, devVerifier, googleVerifier, type TokenVerifier } from './auth/providers.js'
import { AuthService } from './auth/service.js'
import { authRoutes, publicAuthRoutes } from './routes/auth.js'
import { createDb } from './db/client.js'
import { DrizzleRepository } from './repo/drizzle.js'
import { MemoryRepository } from './repo/memory.js'
import type { AppRepository } from './repo/types.js'
import { gatewayFromEnv } from './llm/from-env.js'
import { MemoryService } from './memory/service.js'
import { RelationshipService } from './relationship/service.js'
import { NoopCrisisDetector, type CrisisDetector } from './safety/crisis.js'
import { LlmCrisisDetector } from './safety/llm-detector.js'

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
})

// ---------------------------------------------------------------- persistence
let repo: AppRepository
let closeDb: (() => Promise<void>) | undefined
if (env.DATABASE_URL) {
  const { db, close } = createDb(env.DATABASE_URL)
  repo = new DrizzleRepository(db)
  closeDb = close
} else {
  if (env.NODE_ENV === 'production') {
    app.log.error('DATABASE_URL is required in production')
    process.exit(1)
  }
  repo = new MemoryRepository()
  app.log.warn('no DATABASE_URL: in-memory store seeded with the launch roster')
}

// ---------------------------------------------------------------- inference
const inference = gatewayFromEnv(env, app.log)
const { gateway, embeddings } = inference
if (!inference.live) app.log.warn('no LLM keys: replies are scripted (see README, "Connecting the models")')
if (embeddings.name === 'hash') app.log.warn('no embedding key: long-term memory uses hash embeddings')
app.log.info({ EVERYDAY: inference.routes.EVERYDAY.name, PIVOTAL: inference.routes.PIVOTAL.name }, 'llm routes')

// ---------------------------------------------------------------- safety
let crisis: CrisisDetector
if (inference.crisisProvider) {
  crisis = new LlmCrisisDetector(inference.crisisProvider, { timeoutMs: env.CRISIS_TIMEOUT_MS, log: app.log })
  app.log.info({ model: env.CRISIS_MODEL, timeoutMs: env.CRISIS_TIMEOUT_MS }, 'crisis classifier')
} else {
  if (env.NODE_ENV === 'production') {
    app.log.error('no crisis classifier in production: NOVITA_API_KEY is required (ARCHITECTURE.md section 12)')
    process.exit(1)
  }
  app.log.warn('no NOVITA_API_KEY: crisis detection is a no-op (development only)')
  crisis = new NoopCrisisDetector()
}

const relationship = new RelationshipService(repo, app.log)
const memory = new MemoryService(repo, gateway, embeddings, app.log, { tier: env.MEMORY_TIER }, (ctx, n) =>
  relationship.onFactsShared(ctx, n)
)

// ---------------------------------------------------------------- auth
const verifiers: TokenVerifier[] = [appleVerifier(env.APPLE_BUNDLE_ID)]
if (env.GOOGLE_CLIENT_IDS.length) verifiers.push(googleVerifier(env.GOOGLE_CLIENT_IDS))
if (env.NODE_ENV !== 'production') verifiers.push(devVerifier())
const auth = new AuthService(repo, verifiers, app.log, env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
app.log.info({ providers: auth.providers }, 'sign-in providers')

// ---------------------------------------------------------------- http + ws
// The native client has no origin; CORS only matters for the web preview build.
if (env.NODE_ENV !== 'production') await app.register(cors, { origin: true })
await app.register(websocket)
await app.register(healthRoutes)
await app.register(publicAuthRoutes, { repo, auth })
await app.register(authRoutes, { repo, auth })
await app.register(async (scoped) => {
  requireIdentity(scoped, repo)
  await scoped.register(characterRoutes, { repo, devTools: env.NODE_ENV !== 'production' })
  await scoped.register(chatWebsocket, {
    repo,
    gateway,
    memory,
    relationship,
    crisis,
  })
})

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

// Railway sends SIGTERM on redeploy; drain rather than drop connections.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} received, shutting down`)
    await app.close()
    await memory.drain()
    await closeDb?.()
    process.exit(0)
  })
}
