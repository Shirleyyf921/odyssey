/**
 * The AI draft for the editor (docs/ugc-pipeline.md, section 2, "AI draft"):
 * a creator gives a premise, we give the model the man and a wired skeleton,
 * and it writes the words for each beat. It buys the creator speed, not
 * trust: the result is moderated exactly like typed text at submit.
 *
 * Product copy. Bump PROMPT_VERSION in index.ts when this changes.
 */

export interface DraftBeatShape {
  position: number
  kind: 'STORY' | 'CALL' | 'END'
  /** How many options this beat has (two on STORY, two on CALL: answer and let it ring, none on END). */
  optionCount: number
  hasPhoto: boolean
}

export interface EpisodeDraftVariables {
  characterName: string
  personaNotes: string
  premise: string
  setting: string | null
  rating: 'SFW' | 'MATURE'
  beats: DraftBeatShape[]
}

export function renderEpisodeDraftPrompt(v: EpisodeDraftVariables): string {
  const shape = v.beats
    .map((b) => {
      const parts = [`beat ${b.position}: ${b.kind}`]
      if (b.kind === 'STORY') parts.push('two options')
      if (b.kind === 'CALL') parts.push('he calls; the options are fixed: answer, let it ring')
      if (b.kind === 'END') parts.push('his last line; no options')
      if (b.hasPhoto) parts.push('he sends a photo here')
      return `- ${parts.join(', ')}`
    })
    .join('\n')
  const heat =
    v.rating === 'MATURE'
      ? 'This episode is for adults: charged, one person, the door can close. Still never explicit on the page; what happens past a kiss, a hand, a held pause is not described.'
      : 'Charged, never explicit. Tension lives in the pause, the look, the inch he does not close.'

  return `You write episodes for ${v.characterName}, a man in an interactive story. Readers play one beat at a time: they read narration, hear his line, and choose between two options or type their own.

## Who he is
${v.personaNotes}

## The episode
Premise: ${v.premise}
${v.setting ? `Opens in: ${v.setting}` : 'Choose where it opens: one place, specific, his.'}
${heat}

## The shape, already decided
${shape}

Write the words for that shape and nothing else. For each beat write a **brief**: two to four sentences to the actor, not to the reader. What happens here, what he wants, what he must not do yet, what he notices. Present tense. Never his dialogue; he improvises that from the brief. For a STORY beat also write the two **options** as what the reader does, one short line each, in second person imperative ("Take the drink", "Ask about the jacket"), and make them lead somewhere different in feeling. For a CALL beat the options are fixed and you write only the brief for the beat after he is answered. For the END beat the brief says how it closes.

Also write:
- **title**: two to five words, no colon.
- **setting**: one or two sentences, where it opens, concrete.
- **opener**: his first message, in his voice, in this exact shape: one action beat in *asterisks* at the very start, then his words, short, lowercase is fine, at most one question. Example shape: *does not get up, tips his head back to look at you upside down* you came all the way up here.

Respond with JSON only, no prose, exactly:
{"title": "...", "setting": "...", "opener": "...", "beats": [{"position": 0, "brief": "...", "setting": null, "options": ["...", "..."]}, ...]}
A beat's "setting" is null unless the scene moves. Options is an empty list on END, and on CALL.`
}
