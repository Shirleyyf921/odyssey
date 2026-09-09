import { test } from 'node:test'
import assert from 'node:assert/strict'
import { StoryStreamParser, parseStoryOutput } from './story.js'

const GOOD = `[narration]
The lamp is the only light left. He hasn't moved since the door opened.

Rain, still.
[line]
*doesn't look back down at the desk* you found it. come here.
[options]
A. Cross the room and sit by the lamp
B. Stay where you are and make him come to you`

test('a well-formed turn parses into paragraphs, line, and two options', () => {
  const t = parseStoryOutput(GOOD)
  assert.deepEqual(t.narration, ["The lamp is the only light left. He hasn't moved since the door opened.", 'Rain, still.'])
  assert.equal(t.line, "*doesn't look back down at the desk* you found it. come here.")
  assert.deepEqual(t.options, ['Cross the room and sit by the lamp', 'Stay where you are and make him come to you'])
})

test('no markers at all: the whole text is his line', () => {
  const t = parseStoryOutput('*looks up* you found it.')
  assert.deepEqual(t, { narration: [], line: '*looks up* you found it.', options: [] })
})

test('markers are case-insensitive, bullets vary, and a forgotten [narration] still keeps the preamble', () => {
  const t = parseStoryOutput(`He hasn't moved.\n[LINE]\n*looks up* hey.\n[Options]\n1) sit\n- leave`)
  assert.deepEqual(t.narration, ["He hasn't moved."])
  assert.equal(t.line, '*looks up* hey.')
  assert.deepEqual(t.options, ['sit', 'leave'])
})

test('narration and options but no line: the last paragraph is him', () => {
  const t = parseStoryOutput(`[narration]\nThe room.\n\n*looks up* you came.\n[options]\nA. sit\nB. go`)
  assert.equal(t.line, '*looks up* you came.')
  assert.deepEqual(t.narration, ['The room.', '*looks up* you came.'])
})

test('more than two options are cut to two', () => {
  const t = parseStoryOutput(`[line]\nhey\n[options]\nA. one\nB. two\nC. three`)
  assert.deepEqual(t.options, ['one', 'two'])
})

test('the stream parser tags deltas by section even when markers split across chunks', () => {
  const p = new StoryStreamParser()
  const chunks = ['[narr', 'ation]\nThe lamp', ' is on.\n[li', 'ne]\n*looks up* you ', 'found it.\n[opt', 'ions]\nA. sit\nB. go']
  const got: Array<[string, string]> = []
  for (const c of chunks) for (const e of p.feed(c)) got.push([e.section, e.delta])
  const { events, turn } = p.finish()
  for (const e of events) got.push([e.section, e.delta])
  const narration = got.filter(([s]) => s === 'narration').map(([, d]) => d).join('')
  const line = got.filter(([s]) => s === 'line').map(([, d]) => d).join('')
  assert.equal(narration.trim(), 'The lamp is on.')
  assert.equal(line.trim(), '*looks up* you found it.')
  assert.ok(got.every(([s]) => s !== 'options'), 'options are never streamed')
  assert.ok(got.every(([, d]) => !d.includes('[')), 'markers never leak into deltas')
  assert.deepEqual(turn.options, ['sit', 'go'])
})

test('a stream with no marker is released as the line on finish', () => {
  const p = new StoryStreamParser()
  assert.deepEqual(p.feed('*looks up* '), [], 'held until we know what it is')
  assert.deepEqual(p.feed('hey.'), [])
  const { events, turn } = p.finish()
  assert.deepEqual(events, [{ section: 'line', delta: '*looks up* hey.' }])
  assert.equal(turn.line, '*looks up* hey.')
})
