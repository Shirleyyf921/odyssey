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
  createdAt: z.string().datetime(),
})
export type Message = z.infer<typeof Message>
