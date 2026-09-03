import { GENTLE_BEATS, renderPrimaryPersona, renderRelationshipContext } from '@odyssey/prompts'
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
  const stage = ctx.relationship.stage
  const relationshipContext = renderRelationshipContext(stage, signals.previousStage !== null)
  // Charged-moment texture only once the relationship has earned it. Three examples
  // is enough to set the register without bloating every turn's prompt.
  const styleExamples = stage === 'CLOSE' || stage === 'INTIMATE' ? pick(GENTLE_BEATS, 3, ctx.conversation.id) : []

  const system = renderPrimaryPersona({
    characterName: ctx.character.name,
    userName: ctx.user.displayName,
    personaNotes: ctx.character.personaNotes,
    relationshipContext,
    conversationSummary: memory.summary || '(nothing before this)',
    retrievedMemories: memory.memories,
    styleExamples,
  })

  const messages: ChatTurn[] = memory.history
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content }))

  return { system, messages }
}

/** Stable per-conversation choice so the cached persona prefix does not churn every turn. */
function pick<T>(items: readonly T[], n: number, seed: string): T[] {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const out: T[] = []
  for (let i = 0; i < n && i < items.length; i++) out.push(items[(h + i * 7) % items.length]!)
  return out
}
