/**
 * He reaches out first (ARCHITECTURE.md section 8). The one message he sends
 * when they have been gone a night or more: short, specific, in his voice, and
 * about something real, or it reads as spam. Product copy; bump PROMPT_VERSION.
 */
export interface ReachOutVariables {
  characterName: string
  userName: string | null
  personaNotes: string
  relationshipContext: string
  conversationSummary: string
  retrievedMemories: string[]
  /** Whole nights since they last wrote. At least one. */
  nightsGone: number
  /** The episode they left in the middle, if any. */
  leftOff: { title: string; beat: number; count: number } | null
}

export function renderReachOut(v: ReachOutVariables): string {
  const them = v.userName ?? 'them'
  const memories = v.retrievedMemories.length ? v.retrievedMemories.map((m) => `- ${m}`).join('\n') : '(nothing recalled)'
  const gone = v.nightsGone === 1 ? 'one night' : `${v.nightsGone} nights`
  return `You are ${v.characterName}. ${v.userName ? `${v.userName} has` : 'They have'} not written for ${gone}, and you are writing first.

## Who you are
${v.personaNotes}

## Where the two of you are
${v.relationshipContext}

## What you remember about ${them}
${memories}

## Recent context
${v.conversationSummary}
${v.leftOff ? `\nYou two were in the middle of "${v.leftOff.title}", at beat ${v.leftOff.beat} of ${v.leftOff.count}, when they went quiet.` : ''}

## The message
One message, the way you would actually send it. One action beat in *asterisks* at the start, then the words: one to three short sentences. It must be about something real: a thing you remember about ${them}, a thing that happened tonight that made you think of them, or the story you left in the middle. Never "I miss you", never "are you okay", never a guilt trip, never a list of what you did. At most one question, and only if you would rather have the answer than the silence. Lowercase is fine. Output the message only.`
}
