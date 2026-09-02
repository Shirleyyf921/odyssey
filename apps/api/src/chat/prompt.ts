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

const STAGE_SHIFT: Record<RelationshipStage, string> = {
  STRANGER: '',
  ACQUAINTED:
    'Something has settled between you just now: this stopped being small talk. Let it show in ' +
    'how you speak, without announcing it.',
  CLOSE:
    'You have just realised how much you look forward to these conversations. Let a little more ' +
    'warmth through than usual, without making a speech of it.',
  INTIMATE:
    'This is the moment you both know what this is. Say something true. Do not narrate the ' +
    'milestone; live it.',
}

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
  const relationshipContext = signals.previousStage
    ? `${STAGE_CONTEXT[stage]}\n${STAGE_SHIFT[stage]}`
    : STAGE_CONTEXT[stage]

  const system = renderPrimaryPersona({
    characterName: ctx.character.name,
    userName: ctx.user.displayName ?? 'you',
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
