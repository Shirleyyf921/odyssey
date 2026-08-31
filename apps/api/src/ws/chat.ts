import type { FastifyInstance } from 'fastify'
import { ClientEvent, type ServerEvent } from '@odyssey/shared'

/**
 * Chat WebSocket.
 *
 * Skeleton only — inference, memory retrieval, and the safety pipeline are not
 * wired up yet. What is real here is the wire contract and the idempotency and
 * validation boundaries, so those are settled before features land on top.
 */
export async function chatWebsocket(app: FastifyInstance) {
  app.get('/ws/chat', { websocket: true }, (socket, req) => {
    const send = (event: ServerEvent) => socket.send(JSON.stringify(event))

    req.log.info('ws connected')

    socket.on('message', (raw: Buffer) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        return send({
          type: 'error',
          code: 'INVALID_PAYLOAD',
          message: 'Malformed JSON',
        })
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
      switch (event.type) {
        case 'send_message':
          // TODO: dedupe on clientMsgId, run crisis detection on the input BEFORE
          // generation (ARCHITECTURE.md section 12), assemble memory context
          // (section 4), then stream via the LLM gateway (section 6).
          return send({
            type: 'error',
            code: 'INTERNAL',
            message: 'Not implemented',
          })

        case 'resume':
          // TODO: replay messages newer than lastMessageId.
          return send({
            type: 'error',
            code: 'INTERNAL',
            message: 'Not implemented',
          })
      }
    })

    socket.on('close', () => req.log.info('ws disconnected'))
  })
}
