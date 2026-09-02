import type {
  CharacterKind,
  Message,
  MessageRole,
  Relationship,
} from '@odyssey/shared'

/** Everything the chat pipeline needs to know about a conversation, in one read. */
export interface ConversationContext {
  conversation: { id: string; relationshipId: string }
  relationship: Relationship & { userId: string }
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
}
