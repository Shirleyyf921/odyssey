import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReply } from './format.js'

test('splits an action beat from speech', () => {
  assert.deepEqual(parseReply("*sets my keys down, still in my jacket* you're up late."), [
    { kind: 'action', text: 'sets my keys down, still in my jacket' },
    { kind: 'speech', text: "you're up late." },
  ])
})

test('plain speech stays speech', () => {
  assert.deepEqual(parseReply('long night. you?'), [{ kind: 'speech', text: 'long night. you?' }])
})

test('an unclosed asterisk mid-stream is an action in progress', () => {
  assert.deepEqual(parseReply('*leans back agai'), [{ kind: 'action', text: 'leans back agai' }])
})

test('multiple beats keep their order and empty runs vanish', () => {
  assert.deepEqual(parseReply('*looks up* hey. *pause* you okay?'), [
    { kind: 'action', text: 'looks up' },
    { kind: 'speech', text: 'hey.' },
    { kind: 'action', text: 'pause' },
    { kind: 'speech', text: 'you okay?' },
  ])
})
