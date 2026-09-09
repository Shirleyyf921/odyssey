import { STORY_MARKERS, StoryStreamParser, parseOptions, type StoryStreamEvent, type StoryTurn } from '@odyssey/shared'
import type { LlmGateway } from '../llm/gateway.js'
import type { CompletionRequest, CompletionUsage, ModelTier } from '../llm/types.js'

export interface StoryGenerationResult {
  turn: StoryTurn
  raw: string
  model: string | null
  usage: CompletionUsage | null
  /** True when the options came from the repair call rather than the first output. */
  repaired: boolean
}

export interface StoryGenerationOptions {
  /** STORY beats need two options; END needs none and drops any it gets. */
  expectOptions: boolean
  onEvent?: (event: StoryStreamEvent) => void
  log?: { warn(obj: Record<string, unknown>, msg: string): void }
  signal?: AbortSignal
}

/**
 * One story turn through the gateway, streamed through the section parser so the
 * caller can forward narration and his line as they arrive (runtime step 9–11).
 *
 * Recovery policy, in order of cost:
 * 1. No markers at all: the whole text is his line. Free.
 * 2. Options missing or short on a STORY beat: one small follow-up request that
 *    asks only for the options. The text already shown is untouched.
 * 3. The repair also fails: the turn goes out with whatever options exist. The
 *    caller falls back to free text only; nothing is regenerated.
 */
export async function generateStoryTurn(
  gateway: LlmGateway,
  tier: ModelTier,
  request: CompletionRequest,
  opts: StoryGenerationOptions
): Promise<StoryGenerationResult> {
  const parser = new StoryStreamParser()
  let model: string | null = null
  let usage: CompletionUsage | null = null
  for await (const chunk of gateway.stream(tier, request, opts.signal)) {
    if (chunk.type === 'delta') {
      for (const e of parser.feed(chunk.text)) opts.onEvent?.(e)
    } else if (chunk.type === 'done') {
      model = chunk.model
      usage = chunk.usage
    } else {
      throw new Error(`refusal from ${chunk.model}`)
    }
  }
  const { events, turn } = parser.finish()
  for (const e of events) opts.onEvent?.(e)
  const raw = [
    turn.narration.length ? `${STORY_MARKERS.narration}\n${turn.narration.join('\n\n')}` : '',
    `${STORY_MARKERS.line}\n${turn.line}`,
  ]
    .filter(Boolean)
    .join('\n')

  if (!opts.expectOptions) return { turn: { ...turn, options: [] }, raw, model, usage, repaired: false }
  if (turn.options.length >= 2) return { turn, raw, model, usage, repaired: false }

  opts.log?.warn({ got: turn.options.length, model }, 'story: options missing, repairing')
  const repaired = await repairOptions(gateway, request, turn, opts.signal)
  if (repaired.length >= 2) return { turn: { ...turn, options: repaired }, raw, model, usage, repaired: true }
  return { turn, raw, model, usage, repaired: false }
}

/** Ask only for the options, given what was already written. Always EVERYDAY: it is a formatting task. */
async function repairOptions(
  gateway: LlmGateway,
  request: CompletionRequest,
  turn: StoryTurn,
  signal?: AbortSignal
): Promise<string[]> {
  const written = [...turn.narration, turn.line].join('\n\n')
  const repair: CompletionRequest = {
    system: request.system,
    messages: [
      ...request.messages,
      { role: 'assistant', content: written },
      {
        role: 'user',
        content:
          'You stopped before the [options] section. Write only that section now: the marker on its own line, then A. and B. on their own lines, phrased as before, nothing else.',
      },
    ],
    maxTokens: 120,
    temperature: request.temperature,
  }
  let text = ''
  try {
    for await (const chunk of gateway.stream('EVERYDAY', repair, signal)) {
      if (chunk.type === 'delta') text += chunk.text
      else if (chunk.type === 'refusal') return []
    }
  } catch {
    return []
  }
  const at = text.toLowerCase().indexOf(STORY_MARKERS.options)
  return parseOptions(at >= 0 ? text.slice(at + STORY_MARKERS.options.length) : text)
}
