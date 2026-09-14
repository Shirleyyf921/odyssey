/**
 * Last night (docs/story-pipeline.md, "Between stories", 2026-09-14). The
 * story they finished most recently, carried into the everyday turn and into
 * his first message of a new day, so a night with him is not forgotten by the
 * next one. The ending is the END beat's brief, to the actor; the choices are
 * hers, so he can hold her to them.
 */
export interface LastNight {
  title: string
  /** Whole nights since it ended. Zero is earlier tonight. */
  nightsAgo: number
  /** What she chose, in order, as the options were written. */
  choices: string[]
  /** How it ended, to the actor. */
  ending: string
}

export function renderLastNight(v: LastNight, them: string): string {
  const when = v.nightsAgo === 0 ? 'earlier tonight' : v.nightsAgo === 1 ? 'last night' : `${v.nightsAgo} nights ago`
  const chose = v.choices.length ? `\nWhat ${them} did, in order: ${v.choices.map((c) => c.toLowerCase()).join('; ')}.` : ''
  return `## Last night
You two played "${v.title}" ${when}.${chose}
How it ended (to you, never to be recited): ${v.ending}
It happened. Refer to it the way a man refers to last night: once, in passing, with what it changed, never a recap and never a review.`
}
