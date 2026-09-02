import { ClientEvent, ServerEvent, type Message } from '@odyssey/shared'
import { randomUUID } from 'expo-crypto'
import { WS_URL } from './config'
import { getDeviceId } from './device'

export type SocketStatus = 'connecting' | 'open' | 'closed'

export interface SocketListener {
  onStatus(status: SocketStatus): void
  onEvent(event: ServerEvent): void
}

/**
 * One socket per open chat screen. Reconnects with exponential backoff (Railway
 * restarts drop connections) and replays through `resume` with the last message
 * the client holds, so nothing is lost or duplicated across a gap.
 */
export class ChatSocket {
  private ws: WebSocket | null = null
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private closedByUser = false

  constructor(
    private readonly conversationId: string,
    private readonly listener: SocketListener,
    private readonly lastMessageId: () => string | null
  ) {}

  async connect() {
    this.closedByUser = false
    const deviceId = await getDeviceId()
    this.listener.onStatus('connecting')
    const ws = new WebSocket(`${WS_URL}?deviceId=${deviceId}`)
    this.ws = ws

    ws.onopen = () => {
      this.attempt = 0
      this.listener.onStatus('open')
      this.send({ type: 'resume', conversationId: this.conversationId, lastMessageId: this.lastMessageId() })
    }
    ws.onmessage = (m) => {
      const parsed = ServerEvent.safeParse(JSON.parse(String(m.data)))
      if (parsed.success) this.listener.onEvent(parsed.data)
    }
    ws.onerror = () => {
      /* onclose follows; reconnect is scheduled there */
    }
    ws.onclose = () => {
      this.listener.onStatus('closed')
      if (!this.closedByUser) this.scheduleReconnect()
    }
  }

  /** Returns the clientMsgId so the caller can render the optimistic bubble. */
  sendMessage(content: string): string {
    const clientMsgId = randomUUID()
    this.send({ type: 'send_message', conversationId: this.conversationId, clientMsgId, content })
    return clientMsgId
  }

  close() {
    this.closedByUser = true
    if (this.timer) clearTimeout(this.timer)
    this.ws?.close()
    this.ws = null
  }

  private send(event: ClientEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event))
  }

  private scheduleReconnect() {
    const delay = Math.min(30_000, 500 * 2 ** this.attempt++)
    this.timer = setTimeout(() => void this.connect(), delay)
  }
}

export type { Message }
