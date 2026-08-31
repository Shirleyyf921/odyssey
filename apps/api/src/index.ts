import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { env } from './env.js'
import { healthRoutes } from './routes/health.js'
import { chatWebsocket } from './ws/chat.js'

const app = Fastify({
  logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
})

await app.register(websocket)
await app.register(healthRoutes)
await app.register(chatWebsocket)

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
    process.exit(0)
  })
}
