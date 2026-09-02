import { renderPrimaryPersona, renderRelationshipContext } from '@odyssey/prompts'
import type { RelationshipStage } from '@odyssey/shared'
import type { AssembledMemory } from '../memory/service.js'
import type { ChatTurn, CompletionRequest } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

export interface PromptSignals {
  previousStage: RelationshipStage | null
}

/** Assemble the prompt for one turn from the persona and the memory layers. */
export function buildCompletionRequest(
  ctx: ConversationContext,
  memory: AssembledMemory,
  signals: PromptSignals = { previousStage: null }
): CompletionRequest {
  const relationshipContext = renderRelationshipContext(ctx.relationship.stage, signals.previousStage !== null)

  const system = renderPrimaryPersona({
    characterName: ctx.character.name,
    userName: ctx.user.displayName,
    personaNotes: ctx.character.personaNotes,
    relationshipContext,
    conversationSummary: memory.summary || '(nothing before this)',
    retrievedMemories: memory.memories,
  })

  const messages: ChatTurn[] = memory.history
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }))

  return { system, messages }
}
