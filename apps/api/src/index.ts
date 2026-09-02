import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { env } from './env.js'
import { healthRoutes } from './routes/health.js'
import { chatWebsocket } from './ws/chat.js'
import { createDb } from './db/client.js'
import { DrizzleRepository } from './repo/drizzle.js'
import { MemoryRepository } from './repo/memory.js'
import type { ChatRepository } from './repo/types.js'
import { LlmGateway } from './llm/gateway.js'
import { OpenAiCompatibleProvider } from './llm/openai-compatible.js'
import { AnthropicProvider } from './llm/anthropic.js'
import { ScriptedProvider } from './llm/scripted.js'
import type { LlmProvider } from './llm/types.js'
import { NoopCrisisDetector } from './safety/crisis.js'

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
})

// ---------------------------------------------------------------- persistence
let repo: ChatRepository
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
  const memory = new MemoryRepository()
  const demo = memory.seedDemo()
  repo = memory
  app.log.warn({ conversationId: demo.conversationId }, 'no DATABASE_URL: in-memory store with a demo conversation')
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

// ---------------------------------------------------------------- http + ws
await app.register(websocket)
await app.register(healthRoutes)
await app.register(chatWebsocket, { repo, gateway, crisis: new NoopCrisisDetector() })

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
    await closeDb?.()
    process.exit(0)
  })
}
