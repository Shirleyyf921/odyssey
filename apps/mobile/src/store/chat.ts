import { create } from 'zustand'
import type { Message, ServerEvent } from '@odyssey/shared'
import type { SocketStatus } from '../lib/socket'

export interface PendingMessage {
  clientMsgId: string
  content: string
}

export interface Streaming {
  messageId: string
  text: string
}

export interface Intervention {
  body: string
  resources: Array<{ label: string; phone: string | null; url: string | null; region: string }>
}

/** Out-of-band moments rendered inline: a stage change, a new moment. */
export interface Notice {
  key: string
  text: string
  at: string
}

interface ConversationState {
  messages: Message[]
  notices: Notice[]
  /** Sent, not yet acknowledged by a history/message_end carrying its clientMsgId. */
  pending: PendingMessage[]
  streaming: Streaming | null
  intervention: Intervention | null
  error: string | null
}

interface ChatStore {
  status: SocketStatus
  conversations: Record<string, ConversationState>
  setStatus(status: SocketStatus): void
  addPending(conversationId: string, pending: PendingMessage): void
  dismissIntervention(conversationId: string): void
  apply(conversationId: string, event: ServerEvent): void
  lastMessageId(conversationId: string): string | null
}

const STAGE_TEXT: Record<string, string> = {
  ACQUAINTED: 'Something shifted. You know each other now.',
  CLOSE: "You've grown close.",
  INTIMATE: 'This is something real.',
}

const empty = (): ConversationState => ({
  messages: [],
  notices: [],
  pending: [],
  streaming: null,
  intervention: null,
  error: null,
})

function merge(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export const useChatStore = create<ChatStore>((set, get) => ({
  status: 'closed',
  conversations: {},

  setStatus: (status) => set({ status }),

  addPending: (conversationId, pending) =>
    set((s) => {
      const c = s.conversations[conversationId] ?? empty()
      return { conversations: { ...s.conversations, [conversationId]: { ...c, pending: [...c.pending, pending], error: null } } }
    }),

  dismissIntervention: (conversationId) =>
    set((s) => {
      const c = s.conversations[conversationId] ?? empty()
      return { conversations: { ...s.conversations, [conversationId]: { ...c, intervention: null } } }
    }),

  lastMessageId: (conversationId) => get().conversations[conversationId]?.messages.at(-1)?.id ?? null,

  apply: (conversationId, event) =>
    set((s) => {
      const c = s.conversations[conversationId] ?? empty()
      let next: ConversationState = c
      switch (event.type) {
        case 'history': {
          const acked = new Set(event.messages.map((m) => m.clientMsgId).filter(Boolean))
          next = {
            ...c,
            messages: merge(c.messages, event.messages),
            pending: c.pending.filter((p) => !acked.has(p.clientMsgId)),
          }
          break
        }
        case 'message_ack':
          next = {
            ...c,
            messages: merge(c.messages, [event.message]),
            pending: c.pending.filter((p) => p.clientMsgId !== event.clientMsgId),
          }
          break
        case 'message_start':
          next = { ...c, streaming: { messageId: event.messageId, text: '' } }
          break
        case 'message_delta':
          if (c.streaming?.messageId === event.messageId) {
            next = { ...c, streaming: { ...c.streaming, text: c.streaming.text + event.delta } }
          }
          break
        case 'message_end':
          next = { ...c, streaming: null, messages: merge(c.messages, [event.message]) }
          break
        case 'proactive_message':
          next = { ...c, messages: merge(c.messages, [event.message]) }
          break
        case 'safety_intervention':
          next = { ...c, streaming: null, pending: [], intervention: { body: event.body, resources: event.resources } }
          break
        case 'error':
          next = { ...c, streaming: null, error: event.message }
          break
        case 'relationship_updated':
          if (event.previousStage) {
            const text = STAGE_TEXT[event.relationship.stage] ?? `Now ${event.relationship.stage.toLowerCase()}.`
            next = { ...c, notices: [...c.notices, { key: `stage-${event.relationship.stage}`, text, at: new Date().toISOString() }] }
          }
          break
        case 'moment_unlocked':
          next = {
            ...c,
            notices: [
              ...c.notices,
              { key: `moment-${event.moment.id}`, text: `New moment unlocked: ${event.moment.title}`, at: new Date().toISOString() },
            ],
          }
          break
      }
      return { conversations: { ...s.conversations, [conversationId]: next } }
    }),
}))
