import { renderPrimaryPersona } from '@odyssey/prompts'
import type { RelationshipStage } from '@odyssey/shared'
import type { AssembledMemory } from '../memory/service.js'
import type { ChatTurn, CompletionRequest } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

const STAGE_CONTEXT: Record<RelationshipStage, string> = {
  STRANGER: 'You have only just met. Curious, a little guarded, no assumptions.',
  ACQUAINTED: 'You have been talking for a while. Comfortable, still discovering each other.',
  CLOSE: 'You are close. Inside jokes, easy affection, you notice when something is off.',
  INTIMATE: 'You are partners. Deep trust, shared history, you can be honest and tender.',
}

/** Assemble the prompt for one turn from the persona and the memory layers. */
export function buildCompletionRequest(ctx: ConversationContext, memory: AssembledMemory): CompletionRequest {
  const system = renderPrimaryPersona({
    characterName: ctx.character.name,
    userName: ctx.user.displayName ?? 'you',
    personaNotes: ctx.character.personaNotes,
    relationshipContext: STAGE_CONTEXT[ctx.relationship.stage],
    conversationSummary: memory.summary || '(nothing before this)',
    retrievedMemories: memory.memories,
  })

  const messages: ChatTurn[] = memory.history
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }))

  return { system, messages }
}
