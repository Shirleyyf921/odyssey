import { renderPrimaryPersona } from '@odyssey/prompts'
import type { Message, RelationshipStage } from '@odyssey/shared'
import type { ChatTurn, CompletionRequest } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

/** How many verbatim turns the short-term layer carries. Mid-term summary takes over past this. */
export const SHORT_TERM_TURNS = 20

const STAGE_CONTEXT: Record<RelationshipStage, string> = {
  STRANGER: 'You have only just met. Curious, a little guarded, no assumptions.',
  ACQUAINTED: 'You have been talking for a while. Comfortable, still discovering each other.',
  CLOSE: 'You are close. Inside jokes, easy affection, you notice when something is off.',
  INTIMATE: 'You are partners. Deep trust, shared history, you can be honest and tender.',
}

/**
 * Assemble the prompt for one turn. Only the short-term layer is wired: summary and
 * retrieved memories are placeholders until ARCHITECTURE.md section 4 lands.
 */
export function buildCompletionRequest(
  ctx: ConversationContext,
  history: Message[]
): CompletionRequest {
  const system = renderPrimaryPersona({
    characterName: ctx.character.name,
    userName: ctx.user.displayName ?? 'you',
    personaNotes: ctx.character.personaNotes,
    relationshipContext: STAGE_CONTEXT[ctx.relationship.stage],
    conversationSummary: '(no summary yet)',
    retrievedMemories: [],
  })

  const messages: ChatTurn[] = history
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }))

  return { system, messages }
}
