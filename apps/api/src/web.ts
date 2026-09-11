import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'

/**
 * The exported web build, served from the API's own origin so the browser
 * needs no CORS and the client needs no configured API URL. Expo exports a
 * single-page app, so any GET that wants HTML and is not an API route gets
 * index.html and the router takes it from there. Registered only when the
 * build exists; the API is otherwise unchanged.
 */
export async function serveWeb(app: FastifyInstance, dir: string): Promise<boolean> {
  const root = resolve(dir)
  if (!existsSync(resolve(root, 'index.html'))) return false
  await app.register(fastifyStatic, { root, wildcard: true, index: ['index.html'], decorateReply: true })
  app.setNotFoundHandler(async (req, reply) => {
    const wantsHtml = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html')
    if (!wantsHtml) return reply.code(404).send({ error: `Route ${req.method}:${req.url} not found` })
    return reply.sendFile('index.html')
  })
  return true
}
