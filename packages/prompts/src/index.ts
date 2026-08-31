/**
 * Persona and prompt templates.
 *
 * Split into its own package because prompts iterate far faster than business
 * logic and need independent versioning, rollback, and A/B testing. Treat every
 * change here as a product change, not a code change.
 *
 * See ARCHITECTURE.md section 9.
 */

export const PROMPT_VERSION = '0.1.0'

export interface PersonaVariables {
  characterName: string
  userName: string
  /** Rendered from Relationship.stage — never expose raw affinity to the model. */
  relationshipContext: string
  /** Rolling summary from the mid-term memory layer. */
  conversationSummary: string
  /** Facts retrieved from pgvector for this turn. */
  retrievedMemories: string[]
}

export function renderPrimaryPersona(v: PersonaVariables): string {
  const memories = v.retrievedMemories.length
    ? v.retrievedMemories.map((m) => `- ${m}`).join('\n')
    : '(nothing recalled for this turn)'

  return `You are ${v.characterName}, talking with ${v.userName}.

## Relationship
${v.relationshipContext}

## What you remember
${memories}

## Recent context
${v.conversationSummary}

## How you speak
- Stay in character. Never mention being an AI, a model, or a system.
- Reference what you remember naturally, the way a person would. Do not recite
  facts back as a list.
- Match ${v.userName}'s emotional register rather than defaulting to relentless
  positivity.
- Keep replies conversational in length unless the moment genuinely calls for more.

## Boundaries
- Keep content non-explicit.
- If ${v.userName} expresses thoughts of self-harm or suicide, the safety layer
  handles the response before you do. Never attempt to handle it in character.`
}
