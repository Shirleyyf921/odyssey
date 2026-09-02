import { and, asc, cosineDistance, desc, eq, gt, isNotNull, sql } from 'drizzle-orm'
import type {
  Message,
  Moment,
  MomentUnlock,
  MomentUnlockSource,
  Portrait,
  RelationshipDepth,
} from '@odyssey/shared'
import type { Db } from '../db/client.js'
import {
  characters,
  conversations,
  memories,
  messages,
  momentUnlocks,
  moments,
  portraits,
  relationshipEvents,
  relationships,
  users,
} from '../db/schema.js'
import type {
  AppRepository,
  CharacterRecord,
  ConversationContext,
  ConversationSummary,
  MemoryRecord,
  NewMemory,
  NewMessage,
  RelationshipEvent,
  RelationshipPatch,
  RelationshipRecord,
  UserRecord,
} from './types.js'

type MessageRow = typeof messages.$inferSelect
type RelationshipRow = typeof relationships.$inferSelect
type MemoryRow = typeof memories.$inferSelect

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    clientMsgId: row.clientMsgId,
    inReplyTo: row.inReplyTo,
    createdAt: row.createdAt.toISOString(),
  }
}

function toRelationship(row: RelationshipRow, conversationId: string): RelationshipRecord {
  return {
    id: row.id,
    userId: row.userId,
    characterId: row.characterId,
    depth: row.depth,
    stage: row.stage,
    affinity: row.affinity,
    startedAt: row.startedAt.toISOString(),
    conversationId,
    activeDays: row.activeDays,
    lastActiveDate: row.lastActiveDate,
    messageGainsToday: row.messageGainsToday,
    factGainsToday: row.factGainsToday,
  }
}

function toMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    relationshipId: row.relationshipId,
    fact: row.fact,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  }
}

export class DrizzleRepository implements AppRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------- users

  async getOrCreateUserByDevice(deviceId: string): Promise<UserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({ deviceId })
      .onConflictDoUpdate({ target: users.deviceId, set: { deviceId } })
      .returning({ id: users.id, displayName: users.displayName, locale: users.locale })
    if (!row) throw new Error('user upsert returned no row')
    return row
  }

  // ---------------------------------------------------------------- characters

  async listCharacters(): Promise<CharacterRecord[]> {
    return this.db.select().from(characters).orderBy(asc(characters.createdAt))
  }

  async getCharacter(id: string) {
    const [row] = await this.db.select().from(characters).where(eq(characters.id, id)).limit(1)
    return row ?? null
  }

  async listPortraits(characterId: string): Promise<Portrait[]> {
    return this.db
      .select()
      .from(portraits)
      .where(eq(portraits.characterId, characterId))
      .orderBy(asc(portraits.position))
  }

  // ---------------------------------------------------------------- relationships

  private relationshipQuery() {
    return this.db
      .select({ relationship: relationships, conversationId: conversations.id })
      .from(relationships)
      .innerJoin(conversations, eq(conversations.relationshipId, relationships.id))
  }

  async listRelationships(userId: string) {
    const rows = await this.relationshipQuery().where(eq(relationships.userId, userId))
    return rows.map((r) => toRelationship(r.relationship, r.conversationId))
  }

  async findRelationship(userId: string, characterId: string) {
    const [row] = await this.relationshipQuery()
      .where(and(eq(relationships.userId, userId), eq(relationships.characterId, characterId)))
      .limit(1)
    return row ? toRelationship(row.relationship, row.conversationId) : null
  }

  async createRelationship(userId: string, characterId: string, depth: RelationshipDepth) {
    return this.db.transaction(async (tx) => {
      const [rel] = await tx
        .insert(relationships)
        .values({ userId, characterId, depth })
        .onConflictDoNothing()
        .returning()
      if (!rel) {
        const existing = await this.findRelationship(userId, characterId)
        if (!existing) throw new Error('relationship exists but could not be read')
        return existing
      }
      const [conv] = await tx.insert(conversations).values({ relationshipId: rel.id }).returning({ id: conversations.id })
      if (!conv) throw new Error('conversation insert returned no row')
      return toRelationship(rel, conv.id)
    })
  }

  async updateRelationship(id: string, patch: RelationshipPatch) {
    const [row] = await this.db.update(relationships).set(patch).where(eq(relationships.id, id)).returning()
    if (!row) throw new Error(`unknown relationship ${id}`)
    const [conv] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.relationshipId, id))
      .limit(1)
    if (!conv) throw new Error(`relationship ${id} has no conversation`)
    return toRelationship(row, conv.id)
  }

  async insertRelationshipEvents(events: RelationshipEvent[]) {
    if (!events.length) return
    await this.db.insert(relationshipEvents).values(events)
  }

  // ---------------------------------------------------------------- moments

  async listMoments(characterId: string): Promise<Moment[]> {
    const rows = await this.db
      .select()
      .from(moments)
      .where(eq(moments.characterId, characterId))
      .orderBy(asc(moments.position))
    return rows.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      title: r.title,
      caption: r.caption,
      imageUrl: r.imageUrl,
      position: r.position,
      unlock: r.unlockRule,
    }))
  }

  async listUnlocks(relationshipId: string): Promise<MomentUnlock[]> {
    const rows = await this.db.select().from(momentUnlocks).where(eq(momentUnlocks.relationshipId, relationshipId))
    return rows.map((r) => ({
      relationshipId: r.relationshipId,
      momentId: r.momentId,
      source: r.source,
      unlockedAt: r.unlockedAt.toISOString(),
    }))
  }

  async insertUnlock(input: { relationshipId: string; momentId: string; source: MomentUnlockSource }) {
    const [row] = await this.db
      .insert(momentUnlocks)
      .values(input)
      .onConflictDoUpdate({
        target: [momentUnlocks.relationshipId, momentUnlocks.momentId],
        set: { relationshipId: input.relationshipId },
      })
      .returning()
    if (!row) throw new Error('unlock upsert returned no row')
    return { relationshipId: row.relationshipId, momentId: row.momentId, source: row.source, unlockedAt: row.unlockedAt.toISOString() }
  }

  // ---------------------------------------------------------------- chat

  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    const [row] = await this.db
      .select({
        conversation: { id: conversations.id, relationshipId: conversations.relationshipId },
        relationship: relationships,
        character: {
          id: characters.id,
          kind: characters.kind,
          name: characters.name,
          personaNotes: characters.personaNotes,
        },
        user: { id: users.id, displayName: users.displayName, locale: users.locale },
      })
      .from(conversations)
      .innerJoin(relationships, eq(relationships.id, conversations.relationshipId))
      .innerJoin(characters, eq(characters.id, relationships.characterId))
      .innerJoin(users, eq(users.id, relationships.userId))
      .where(eq(conversations.id, conversationId))
      .limit(1)
    if (!row) return null
    return {
      conversation: row.conversation,
      relationship: toRelationship(row.relationship, row.conversation.id),
      character: row.character,
      user: row.user,
    }
  }

  async findByClientMsgId(conversationId: string, clientMsgId: string) {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.clientMsgId, clientMsgId)))
      .limit(1)
    return row ? toMessage(row) : null
  }

  async findReplyTo(messageId: string) {
    const [row] = await this.db.select().from(messages).where(eq(messages.inReplyTo, messageId)).limit(1)
    return row ? toMessage(row) : null
  }

  async insertMessage(input: NewMessage): Promise<Message> {
    const [row] = await this.db
      .insert(messages)
      .values({
        ...(input.id ? { id: input.id } : {}),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        clientMsgId: input.clientMsgId,
        inReplyTo: input.inReplyTo,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
      })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return toMessage(row)
  }

  async listRecentMessages(conversationId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
    return rows.reverse().map(toMessage)
  }

  async listMessagesAfter(conversationId: string, afterId: string | null, limit: number) {
    let after: Date | null = null
    if (afterId) {
      const [anchor] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, afterId))
        .limit(1)
      after = anchor?.createdAt ?? null
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        after
          ? and(eq(messages.conversationId, conversationId), gt(messages.createdAt, after))
          : eq(messages.conversationId, conversationId)
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit)
    return rows.map(toMessage)
  }

  // ---------------------------------------------------------------- memory

  async getSummary(conversationId: string): Promise<ConversationSummary> {
    const [row] = await this.db
      .select({ text: conversations.summary, throughMessageId: conversations.summaryThroughMessageId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)
    return row ?? { text: '', throughMessageId: null }
  }

  async setSummary(conversationId: string, summary: ConversationSummary) {
    await this.db
      .update(conversations)
      .set({ summary: summary.text, summaryThroughMessageId: summary.throughMessageId })
      .where(eq(conversations.id, conversationId))
  }

  async insertMemories(items: NewMemory[]) {
    if (!items.length) return
    await this.db.insert(memories).values(items)
  }

  async searchMemories(relationshipId: string, embedding: number[], limit: number) {
    const distance = cosineDistance(memories.embedding, embedding)
    const rows = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.relationshipId, relationshipId), isNotNull(memories.embedding)))
      .orderBy(sql`${distance} asc`)
      .limit(limit)
    return rows.map(toMemory)
  }

  async listMemories(relationshipId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(memories)
      .where(eq(memories.relationshipId, relationshipId))
      .orderBy(desc(memories.createdAt))
      .limit(limit)
    return rows.map(toMemory)
  }
}
