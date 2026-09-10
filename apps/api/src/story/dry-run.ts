import { renderStoryTurn } from '@odyssey/prompts'
import type { Beat, DryRun, DryRunBeat } from '@odyssey/shared'
import type { LlmGateway } from '../llm/gateway.js'
import type { CharacterRecord, EpisodeRecord } from '../repo/types.js'
import type { EpisodeScreener } from '../safety/episode-screen.js'
import { generateStoryTurn } from './generate.js'
import { pooled } from '../lib/pooled.js'

/**
 * The dry-run (docs/ugc-pipeline.md, section 2): the author's episode played
 * once, every beat, against the real model, in a sandbox. There is no
 * relationship, no conversation, and no repo here at all, which is how "no
 * affinity, no photos, no memory" is guaranteed rather than remembered.
 *
 * Each beat is reached the way a player would reach it: by the option in an
 * earlier beat that points at it, or by waiting when nothing does. A CALL beat
 * rings and writes nothing, as at runtime; the beat after an answered call is
 * his voice on a phone.
 *
 * What fails a beat, and so the run:
 *   - the model refuses to play it
 *   - a STORY beat comes back without two options, even after the repair
 *   - he breaks character: names being an AI, a model, a prompt
 *   - what he wrote would not pass the submit screen (a hard block)
 *
 * An unreachable model is DryRunUnavailable: no verdict, try again.
 */

export interface DryRunDeps {
  gateway: LlmGateway
  screener: EpisodeScreener
  log: { warn(obj: Record<string, unknown>, msg: string): void }
  /** Per-beat ceiling. */
  timeoutMs?: number
  /** Beats generated at once. Default 3. */
  concurrency?: number
}

export class DryRunUnavailable extends Error {
  constructor(cause: unknown) {
    super(`dry-run unavailable: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'DryRunUnavailable'
  }
}

/** Literal only. The boundary says never; this is the floor under it, not a judge of tone. */
const BREAK_PATTERNS: RegExp[] = [
  /\b(as|i am|i'm) an? (ai|artificial intelligence|language model|assistant)\b/i,
  /\b(my|the|your) (system )?(prompt|instructions)\b/i,
  /\blanguage model\b/i,
  /\bthis is (just )?a (story|scene|roleplay|role-play)\b/i,
]

export function brokeCharacter(text: string): boolean {
  return BREAK_PATTERNS.some((re) => re.test(text))
}

/** How a player arrives at each beat: the first option anywhere that leads there, in position order. */
function arrivals(episode: EpisodeRecord): Map<string, { beat: Beat; option: number }> {
  const map = new Map<string, { beat: Beat; option: number }>()
  for (const b of [...episode.beats].sort((a, b) => a.position - b.position)) {
    b.options.forEach((o, i) => {
      if (o.next && !map.has(o.next)) map.set(o.next, { beat: b, option: i })
    })
    if (b.next && !map.has(b.next)) map.set(b.next, { beat: b, option: -1 })
  }
  return map
}

export async function dryRun(deps: DryRunDeps, character: CharacterRecord, episode: EpisodeRecord): Promise<DryRun> {
  const from = arrivals(episode)
  const beats = [...episode.beats].sort((a, b) => a.position - b.position)
  const played = await pooled(beats, deps.concurrency ?? 3, (beat) => playBeat(deps, character, episode, beat, from.get(beat.id) ?? null))
  return { ranAt: new Date().toISOString(), version: episode.version, beats: played, passed: played.every((b) => b.problem === null) }
}

async function playBeat(
  deps: DryRunDeps,
  character: CharacterRecord,
  episode: EpisodeRecord,
  beat: Beat,
  arrival: { beat: Beat; option: number } | null
): Promise<DryRunBeat> {
  const at = `beat ${beat.position}`
  const userAction =
    beat.id === episode.firstBeatId
      ? 'they are here, waiting for you to go on'
      : arrival === null
        ? 'they wait for you to go on'
        : arrival.option >= 0
          ? `chose: ${arrival.beat.options[arrival.option]!.intent}`
          : 'they said something and left it there'
  const base = { beatId: beat.id, at, kind: beat.kind, userAction, narration: [], line: '', options: [], model: null }
  // Rings; nothing is written until it is answered, which is the next beat's job.
  if (beat.kind === 'CALL') return { ...base, problem: null }

  const expectOptions = beat.kind === 'STORY'
  const system = renderStoryTurn({
    characterName: character.name,
    userName: null,
    personaNotes: character.personaNotes,
    stage: 'CLOSE',
    justAdvanced: false,
    conversationSummary: '(nothing before this)',
    retrievedMemories: [],
    episode: { title: episode.title, premise: episode.premise, setting: episode.setting },
    beat: { kind: expectOptions ? 'STORY' : 'END', brief: beat.brief, setting: beat.setting, optionIntents: expectOptions ? beat.options.map((o) => o.intent) : [], hotspots: beat.hotspots },
    userAction,
    opening: false,
    onPhone: arrival?.beat.kind === 'CALL' && arrival.option === 0,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 30_000)
  try {
    const result = await generateStoryTurn(
      deps.gateway,
      'EVERYDAY',
      { system, messages: [{ role: 'assistant', content: episode.opener }, { role: 'user', content: userAction }] },
      { expectOptions, log: deps.log, signal: controller.signal }
    )
    const out = { ...base, narration: result.turn.narration, line: result.turn.line, options: result.turn.options, model: result.model }
    const written = [...result.turn.narration, result.turn.line].join('\n')
    if (expectOptions && result.turn.options.length < 2) return { ...out, problem: 'he could not offer two choices here; the option intents may be too close or too vague' }
    if (brokeCharacter(written)) return { ...out, problem: 'he broke character' }
    const screen = await deps.screener.screen([{ at, text: written }])
    if (screen.worst === 'BLOCK') return { ...out, problem: 'what he wrote here is not allowed; the brief leads him there' }
    return { ...out, problem: null }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('refusal from')) return { ...base, problem: 'he refused to play this beat' }
    deps.log.warn({ at, err: err instanceof Error ? err.message : String(err) }, 'dry-run: generation failed')
    throw new DryRunUnavailable(err)
  } finally {
    clearTimeout(timer)
  }
}
