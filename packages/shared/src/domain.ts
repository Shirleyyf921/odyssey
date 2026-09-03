import { z } from 'zod'

/**
 * A character the user can talk to.
 *
 * PRIMARY is the dedicated boyfriend — one per user. EXPLORE characters are the
 * curated roster. The distinction drives memory strategy and capability tiering;
 * see ARCHITECTURE.md section 1.
 */
export const CharacterKind = z.enum(['PRIMARY', 'EXPLORE'])
export type CharacterKind = z.infer<typeof CharacterKind>

/**
 * Memory depth for a user-character relationship.
 *
 * DEEP runs all four memory layers. LIGHT runs short-term and rolling summary only,
 * skipping fact extraction and vector retrieval — roughly a third of the per-message
 * cost. See ARCHITECTURE.md section 4.
 */
export const RelationshipDepth = z.enum(['DEEP', 'LIGHT'])
export type RelationshipDepth = z.infer<typeof RelationshipDepth>

export const RelationshipStage = z.enum([
  'STRANGER',
  'ACQUAINTED',
  'CLOSE',
  'INTIMATE',
])
export type RelationshipStage = z.infer<typeof RelationshipStage>

/** Ordered so stages can be compared for unlock rules. */
export const STAGE_ORDER: readonly RelationshipStage[] = [
  'STRANGER',
  'ACQUAINTED',
  'CLOSE',
  'INTIMATE',
]

export const MessageRole = z.enum(['USER', 'CHARACTER', 'SYSTEM'])
export type MessageRole = z.infer<typeof MessageRole>

export const Character = z.object({
  id: z.string().uuid(),
  kind: CharacterKind,
  name: z.string().min(1).max(40),
  tagline: z.string().max(140),
  avatarUrl: z.string().url().nullable(),
  voiceId: z.string().nullable(),
})
export type Character = z.infer<typeof Character>

/**
 * Identity image. Produced offline and shown on the character page.
 *
 * Never generated at runtime: the face has to be the same every time, and runtime
 * generation cannot promise that for a face the user has not seen a hundred times.
 * See ARCHITECTURE.md section 14.
 */
export const Portrait = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  url: z.string().url(),
  /** Display order on the character page. */
  position: z.number().int().min(0),
  /** Optional caption such as "casual" or "at the bar"; the client decides how to show it. */
  label: z.string().max(40).nullable(),
})
export type Portrait = z.infer<typeof Portrait>

export const CharacterProfile = Character.extend({
  portraits: z.array(Portrait),
})
export type CharacterProfile = z.infer<typeof CharacterProfile>

export const Relationship = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  depth: RelationshipDepth,
  stage: RelationshipStage,
  /** 0-100. Internal signal; deliberately not surfaced as a raw number in the UI. */
  affinity: z.number().int().min(0).max(100),
  startedAt: z.string().datetime(),
})
export type Relationship = z.infer<typeof Relationship>

export const Message = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
  /** Client-generated, for idempotent delivery across reconnects. */
  clientMsgId: z.string().uuid().nullable(),
  /** For CHARACTER messages: the USER message this answers. Lets a retried send replay its reply. */
  inReplyTo: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})
export type Message = z.infer<typeof Message>

// ---------------------------------------------------------------- scenes

/**
 * Where a conversation happens. A scene is a setting line the persona reads, the
 * character's opening message (his first line, in the beat-plus-speech shape,
 * which also fixes his register for everything after), and a backdrop image
 * that is the visual of that setting. Curated, produced offline, like portraits.
 * See ARCHITECTURE.md section 14.
 */
export const Scene = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string().min(1).max(60),
  /** One or two sentences the persona reads as "where you are". */
  setting: z.string().min(1).max(400),
  /** His first message. Inserted into the conversation when it starts. */
  opener: z.string().min(1).max(600),
  /** Null until the art exists. */
  backdropUrl: z.string().url().nullable(),
  position: z.number().int().min(0),
})
export type Scene = z.infer<typeof Scene>

// ---------------------------------------------------------------- moments

/**
 * How a collectible image is unlocked.
 *
 * STAGE and AFFINITY are earned through the relationship. PURCHASE is a consumable:
 * images are the one place metering does not corrode the fiction, because "he sent
 * you a photo" is a discrete act the user can pay for without feeling billed per
 * sentence. See ARCHITECTURE.md sections 7 and 14.
 */
export const MomentUnlockRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FREE') }),
  z.object({ kind: z.literal('STAGE'), stage: RelationshipStage }),
  z.object({ kind: z.literal('AFFINITY'), min: z.number().int().min(0).max(100) }),
  z.object({ kind: z.literal('PURCHASE'), sku: z.string().min(1) }),
])
export type MomentUnlockRule = z.infer<typeof MomentUnlockRule>

export const MomentUnlockSource = z.enum([
  'FREE',
  'STAGE',
  'AFFINITY',
  'PURCHASE',
  /** Manual grant: support, promotions, testing. */
  'GRANT',
])
export type MomentUnlockSource = z.infer<typeof MomentUnlockSource>

/** Collectible image. Curated and produced offline, like portraits. Server-side shape. */
export const Moment = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string().min(1).max(80),
  /** Written in the character's voice, revealed with the image. */
  caption: z.string().max(280),
  imageUrl: z.string().url(),
  position: z.number().int().min(0),
  unlock: MomentUnlockRule,
})
export type Moment = z.infer<typeof Moment>

/**
 * What the client is allowed to see.
 *
 * imageUrl and caption are null while locked. Enforced when the card is built, not
 * in the client — a locked card must not carry the asset URL at all.
 */
export const MomentCard = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string(),
  position: z.number().int().min(0),
  unlock: MomentUnlockRule,
  status: z.enum(['LOCKED', 'UNLOCKED']),
  imageUrl: z.string().url().nullable(),
  caption: z.string().nullable(),
  unlockedAt: z.string().datetime().nullable(),
})
export type MomentCard = z.infer<typeof MomentCard>

export const MomentUnlock = z.object({
  momentId: z.string().uuid(),
  relationshipId: z.string().uuid(),
  source: MomentUnlockSource,
  unlockedAt: z.string().datetime(),
})
export type MomentUnlock = z.infer<typeof MomentUnlock>
