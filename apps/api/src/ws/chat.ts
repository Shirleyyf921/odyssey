import type { FastifyInstance } from 'fastify'
import { ClientEvent, type ServerEvent } from '@odyssey/shared'
import { handleClientEvent, type ChatDeps } from '../chat/handler.js'

/**
 * Chat WebSocket. Owns framing, validation, and per-socket ordering; the
 * conversation logic lives in chat/handler.ts so it can be tested without a socket.
 */
export async function chatWebsocket(app: FastifyInstance, deps: Omit<ChatDeps, 'log'>) {
  app.get('/ws/chat', { websocket: true }, (socket, req) => {
    const send = (event: ServerEvent) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
    }
    const handlerDeps: ChatDeps = { ...deps, log: req.log }

    // Events on one socket are processed in order. A client that sends twice before
    // the first reply finishes still gets two replies, one after the other.
    let queue: Promise<void> = Promise.resolve()

    req.log.info('ws connected')

    socket.on('message', (raw: Buffer) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        return send({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Malformed JSON' })
      }

      const result = ClientEvent.safeParse(parsed)
      if (!result.success) {
        return send({
          type: 'error',
          code: 'INVALID_PAYLOAD',
          message: result.error.issues.map((i) => i.message).join('; '),
        })
      }

      const event = result.data
      queue = queue
        .then(() => handleClientEvent(handlerDeps, event, send))
        .catch((err) => {
          req.log.error({ err }, 'unhandled chat error')
          send({ type: 'error', code: 'INTERNAL', message: 'Something went wrong' })
        })
    })

    socket.on('close', () => req.log.info('ws disconnected'))
  })
}
