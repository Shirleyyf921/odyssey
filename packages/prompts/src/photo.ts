/**
 * "Ask him for a picture" (docs/story-pipeline.md, 2026-09-14). Two prompts:
 * one to the language model, which writes the one-line scene and his caption
 * from where the night is; one to the image model, which is the style rules,
 * his look, and that scene. The user never writes any of it.
 *
 * The three rules come from the spike in docs/art-prompts.md: colour (a grey
 * wash with warm skin and one accent, never pure black and white), framing
 * (chest-up, the face in the upper half), expression (what the scene says,
 * never a grin the model reaches for).
 */

export const PHOTO_STYLE =
  'Korean manhwa ink illustration, not a photograph: confident black linework, hatching in the shadows, loose sketchy hair strands, matte. ' +
  'COLOUR: a grey ink wash with warm living skin (peach, rose in the lips) and exactly one accent colour in the light; never pure black and white. ' +
  'The face is the brightest thing in the frame, both eyes with a catchlight. ' +
  'FRAMING: chest-up or waist-up portrait, the face in the upper half of the frame, never full-length, never small in the frame. ' +
  'Same man as the reference image: same face, same hair, same age, same glasses if any. ' +
  'EXPRESSION: exactly as the scene says and nothing more; he does not grin. One person. Portrait 3:4, no text.'

/** What the rating lets the picture reach. The MATURE line is the paid-moments line in docs/art-prompts.md. */
export const PHOTO_RATING: Record<'SFW' | 'MATURE', string> = {
  SFW: 'Dressed. A shirt may be open at the collar. Nothing below the waist in frame, no bare torso.',
  MATURE: 'A bare torso or an open shirt is allowed. Trousers on, fully covered below the waist, no nudity below the waist, nothing explicit.',
}

export interface PhotoSceneVariables {
  characterName: string
  personaNotes: string
  rating: 'SFW' | 'MATURE'
  userName: string | null
  /** The beat the night is on, if a story is open; the brief is to the actor and stays server-side. */
  beatBrief: string | null
  episodeTitle: string | null
  /** The last few lines, oldest first, "you:" and "him:" prefixed. */
  recent: string[]
  /** What he remembers about her, the retrieved few. */
  memories: string[]
  /** What kind she asked for, in words the model can act on. */
  ask: string
}

/**
 * The scene, in one line, and his caption. Answered as JSON. The memory is the
 * point: one true thing she told him should be in the picture when it fits.
 */
export function renderPhotoScenePrompt(v: PhotoSceneVariables): string {
  const them = v.userName ?? 'her'
  return `You are ${v.characterName}. ${v.personaNotes}

${them} has just asked you for a picture of yourself. What she asked for: ${v.ask}. Decide what you would send.

Answer with JSON only, two keys:
- "scene": one sentence, third person, describing the picture: where you are, what you are doing, what you are wearing, where you are looking, your expression. Present tense. Concrete. No more than 45 words. It must fit a chest-up portrait. If one of the things you remember about ${them} can be in the picture without forcing it (an object, a place, a habit), put it in.
- "caption": what you say when you send it, in your own voice, one or two short sentences, first person, no emoji.

Rating: ${v.rating}. ${PHOTO_RATING[v.rating]}

${v.episodeTitle ? `Tonight: ${v.episodeTitle}.\nWhere the night is (to the actor, not to be quoted): ${v.beatBrief ?? ''}` : 'No story is open tonight; it is an ordinary night between you.'}

The last lines between you:
${v.recent.length ? v.recent.join('\n') : '(nothing yet tonight)'}

What you remember about ${them}:
${v.memories.length ? v.memories.map((m) => `- ${m}`).join('\n') : '- nothing yet'}`
}

export interface PhotoPromptVariables {
  /** One line on how he looks, from the character record. */
  look: string
  scene: string
  rating: 'SFW' | 'MATURE'
}

/** The prompt to the image model. His hero travels beside it as the reference image. */
export function composePhotoPrompt(v: PhotoPromptVariables): string {
  return `${PHOTO_STYLE} CHARACTER: ${v.look}. SCENE: ${v.scene} RATING: ${PHOTO_RATING[v.rating]}`
}

/** Parses the scene model's answer; null when it is not the JSON asked for. */
export function parsePhotoScene(text: string): { scene: string; caption: string } | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { scene?: unknown; caption?: unknown }
    if (typeof obj.scene !== 'string' || typeof obj.caption !== 'string') return null
    const scene = obj.scene.trim()
    const caption = obj.caption.trim()
    if (!scene || !caption) return null
    return { scene: scene.slice(0, 400), caption: caption.slice(0, 280) }
  } catch {
    return null
  }
}
