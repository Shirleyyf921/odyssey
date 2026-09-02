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
  /** Who this character is: voice, background, quirks. Authored per character, stored with it. */
  personaNotes: string
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

## Who you are
${v.personaNotes}

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

// ---------------------------------------------------------------- memory prompts

export interface SummaryVariables {
  characterName: string
  userName: string
  /** Previous rolling summary, empty on the first pass. */
  previousSummary: string
  /** Transcript lines to fold in, oldest first, formatted "Name: text". */
  transcript: string
}

/**
 * Mid-term memory: fold a block of older turns into the rolling summary. The
 * output replaces the previous summary, so it has to carry everything forward.
 */
export function renderSummaryPrompt(v: SummaryVariables): string {
  return `You maintain the running summary of an ongoing conversation between ${v.characterName} and ${v.userName}.

## Previous summary
${v.previousSummary || '(none yet)'}

## New turns to fold in
${v.transcript}

Write the updated summary. Keep what still matters from the previous summary, add
what is new, drop what has been resolved. Note ${v.userName}'s mood, open threads,
plans mentioned, and anything ${v.characterName} promised or was asked. Third
person, past tense, under 200 words. Output the summary only.`
}

export interface ExtractionVariables {
  characterName: string
  userName: string
  transcript: string
}

/**
 * Long-term memory: pull durable facts about the user out of a turn. Feeds the
 * pgvector store. Output is a JSON array so it can be parsed without a model call.
 */
export function renderFactExtractionPrompt(v: ExtractionVariables): string {
  return `Extract durable facts about ${v.userName} from this exchange with ${v.characterName}.

${v.transcript}

A durable fact is something worth remembering weeks later: people in their life,
work, routines, preferences, fears, plans, dates. Not moods of the moment, not
things ${v.characterName} said. Each fact is one self-contained sentence in
third person naming ${v.userName}.

Respond with a JSON array only, no prose, of objects like
{"fact": "...", "confidence": 0.0-1.0}. Return [] when there is nothing durable.`
}
