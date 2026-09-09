import { z } from 'zod'
import { BeatKind, EpisodeCard, Hotspot, Message, MomentCard, Relationship, RelationshipStage } from './domain.js'
import { StorySection } from './story.js'

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
  /**
   * Story mode: the index of the option chosen from the last `choices` event.
   * `content` is the option text; the server resolves where it leads. Absent
   * means free text, which stays on the current beat.
   */
  choice: z.number().int().min(0).max(1).optional(),
  /**
   * Story mode: the user touched him here. The server writes the message text
   * itself, answers with one line, and stays on the beat. Only hotspots the
   * last `choices` event listed are accepted.
   */
  touch: Hotspot.optional(),
})

/** Story mode: start or resume an episode in this conversation. Story pipeline, runtime. */
export const StartEpisode = z.object({
  type: z.literal('start_episode'),
  conversationId: z.string().uuid(),
  episodeId: z.string().uuid(),
})

export const Resume = z.object({
  type: z.literal('resume'),
  conversationId: z.string().uuid(),
  /** Last message the client has; server replays anything newer. */
  lastMessageId: z.string().uuid().nullable(),
})

export const ClientEvent = z.discriminatedUnion('type', [SendMessage, Resume, StartEpisode])
export type ClientEvent = z.infer<typeof ClientEvent>

// ---------------------------------------------------------------- server → client

/**
 * The user's message was stored. Carries the server-side row so the client can
 * replace its optimistic bubble with the real thing before the reply starts.
 */
export const MessageAck = z.object({
  type: z.literal('message_ack'),
  clientMsgId: z.string().uuid(),
  message: Message,
})

export const MessageStart = z.object({
  type: z.literal('message_start'),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
})

export const MessageDelta = z.object({
  type: z.literal('message_delta'),
  messageId: z.string().uuid(),
  delta: z.string(),
  /** Story turns only: which section this delta belongs to. Markers never travel. */
  section: StorySection.optional(),
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

/**
 * Story mode: after his line, what the user can do next. Two authored options;
 * free text is always allowed too. `beat` is where they are, for the stage.
 */
export const Choices = z.object({
  type: z.literal('choices'),
  conversationId: z.string().uuid(),
  /** The CHARACTER message these follow. */
  messageId: z.string().uuid(),
  options: z.array(z.string().min(1)).max(2),
  beat: z.object({
    /** 1-based. */
    position: z.number().int().min(1),
    count: z.number().int().min(1),
    kind: BeatKind,
    hotspots: z.array(Hotspot),
  }),
})

/** Story mode: the episode is open in this conversation, with his opener already in the history. */
export const EpisodeStarted = z.object({
  type: z.literal('episode_started'),
  conversationId: z.string().uuid(),
  episode: EpisodeCard,
  /** Resumed runs carry no message; the history already has it. */
  message: Message.nullable(),
})

export const EpisodeEnded = z.object({
  type: z.literal('episode_ended'),
  conversationId: z.string().uuid(),
  episodeId: z.string().uuid(),
})

/**
 * The relationship moved. No longer sent (2026-09-09): the relationship runs
 * behind the story and never surfaces as a number or a notice. Kept in the
 * schema so older clients still parse.
 */
export const RelationshipUpdated = z.object({
  type: z.literal('relationship_updated'),
  relationship: Relationship,
  previousStage: RelationshipStage.nullable(),
})

/** A collectible image became available — see ARCHITECTURE.md section 14. */
export const MomentUnlocked = z.object({
  type: z.literal('moment_unlocked'),
  relationshipId: z.string().uuid(),
  moment: MomentCard,
})

/**
 * He sent a photo. The message is already in the conversation (content is his
 * caption); the card says whether it is his to give or theirs to unlock. Sent
 * after the reply on the turn it happens. See ARCHITECTURE.md section 14.
 */
export const MomentOffer = z.object({
  type: z.literal('moment_offer'),
  message: Message,
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
  MessageAck,
  MessageStart,
  MessageDelta,
  MessageEnd,
  History,
  RelationshipUpdated,
  MomentUnlocked,
  MomentOffer,
  Choices,
  EpisodeStarted,
  EpisodeEnded,
  ProactiveMessage,
  SafetyIntervention,
  ServerError,
])
export type ServerEvent = z.infer<typeof ServerEvent>
