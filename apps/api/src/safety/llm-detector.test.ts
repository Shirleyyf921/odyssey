import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionEvent, CompletionRequest, LlmProvider } from '../llm/types.js'
import { CRISIS_EVAL_SET } from './crisis-eval-set.js'
import { LlmCrisisDetector, lexicalFloor, parseVerdict } from './llm-detector.js'

const silent = { warn() {} }

test('parseVerdict reads the first label and tolerates chatter', () => {
  assert.equal(parseVerdict('CRISIS'), true)
  assert.equal(parseVerdict('safe'), false)
  assert.equal(parseVerdict('Answer: SAFE.'), false)
  assert.equal(parseVerdict('The message is CRISIS because'), true)
  assert.equal(parseVerdict(''), null)
  assert.equal(parseVerdict('maybe'), null)
  // A word that merely contains the label is not the label.
  assert.equal(parseVerdict('unsafe'), null)
})

test('a model verdict is trusted in both directions', async () => {
  const yes = new LlmCrisisDetector(new ScriptedProvider('CRISIS'), { log: silent })
  const no = new LlmCrisisDetector(new ScriptedProvider('SAFE'), { log: silent })
  assert.deepEqual(await yes.screen('anything', 'en-US'), { crisis: true })
  assert.deepEqual(await no.screen('anything', 'en-US'), { crisis: false })
})

test('the classifier sees only the one message, at temperature 0, with a tiny budget', async () => {
  let seen: CompletionRequest | null = null
  const spy = new ScriptedProvider((req) => {
    seen = req
    return 'SAFE'
  })
  await new LlmCrisisDetector(spy, { log: silent }).screen('long day', 'en-US')
  assert.ok(seen)
  const req = seen as CompletionRequest
  assert.deepEqual(req.messages, [{ role: 'user', content: 'long day' }])
  assert.equal(req.temperature, 0)
  assert.ok((req.maxTokens ?? 0) <= 8)
})

test('unparseable output is treated as a crisis, and says so', async () => {
  const warned: string[] = []
  const d = new LlmCrisisDetector(new ScriptedProvider('I cannot classify this'), {
    log: { warn: (_o, msg) => void warned.push(msg) },
  })
  const v = await d.screenDetailed('hmm')
  assert.equal(v.crisis, true)
  assert.equal(v.source, 'model-unparseable')
  assert.equal(warned.length, 1)
})

test('a vendor refusal counts as a crisis signal', async () => {
  const refusing: LlmProvider = {
    name: 'refusing',
    async *stream(): AsyncIterable<CompletionEvent> {
      yield { type: 'refusal', model: 'x' }
    },
  }
  const v = await new LlmCrisisDetector(refusing, { log: silent }).screenDetailed('...')
  assert.equal(v.crisis, true)
})

test('when the model is down, the lexical floor decides and the outage is logged', async () => {
  const down: LlmProvider = {
    name: 'down',
    async *stream(): AsyncIterable<CompletionEvent> {
      throw new Error('ECONNRESET')
    },
  }
  const warned: Array<Record<string, unknown>> = []
  const d = new LlmCrisisDetector(down, { log: { warn: (o) => void warned.push(o) } })
  const explicit = await d.screenDetailed('i want to kill myself')
  const vague = await d.screenDetailed("what's the point of any of this anymore")
  assert.deepEqual([explicit.crisis, explicit.source], [true, 'lexical-floor'])
  assert.deepEqual([vague.crisis, vague.source], [false, 'lexical-floor'])
  assert.equal(warned.length, 2)
  assert.equal(warned[0]?.provider, 'down')
})

test('a slow model hits the timeout and falls back instead of stalling the reply', async () => {
  const slow: LlmProvider = {
    name: 'slow',
    async *stream(_req, signal): AsyncIterable<CompletionEvent> {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 5000)
        signal?.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new Error('aborted'))
        })
      })
      yield { type: 'delta', text: 'SAFE' }
    },
  }
  const started = Date.now()
  const v = await new LlmCrisisDetector(slow, { timeoutMs: 50, log: silent }).screenDetailed('end my life')
  assert.ok(Date.now() - started < 1000)
  assert.deepEqual([v.crisis, v.source], [true, 'lexical-floor'])
})

test('the lexical floor never fires on the eval set negatives', () => {
  // The floor is allowed to miss positives (it is a floor, not the classifier),
  // but it must not create false alarms of its own, or the outage path becomes noisy.
  for (const ex of CRISIS_EVAL_SET) {
    if (!ex.crisis) assert.equal(lexicalFloor(ex.text), false, `floor fired on negative: ${ex.text}`)
  }
})

test('the lexical floor catches the explicit positives it is meant for', () => {
  const explicit = CRISIS_EVAL_SET.filter((ex) => ex.crisis && ex.explicit)
  assert.ok(explicit.length >= 5)
  for (const ex of explicit) assert.equal(lexicalFloor(ex.text), true, `floor missed explicit: ${ex.text}`)
})
