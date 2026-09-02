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
import { EMBEDDING_DIMENSIONS } from './db/schema.js'
import { DrizzleRepository } from './repo/drizzle.js'
import { MemoryRepository } from './repo/memory.js'
import type { AppRepository } from './repo/types.js'
import { LlmGateway } from './llm/gateway.js'
import { OpenAiCompatibleProvider } from './llm/openai-compatible.js'
import { AnthropicProvider } from './llm/anthropic.js'
import { ScriptedProvider } from './llm/scripted.js'
import type { LlmProvider } from './llm/types.js'
import { HashEmbeddings, OpenAiCompatibleEmbeddings, type EmbeddingProvider } from './memory/embeddings.js'
import { MemoryService } from './memory/service.js'
import { RelationshipService } from './relationship/service.js'
import { NoopCrisisDetector } from './safety/crisis.js'

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
const novita = env.NOVITA_API_KEY
  ? new OpenAiCompatibleProvider({
      name: 'novita',
      baseUrl: env.NOVITA_BASE_URL,
      apiKey: env.NOVITA_API_KEY,
      model: env.NOVITA_MODEL,
    })
  : null
const anthropic = env.ANTHROPIC_API_KEY
  ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
  : null
const scripted: LlmProvider = new ScriptedProvider()

const everyday = novita ?? anthropic ?? scripted
const pivotal = anthropic ?? novita ?? scripted
if (everyday === scripted) app.log.warn('no LLM keys: replies are scripted')
app.log.info({ EVERYDAY: everyday.name, PIVOTAL: pivotal.name }, 'llm routes')

const gateway = new LlmGateway({ EVERYDAY: everyday, PIVOTAL: pivotal }, app.log)

const embeddings: EmbeddingProvider = env.NOVITA_API_KEY
  ? new OpenAiCompatibleEmbeddings({
      name: 'novita',
      baseUrl: env.NOVITA_BASE_URL,
      apiKey: env.NOVITA_API_KEY,
      model: env.NOVITA_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    })
  : new HashEmbeddings(EMBEDDING_DIMENSIONS)
if (embeddings.name === 'hash') app.log.warn('no embedding key: long-term memory uses hash embeddings')

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
  await scoped.register(characterRoutes, { repo })
  await scoped.register(chatWebsocket, {
    repo,
    gateway,
    memory,
    relationship,
    crisis: new NoopCrisisDetector(),
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
