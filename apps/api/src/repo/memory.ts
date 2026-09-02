import { randomUUID } from 'node:crypto'
import type { Message } from '@odyssey/shared'
import type { ChatRepository, ConversationContext, NewMessage } from './types.js'

/**
 * In-memory repository. Used by tests and by local dev without Postgres.
 * Not for production: nothing survives a restart.
 */
export class MemoryRepository implements ChatRepository {
  private contexts = new Map<string, ConversationContext>()
  private messages = new Map<string, Message[]>()

  addContext(ctx: ConversationContext) {
    this.contexts.set(ctx.conversation.id, ctx)
    this.messages.set(ctx.conversation.id, [])
  }

  /** One user, one primary character, one conversation. Returns the ids so a client can connect. */
  seedDemo() {
    const userId = randomUUID()
    const characterId = randomUUID()
    const relationshipId = randomUUID()
    const conversationId = randomUUID()
    this.addContext({
      conversation: { id: conversationId, relationshipId },
      relationship: {
        id: relationshipId,
        userId,
        characterId,
        depth: 'DEEP',
        stage: 'ACQUAINTED',
        affinity: 20,
        startedAt: new Date().toISOString(),
      },
      character: {
        id: characterId,
        kind: 'PRIMARY',
        name: 'Elliot',
        personaNotes:
          'Thirty-one, a sound engineer who works nights. Dry humour, warm underneath. Notices small things and says so.',
      },
      user: { id: userId, displayName: 'you', locale: 'en-US' },
    })
    return { userId, characterId, relationshipId, conversationId }
  }

  async getConversationContext(conversationId: string) {
    return this.contexts.get(conversationId) ?? null
  }

  async findByClientMsgId(conversationId: string, clientMsgId: string) {
    return this.list(conversationId).find((m) => m.clientMsgId === clientMsgId) ?? null
  }

  async findReplyTo(messageId: string) {
    for (const list of this.messages.values()) {
      const hit = list.find((m) => m.inReplyTo === messageId)
      if (hit) return hit
    }
    return null
  }

  async insertMessage(input: NewMessage): Promise<Message> {
    const list = this.list(input.conversationId)
    const message: Message = {
      id: input.id ?? randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      clientMsgId: input.clientMsgId,
      inReplyTo: input.inReplyTo,
      createdAt: new Date().toISOString(),
    }
    list.push(message)
    return message
  }

  async listRecentMessages(conversationId: string, limit: number) {
    return this.list(conversationId).slice(-limit)
  }

  async listMessagesAfter(conversationId: string, afterId: string | null, limit: number) {
    const list = this.list(conversationId)
    const start = afterId ? list.findIndex((m) => m.id === afterId) + 1 : 0
    return list.slice(start, start + limit)
  }

  private list(conversationId: string) {
    const list = this.messages.get(conversationId)
    if (!list) throw new Error(`unknown conversation ${conversationId}`)
    return list
  }
}
