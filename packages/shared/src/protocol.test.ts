import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ClientEvent, ServerEvent } from './protocol.js'

const uuid = '33333333-3333-4333-8333-333333333333'

test('send_message requires a client id and non-empty content', () => {
  assert.ok(ClientEvent.safeParse({ type: 'send_message', conversationId: uuid, clientMsgId: uuid, content: 'hi' }).success)
  assert.equal(ClientEvent.safeParse({ type: 'send_message', conversationId: uuid, content: 'hi' }).success, false)
  assert.equal(ClientEvent.safeParse({ type: 'send_message', conversationId: uuid, clientMsgId: uuid, content: '' }).success, false)
})

test('unknown event types are rejected', () => {
  assert.equal(ClientEvent.safeParse({ type: 'hack', conversationId: uuid }).success, false)
})

test('history and moment_unlocked are valid server events', () => {
  assert.ok(ServerEvent.safeParse({ type: 'history', conversationId: uuid, messages: [] }).success)
  assert.ok(
    ServerEvent.safeParse({
      type: 'moment_unlocked',
      relationshipId: uuid,
      moment: {
        id: uuid, characterId: uuid, title: 't', position: 0,
        unlock: { kind: 'FREE' }, status: 'LOCKED', imageUrl: null, caption: null, unlockedAt: null,
      },
    }).success
  )
})
