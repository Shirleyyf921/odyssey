import { create } from 'zustand'
import type { Message, ServerEvent } from '@odyssey/shared'
import type { SocketStatus } from '../lib/socket'
import { usePaywall } from './paywall'

export interface PendingMessage {
  clientMsgId: string
  content: string
}

export interface Streaming {
  messageId: string
  /** Raw text for a chat turn; for a story turn, rebuilt from the sections so one renderer handles both. */
  text: string
  narration: string
  line: string
}

/** Story mode: he is calling. Cleared when the user answers or lets it ring. */
export interface Ringing {
  characterName: string
  audioUrl: string | null
  seconds: number | null
  silent: 'NONE' | 'NOT_RENDERED' | 'NEEDS_PLUS'
}

/** Story mode: what the user can do after his last line. */
export interface Choices {
  messageId: string
  options: string[]
  beat: { position: number; count: number; kind: 'STORY' | 'CALL' | 'END'; hotspots: string[] }
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
  choices: Choices | null
  ringing: Ringing | null
  /** Title of the open episode, for the header; null outside story mode. */
  episodeTitle: string | null
}

interface ChatStore {
  status: SocketStatus
  conversations: Record<string, ConversationState>
  setStatus(status: SocketStatus): void
  addPending(conversationId: string, pending: PendingMessage, keepChoices?: boolean): void
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
  choices: null,
  ringing: null,
  episodeTitle: null,
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

  addPending: (conversationId, pending, keepChoices = false) =>
    set((s) => {
      const c = s.conversations[conversationId] ?? empty()
      // Sending answers the last choices; the next ones arrive with his reply. A touch
      // does not: the beat has not moved, so the same options are still standing.
      return {
        conversations: {
          ...s.conversations,
          [conversationId]: { ...c, pending: [...c.pending, pending], error: null, choices: keepChoices ? c.choices : null, ringing: keepChoices ? c.ringing : null },
        },
      }
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
          next = { ...c, streaming: { messageId: event.messageId, text: '', narration: '', line: '' } }
          break
        case 'message_delta':
          if (c.streaming?.messageId === event.messageId) {
            const st = c.streaming
            if (event.section === 'narration') {
              const narration = st.narration + event.delta
              next = { ...c, streaming: { ...st, narration, text: `[narration]\n${narration}\n[line]\n${st.line}` } }
            } else if (event.section === 'line') {
              const line = st.line + event.delta
              next = { ...c, streaming: { ...st, line, text: st.narration ? `[narration]\n${st.narration}\n[line]\n${line}` : line } }
            } else {
              next = { ...c, streaming: { ...st, text: st.text + event.delta } }
            }
          }
          break
        case 'message_end':
          next = { ...c, streaming: null, messages: merge(c.messages, [event.message]) }
          break
        case 'proactive_message':
          next = { ...c, messages: merge(c.messages, [event.message]) }
          break
        case 'moment_offer':
          // The photo bubble reads its card from the moments query; the screen refetches on this event.
          next = { ...c, messages: merge(c.messages, [event.message]) }
          break
        case 'safety_intervention':
          next = { ...c, streaming: null, pending: [], intervention: { body: event.body, resources: event.resources } }
          break
        case 'error':
          // A quota refusal happened before the message was stored: drop its bubble, and this is the moment for Plus.
          next = { ...c, streaming: null, error: event.message, pending: event.code === 'QUOTA_EXCEEDED' ? [] : c.pending }
          if (event.code === 'QUOTA_EXCEEDED') usePaywall.getState().open('CAP')
          break
        case 'relationship_updated':
          if (event.previousStage) {
            const text = STAGE_TEXT[event.relationship.stage] ?? `Now ${event.relationship.stage.toLowerCase()}.`
            next = { ...c, notices: [...c.notices, { key: `stage-${event.relationship.stage}`, text, at: new Date().toISOString() }] }
          }
          break
        case 'choices':
          next = { ...c, choices: { messageId: event.messageId, options: event.options, beat: event.beat } }
          break
        case 'incoming_call':
          next = { ...c, ringing: { characterName: event.characterName, audioUrl: event.audioUrl, seconds: event.seconds, silent: event.silent } }
          break
        case 'episode_started':
          next = {
            ...c,
            episodeTitle: event.episode.title,
            messages: event.message ? merge(c.messages, [event.message]) : c.messages,
          }
          break
        case 'episode_ended':
          next = { ...c, choices: null, ringing: null, episodeTitle: null, notices: [...c.notices, { key: `end-${event.episodeId}`, text: 'End of tonight.', at: new Date().toISOString() }] }
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
