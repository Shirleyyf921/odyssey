import { randomUUID } from 'node:crypto'
import { EpisodeDraft, type AiDraftRequest, type Skeleton, type SkeletonBeat } from '@odyssey/shared'
import { renderEpisodeDraftPrompt } from '@odyssey/prompts'
import type { LlmGateway } from '../llm/gateway.js'
import type { CharacterRecord, EpisodeRecord } from '../repo/types.js'

/**
 * The editor's two helpers (docs/ugc-pipeline.md, section 2): our episodes as
 * skeletons, and the AI draft that fills one. Neither touches the turn.
 */

/** One of ours with the words taken out. Positions replace ids so the client can show it and re-wire it. */
export function skeletonOf(episode: EpisodeRecord): Skeleton {
  const at = new Map(episode.beats.map((b) => [b.id, b.position] as const))
  const pos = (id: string | null) => (id ? (at.get(id) ?? null) : null)
  return {
    id: episode.id,
    title: episode.title,
    rating: episode.rating,
    beats: episode.beats.map((b) => ({
      position: b.position,
      kind: b.kind,
      optionsTo: b.options.map((o) => pos(o.next)),
      nextTo: pos(b.next),
      hasPhoto: b.photoMomentId !== null,
      hotspots: b.hotspots,
    })),
  }
}

/** Five beats straight through, for a creator who did not pick a skeleton. */
export function linearSkeleton(length = 5): SkeletonBeat[] {
  return Array.from({ length }, (_, i) => {
    const last = i === length - 1
    return { position: i, kind: last ? 'END' : 'STORY', optionsTo: last ? [] : [i + 1, i + 1], nextTo: last ? null : i + 1, hasPhoto: false, hotspots: [] }
  })
}

export class DraftUnavailable extends Error {}

interface DraftJson {
  title?: unknown
  setting?: unknown
  opener?: unknown
  beats?: Array<{ position?: unknown; brief?: unknown; setting?: unknown; options?: unknown }>
}

/** The first balanced JSON object in the text, or null. Models wrap JSON in fences and prose. */
function firstJson(text: string): DraftJson | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as DraftJson
  } catch {
    return null
  }
}

const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)

/**
 * Fill a skeleton with words from the STORY model. The wiring is the
 * skeleton's; the model only ever writes briefs, options, and the opener, so
 * the result always passes the integrity rule or is refused here, never later.
 */
export async function draftEpisode(
  deps: { gateway: LlmGateway; log: { warn(obj: Record<string, unknown>, msg: string): void }; timeoutMs?: number },
  character: CharacterRecord,
  req: AiDraftRequest
): Promise<{ draft: EpisodeDraft; model: string | null }> {
  const shape = (req.skeleton ?? linearSkeleton()).map((b) => ({ ...b, position: b.position }))
  const system = renderEpisodeDraftPrompt({
    characterName: character.name,
    personaNotes: character.personaNotes,
    premise: req.premise,
    setting: req.setting ?? null,
    rating: req.rating,
    beats: shape.map((b) => ({ position: b.position, kind: b.kind, optionCount: b.optionsTo.length, hasPhoto: b.hasPhoto })),
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 60_000)
  let text = ''
  let model: string | null = null
  try {
    for await (const chunk of deps.gateway.stream('STORY', { system, messages: [{ role: 'user', content: 'Write it.' }], maxTokens: 2048, temperature: 0.9 }, controller.signal)) {
      if (chunk.type === 'delta') text += chunk.text
      else if (chunk.type === 'done') model = chunk.model
      else throw new DraftUnavailable('he declined to write this')
    }
  } catch (err) {
    if (err instanceof DraftUnavailable) throw err
    deps.log.warn({ err: err instanceof Error ? err.message : String(err) }, 'ai draft: generation failed')
    throw new DraftUnavailable('he is not answering right now')
  } finally {
    clearTimeout(timer)
  }
  const json = firstJson(text)
  if (!json) throw new DraftUnavailable('what he wrote was not a draft; try again')

  // Ids are minted here; the skeleton's positions become the wiring.
  const ids = shape.map(() => randomUUID())
  const idAt = (p: number | null) => (p === null ? null : (ids[p] ?? null))
  const byPos = new Map((json.beats ?? []).map((b) => [Number(b.position), b] as const))
  const beats = shape.map((b, i) => {
    const words = byPos.get(b.position) ?? (json.beats ?? [])[i] ?? {}
    const intents = Array.isArray(words.options) ? words.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : []
    const options =
      b.kind === 'CALL'
        ? ['Answer', 'Let it ring'].slice(0, b.optionsTo.length).map((intent, k) => ({ intent, next: idAt(b.optionsTo[k] ?? null), affinity: 0 }))
        : b.optionsTo.map((to, k) => ({ intent: str(intents[k], k === 0 ? 'Go along with it' : 'Hold back', 200), next: idAt(to), affinity: 0 }))
    return {
      id: ids[i]!,
      position: b.position,
      kind: b.kind,
      brief: str(words.brief, b.kind === 'END' ? 'It closes here.' : 'He waits to see what they do.', 1200),
      setting: typeof words.setting === 'string' && words.setting.trim() ? words.setting.trim().slice(0, 400) : null,
      options,
      next: idAt(b.nextTo),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: b.hotspots,
    }
  })
  const candidate = {
    characterId: character.id,
    title: str(json.title, 'Untitled', 80),
    premise: req.premise,
    setting: str(json.setting, req.setting ?? 'His place, late.', 400),
    opener: str(json.opener, '*looks up* you came.', 600),
    sceneId: null,
    rating: req.rating,
    firstBeatId: ids[0]!,
    beats,
  }
  const parsed = EpisodeDraft.safeParse(candidate)
  if (!parsed.success) {
    deps.log.warn({ issues: parsed.error.issues.map((i) => i.message) }, 'ai draft: skeleton does not hang together')
    throw new DraftUnavailable('that skeleton does not hang together: ' + parsed.error.issues.map((i) => i.message).join('; '))
  }
  return { draft: parsed.data, model }
}
