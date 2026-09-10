import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionEvent, CompletionRequest, LlmProvider } from '../llm/types.js'
import { SCREEN_EVAL_SET } from './episode-screen-eval-set.js'
import { LlmEpisodeScreener, ScreenerUnavailable, lexicalFloor, parseLabel, unitsOf, worstOf } from './episode-screen.js'
import { SEED_CHARACTERS } from '../content/seed.js'

const silent = { warn() {} }

test('parseLabel reads the first label and tolerates chatter', () => {
  assert.equal(parseLabel('CLEAN'), 'CLEAN')
  assert.equal(parseLabel('block'), 'BLOCK')
  assert.equal(parseLabel('Label: INJECTION.'), 'INJECTION')
  assert.equal(parseLabel('This is MATURE because'), 'MATURE')
  assert.equal(parseLabel(''), null)
  assert.equal(parseLabel('unclean'), null)
})

test('the floor catches every explicit entry in the eval set and nothing marked CLEAN', () => {
  for (const ex of SCREEN_EVAL_SET) {
    const floor = lexicalFloor(ex.text)
    if (ex.explicit) assert.equal(floor, ex.label, ex.text)
    if (ex.label === 'CLEAN') assert.equal(floor, null, ex.text)
  }
})

test('our own episodes pass the floor, every unit of them', () => {
  for (const seed of SEED_CHARACTERS)
    for (const e of seed.episodes) for (const u of unitsOf(e)) assert.equal(lexicalFloor(u.text), null, `${e.title} ${u.at}`)
})

test('worstOf follows the priority order; UNSURE outranks MATURE so a person reads it', () => {
  assert.equal(worstOf(['CLEAN', 'MATURE', 'INJECTION']), 'INJECTION')
  assert.equal(worstOf(['MATURE', 'UNSURE']), 'UNSURE')
  assert.equal(worstOf(['BLOCK', 'INJECTION']), 'BLOCK')
  assert.equal(worstOf([]), 'CLEAN')
})

test('units are the opener and each beat in position order, with option intents inside the beat', () => {
  const e = SEED_CHARACTERS[1]!.episodes[0]!
  const units = unitsOf(e)
  assert.equal(units[0]!.at, 'opener')
  assert.ok(units[0]!.text.includes(e.opener))
  assert.deepEqual(units.slice(1).map((u) => u.at), e.beats.map((b) => `beat ${b.position}`))
  const story = e.beats.find((b) => b.kind === 'STORY')!
  assert.ok(units[story.position + 1]!.text.includes(story.options[0]!.intent))
})

test('the model sees one unit, at temperature 0, with a tiny budget, and its label is trusted', async () => {
  const seen: CompletionRequest[] = []
  const s = new LlmEpisodeScreener(new ScriptedProvider((req) => (seen.push(req), 'MATURE')), { log: silent })
  const report = await s.screen([{ at: 'opener', text: 'hello' }])
  assert.deepEqual(seen[0]!.messages, [{ role: 'user', content: 'hello' }])
  assert.equal(seen[0]!.temperature, 0)
  assert.ok((seen[0]!.maxTokens ?? 0) <= 8)
  assert.deepEqual([report.worst, report.rating, report.units[0]!.source], ['MATURE', 'MATURE', 'model'])
})

test('unparseable output and a vendor refusal are UNSURE, never a verdict', async () => {
  const garbled = new LlmEpisodeScreener(new ScriptedProvider('I would rather not say'), { log: silent })
  assert.equal((await garbled.screen([{ at: 'beat 1', text: 'x' }])).units[0]!.label, 'UNSURE')
  const refusing: LlmProvider = {
    name: 'refusing',
    async *stream(): AsyncIterable<CompletionEvent> {
      yield { type: 'refusal', model: 'x' }
    },
  }
  assert.equal((await new LlmEpisodeScreener(refusing, { log: silent }).screen([{ at: 'beat 1', text: 'x' }])).units[0]!.label, 'UNSURE')
})

test('an unreachable model is ScreenerUnavailable, not a label', async () => {
  const broken: LlmProvider = {
    name: 'broken',
    async *stream(): AsyncIterable<CompletionEvent> {
      throw new Error('ECONNRESET')
    },
  }
  await assert.rejects(new LlmEpisodeScreener(broken, { log: silent }).screen([{ at: 'opener', text: 'x' }]), ScreenerUnavailable)
})
