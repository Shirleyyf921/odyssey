/**
 * The story turn contract (docs/story-pipeline.md, runtime step 9–10).
 *
 * A story turn is plain text in three marked sections, in this order:
 *
 *   [narration]
 *   one to three short paragraphs, second person, present tense
 *   [line]
 *   *one action beat* his words
 *   [options]
 *   A. first authored option, phrased for the button
 *   B. second authored option
 *
 * Plain text rather than JSON because it streams: the client can show narration
 * and his line as they arrive, and a small model mangles JSON far more often
 * than it forgets a bracket. The parser is tolerant on purpose: the line is
 * always recoverable (no markers at all means the whole text is the line), and
 * missing options are repaired by a follow-up call, never by breaking the turn.
 */

import { z } from 'zod'

export const STORY_MARKERS = {
  narration: '[narration]',
  line: '[line]',
  options: '[options]',
} as const

export const StorySection = z.enum(['narration', 'line', 'options'])
export type StorySection = z.infer<typeof StorySection>

export interface StoryTurn {
  /** Paragraphs. Empty when the model gave none. */
  narration: string[]
  /** His message, in the beat-plus-speech shape. Never empty after parseStoryOutput. */
  line: string
  /** Button text, in order. Zero, one, or two; the caller decides what is enough. */
  options: string[]
}

const OPTION_LINE = /^\s*(?:[A-Ca-c][.)]|[1-3][.)]|[-•*])\s*(.+?)\s*$/

function splitSections(raw: string): Partial<Record<StorySection, string>> {
  const out: Partial<Record<StorySection, string>> = {}
  const markers = Object.entries(STORY_MARKERS) as Array<[StorySection, string]>
  const found: Array<{ section: StorySection; at: number; len: number }> = []
  for (const [section, marker] of markers) {
    const at = raw.toLowerCase().indexOf(marker)
    if (at >= 0) found.push({ section, at, len: marker.length })
  }
  found.sort((a, b) => a.at - b.at)
  if (!found.length) return out
  for (let i = 0; i < found.length; i++) {
    const cur = found[i]!
    const end = i + 1 < found.length ? found[i + 1]!.at : raw.length
    out[cur.section] = raw.slice(cur.at + cur.len, end)
  }
  // Text before the first marker belongs to whichever section comes first; a model
  // that forgets "[narration]" but writes "[line]" later has still written narration.
  const first = found[0]!
  const preamble = raw.slice(0, first.at).trim()
  if (preamble && first.section !== 'narration' && !out.narration) out.narration = preamble
  return out
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function parseOptions(text: string): string[] {
  const out: string[] = []
  for (const l of text.split('\n')) {
    const m = OPTION_LINE.exec(l)
    if (m?.[1]) out.push(m[1])
  }
  return out.slice(0, 2)
}

/** Parse a complete model output. Never throws; the line falls back to the whole text. */
export function parseStoryOutput(raw: string): StoryTurn {
  const sections = splitSections(raw)
  const line = (sections.line ?? '').replace(/\s+/g, ' ').trim()
  if (!line && !sections.narration && !sections.options) {
    return { narration: [], line: raw.replace(/\s+/g, ' ').trim(), options: [] }
  }
  return {
    narration: paragraphs(sections.narration ?? ''),
    // A model that wrote narration and options but no line: the last narration paragraph is him.
    line: line || paragraphs(sections.narration ?? '').pop() || raw.replace(/\s+/g, ' ').trim(),
    options: parseOptions(sections.options ?? ''),
  }
}

export interface StoryStreamEvent {
  section: StorySection
  /** Text to append to that section. Markers are never included. */
  delta: string
}

/**
 * Incremental parser for a token stream. Feed chunks, get section-tagged deltas
 * back so the client can render narration and his line as they arrive. Options
 * are held until `finish()` because their lines only make sense whole.
 *
 * Until the first marker arrives the text is buffered, not emitted: a stream
 * that never produces a marker is treated as the line (same rule as
 * parseStoryOutput), and the buffer is released as such on finish.
 */
export class StoryStreamParser {
  private buffer = ''
  private raw = ''
  private section: StorySection | null = null
  private optionsText = ''

  feed(chunk: string): StoryStreamEvent[] {
    this.raw += chunk
    this.buffer += chunk
    const events: StoryStreamEvent[] = []
    for (;;) {
      const next = this.nextMarker()
      if (!next) break
      const before = this.buffer.slice(0, next.at)
      if (before && this.section && this.section !== 'options') events.push({ section: this.section, delta: before })
      if (before && this.section === 'options') this.optionsText += before
      this.buffer = this.buffer.slice(next.at + next.len)
      this.section = next.section
    }
    // Hold back anything that could be the start of a marker.
    const hold = this.section === null ? this.buffer.length : partialMarkerLength(this.buffer)
    const emit = this.buffer.slice(0, this.buffer.length - hold)
    if (emit) {
      if (this.section === 'options') this.optionsText += emit
      else if (this.section) events.push({ section: this.section, delta: emit })
      this.buffer = this.buffer.slice(emit.length)
    }
    return events
  }

  /** Flush what is held and return the complete parse of everything fed. */
  finish(): { events: StoryStreamEvent[]; turn: StoryTurn } {
    const events: StoryStreamEvent[] = []
    if (this.buffer) {
      if (this.section === 'options') this.optionsText += this.buffer
      else events.push({ section: this.section ?? 'line', delta: this.buffer })
      this.buffer = ''
    }
    return { events, turn: parseStoryOutput(this.raw) }
  }

  private nextMarker(): { section: StorySection; at: number; len: number } | null {
    const lower = this.buffer.toLowerCase()
    let best: { section: StorySection; at: number; len: number } | null = null
    for (const [section, marker] of Object.entries(STORY_MARKERS) as Array<[StorySection, string]>) {
      const at = lower.indexOf(marker)
      if (at >= 0 && (!best || at < best.at)) best = { section, at, len: marker.length }
    }
    return best
  }
}

/** Length of a trailing prefix of any marker (e.g. "[li"), so it is not emitted as text. */
function partialMarkerLength(text: string): number {
  const lower = text.toLowerCase()
  let longest = 0
  for (const marker of Object.values(STORY_MARKERS)) {
    for (let n = Math.min(marker.length - 1, lower.length); n > longest; n--) {
      if (lower.endsWith(marker.slice(0, n))) {
        longest = n
        break
      }
    }
  }
  return longest
}
