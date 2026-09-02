import type {
  Character,
  CharacterKind,
  Message,
  MessageRole,
  Moment,
  MomentUnlock,
  MomentUnlockSource,
  Portrait,
  Relationship,
  RelationshipDepth,
} from '@odyssey/shared'

export interface UserRecord {
  id: string
  displayName: string | null
  locale: string
}

export interface CharacterRecord extends Character {
  personaNotes: string
}

/** Progression counters. Server-only; the client sees stage and affinity through Relationship. */
export interface RelationshipProgress {
  activeDays: number
  lastActiveDate: string | null
  messageGainsToday: number
  factGainsToday: number
}

export interface RelationshipRecord extends Relationship, RelationshipProgress {
  userId: string
  /** One conversation per relationship for now. */
  conversationId: string
}

export type RelationshipPatch = Partial<
  Pick<RelationshipRecord, 'stage' | 'affinity'> & RelationshipProgress & { stageChangedAt: Date }
>

export interface RelationshipEvent {
  relationshipId: string
  delta: number
  reason: string
}

export interface MemoryRecord {
  id: string
  relationshipId: string
  fact: string
  confidence: number
  createdAt: string
}

export interface NewMemory {
  relationshipId: string
  fact: string
  embedding: number[] | null
  confidence: number
}

export interface ConversationSummary {
  text: string
  /** Last message folded into the summary; the short-term window starts after it. */
  throughMessageId: string | null
}

/** Everything the chat pipeline needs to know about a conversation, in one read. */
export interface ConversationContext {
  conversation: { id: string; relationshipId: string }
  relationship: RelationshipRecord
  character: { id: string; kind: CharacterKind; name: string; personaNotes: string }
  user: { id: string; displayName: string | null; locale: string }
}

export interface NewMessage {
  /** Supplied by the caller for CHARACTER messages so the id can be streamed before the row exists. */
  id?: string
  conversationId: string
  role: MessageRole
  content: string
  clientMsgId: string | null
  inReplyTo: string | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
}

export interface ChatRepository {
  getConversationContext(conversationId: string): Promise<ConversationContext | null>
  findByClientMsgId(conversationId: string, clientMsgId: string): Promise<Message | null>
  /** The CHARACTER message answering the given USER message, if generation finished. */
  findReplyTo(messageId: string): Promise<Message | null>
  insertMessage(input: NewMessage): Promise<Message>
  /** Oldest first. */
  listRecentMessages(conversationId: string, limit: number): Promise<Message[]>
  /** Messages created after `afterId` (all messages when null), oldest first. */
  listMessagesAfter(conversationId: string, afterId: string | null, limit: number): Promise<Message[]>

  // mid-term memory
  getSummary(conversationId: string): Promise<ConversationSummary>
  setSummary(conversationId: string, summary: ConversationSummary): Promise<void>

  // long-term memory
  insertMemories(items: NewMemory[]): Promise<void>
  /** Nearest by cosine distance. Rows without an embedding are never returned here. */
  searchMemories(relationshipId: string, embedding: number[], limit: number): Promise<MemoryRecord[]>
  /** Most recent first. Fallback when no embedding is available. */
  listMemories(relationshipId: string, limit: number): Promise<MemoryRecord[]>
}

export interface AppRepository extends ChatRepository {
  getOrCreateUserByDevice(deviceId: string): Promise<UserRecord>

  listCharacters(): Promise<CharacterRecord[]>
  getCharacter(id: string): Promise<CharacterRecord | null>
  listPortraits(characterId: string): Promise<Portrait[]>

  listRelationships(userId: string): Promise<RelationshipRecord[]>
  findRelationship(userId: string, characterId: string): Promise<RelationshipRecord | null>
  /** Creates the relationship and its conversation. */
  createRelationship(userId: string, characterId: string, depth: RelationshipDepth): Promise<RelationshipRecord>
  updateRelationship(id: string, patch: RelationshipPatch): Promise<RelationshipRecord>
  insertRelationshipEvents(events: RelationshipEvent[]): Promise<void>

  listMoments(characterId: string): Promise<Moment[]>
  listUnlocks(relationshipId: string): Promise<MomentUnlock[]>
  insertUnlock(input: { relationshipId: string; momentId: string; source: MomentUnlockSource }): Promise<MomentUnlock>
}
