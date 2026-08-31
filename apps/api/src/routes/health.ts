import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance) {
  // Railway polls this for deploy health checks.
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }))
}
