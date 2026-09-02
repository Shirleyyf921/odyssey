import { z } from 'zod'
import { Message, MomentCard } from './domain.js'

/**
 * WebSocket wire protocol.
 *
 * WebSocket over SSE because proactive messaging needs a persistent connection
 * anyway, and React Native's fetch cannot stream response bodies.
 * See ARCHITECTURE.md section 3.
 */

// ---------------------------------------------------------------- client → server

export const SendMessage = z.object({
  type: z.literal('send_message'),
  conversationId: z.string().uuid(),
  /** Generated client-side so reconnect-and-retry never duplicates a message. */
  clientMsgId: z.string().uuid(),
  content: z.string().min(1).max(4000),
})

export const Resume = z.object({
  type: z.literal('resume'),
  conversationId: z.string().uuid(),
  /** Last message the client has; server replays anything newer. */
  lastMessageId: z.string().uuid().nullable(),
})

export const ClientEvent = z.discriminatedUnion('type', [SendMessage, Resume])
export type ClientEvent = z.infer<typeof ClientEvent>

// ---------------------------------------------------------------- server → client

export const MessageStart = z.object({
  type: z.literal('message_start'),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
})

export const MessageDelta = z.object({
  type: z.literal('message_delta'),
  messageId: z.string().uuid(),
  delta: z.string(),
})

export const MessageEnd = z.object({
  type: z.literal('message_end'),
  messageId: z.string().uuid(),
  message: Message,
})

/**
 * Reply to `resume`: everything newer than what the client had, oldest first.
 * Also sent for a `send_message` whose clientMsgId was already answered, so a
 * reconnect-and-retry gets the original reply instead of a second generation.
 */
export const History = z.object({
  type: z.literal('history'),
  conversationId: z.string().uuid(),
  messages: z.array(Message),
})

/** A collectible image became available — see ARCHITECTURE.md section 14. */
export const MomentUnlocked = z.object({
  type: z.literal('moment_unlocked'),
  relationshipId: z.string().uuid(),
  moment: MomentCard,
})

/** Delivered outside a request/response turn — see ARCHITECTURE.md section 8. */
export const ProactiveMessage = z.object({
  type: z.literal('proactive_message'),
  message: Message,
})

/**
 * Crisis intervention.
 *
 * A distinct event type rather than an ordinary message, because the client MUST
 * render it outside the character's voice. The fiction breaks here by design —
 * see ARCHITECTURE.md section 12.
 */
export const SafetyIntervention = z.object({
  type: z.literal('safety_intervention'),
  conversationId: z.string().uuid(),
  /** Pre-scripted, never generated. */
  body: z.string(),
  resources: z.array(
    z.object({
      label: z.string(),
      phone: z.string().nullable(),
      url: z.string().url().nullable(),
      region: z.string(),
    })
  ),
})

export const ServerError = z.object({
  type: z.literal('error'),
  code: z.enum([
    'UNAUTHORIZED',
    'RATE_LIMITED',
    'QUOTA_EXCEEDED',
    'UPSTREAM_UNAVAILABLE',
    'INVALID_PAYLOAD',
    'INTERNAL',
  ]),
  message: z.string(),
})

export const ServerEvent = z.discriminatedUnion('type', [
  MessageStart,
  MessageDelta,
  MessageEnd,
  History,
  MomentUnlocked,
  ProactiveMessage,
  SafetyIntervention,
  ServerError,
])
export type ServerEvent = z.infer<typeof ServerEvent>
