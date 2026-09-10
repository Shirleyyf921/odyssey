import { STAGE_ORDER, type Beat, type Hotspot, type RelationshipStage } from '@odyssey/shared'

/**
 * Touch (docs/story-pipeline.md, "Stage"). Geometry lives on the portrait;
 * which hotspots are live is the beat's; whether the user has earned one is the
 * relationship's. The last is the point: the user never sees a number, they
 * notice what they are allowed to touch tonight.
 *
 * The store build has these four and nothing else. Anything below the waist
 * would exist only on the web build, on MATURE episodes, and does not exist yet.
 */
export const HOTSPOT_MIN_STAGE: Record<Hotspot, RelationshipStage> = {
  hand: 'STRANGER',
  shoulder: 'ACQUAINTED',
  hair: 'CLOSE',
  face: 'CLOSE',
}

/** What the client may show at this beat. Filtered here so the stage stays hidden. */
export function allowedHotspots(beat: Pick<Beat, 'hotspots'>, stage: RelationshipStage): Hotspot[] {
  const have = STAGE_ORDER.indexOf(stage)
  return beat.hotspots.filter((h) => have >= STAGE_ORDER.indexOf(HOTSPOT_MIN_STAGE[h]))
}

/**
 * The message text for a touch. Written by the server, never by the client, so
 * it cannot be used to smuggle text into the prompt.
 */
export const TOUCH_PHRASE: Record<Hotspot, string> = {
  hand: 'reaches out and takes his hand',
  shoulder: 'rests a hand on his shoulder',
  hair: 'pushes the hair back off his forehead',
  face: 'touches his face',
}
