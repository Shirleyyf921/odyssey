import { and, asc, desc, eq, gt } from 'drizzle-orm'
import type { Message } from '@odyssey/shared'
import type { Db } from '../db/client.js'
import { characters, conversations, messages, relationships, users } from '../db/schema.js'
import type { ChatRepository, ConversationContext, NewMessage } from './types.js'

type MessageRow = typeof messages.$inferSelect

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

export class DrizzleRepository implements ChatRepository {
  constructor(private readonly db: Db) {}

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
      relationship: {
        id: row.relationship.id,
        userId: row.relationship.userId,
        characterId: row.relationship.characterId,
        depth: row.relationship.depth,
        stage: row.relationship.stage,
        affinity: row.relationship.affinity,
        startedAt: row.relationship.startedAt.toISOString(),
      },
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
    const [row] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.inReplyTo, messageId))
      .limit(1)
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
}
