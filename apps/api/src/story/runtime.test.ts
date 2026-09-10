import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { ServerEvent } from '@odyssey/shared'
import { handleClientEvent, type ChatDeps } from '../chat/handler.js'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryService } from '../memory/service.js'
import { RelationshipService } from '../relationship/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { NoopCrisisDetector } from '../safety/crisis.js'

const silent = { info() {}, warn() {}, error() {} }
const STORY_REPLY = `[narration]\nThe lamp is the only light left.\n[line]\n*doesn't look back down* you found it.\n[options]\nA. sit by the lamp\nB. stay by the door`

async function setup() {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return STORY_REPLY
  })
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider })
  const memory = new MemoryService(repo, gateway, null, silent)
  const deps: ChatDeps = {
    repo,
    gateway,
    memory,
    relationship: new RelationshipService(repo, silent),
    crisis: new NoopCrisisDetector(),
    channel: 'store',
    billing: { async tierOf() { return 'PLUS' } },
    user: { id: demo.userId, displayName: 'Shirley', locale: 'en-US', ageVerifiedAt: null },
    log: silent,
  }
  const sent: ServerEvent[] = []
  const send = (e: ServerEvent) => void sent.push(e)
  const [episode] = await repo.listEpisodes(demo.characterId)
  const persona = () => requests.filter((r) => r.system.includes('## This beat'))
  const start = () => handleClientEvent(deps, { type: 'start_episode', conversationId: demo.conversationId, episodeId: episode!.id }, send)
  const say = (content: string, choice?: number) =>
    handleClientEvent(deps, { type: 'send_message', conversationId: demo.conversationId, clientMsgId: randomUUID(), content, ...(choice !== undefined ? { choice } : {}) }, send)
  const run = async () => (await repo.listRuns(demo.relationshipId))[0] ?? null
  const last = <T extends ServerEvent['type']>(type: T) => sent.filter((e) => e.type === type).at(-1) as Extract<ServerEvent, { type: T }> | undefined
  return { repo, deps, memory, demo, episode: episode!, sent, send, start, say, run, last, persona }
}

test('start_episode opens a run with his opener as a real message and the authored intents as first choices', async () => {
  const { repo, demo, episode, sent, start, run, last } = await setup()
  await start()
  const started = last('episode_started')
  assert.ok(started)
  assert.equal(started.episode.status, 'IN_PROGRESS')
  assert.equal(started.message?.content, episode.opener)
  const choices = last('choices')
  assert.ok(choices)
  assert.deepEqual(choices.options, episode.beats[0]!.options.map((o) => o.intent))
  assert.deepEqual(choices.beat, { position: 1, count: 7, kind: 'STORY', hotspots: ['hand'] })
  assert.equal((await run())?.currentBeatId, episode.firstBeatId)
  assert.equal((await repo.listRecentMessages(demo.conversationId, 10)).at(-1)?.content, episode.opener)

  // Starting again resumes: no second opener, choices come back.
  sent.length = 0
  await start()
  assert.equal(last('episode_started')?.message, null)
  assert.ok(last('choices'))
  assert.equal((await repo.listRecentMessages(demo.conversationId, 10)).filter((m) => m.content === episode.opener).length, 1)
})

test('a choice moves the beat, credits its affinity, and the reply carries section-tagged deltas and model-phrased options', async () => {
  const { repo, demo, episode, sent, start, say, run, last, persona } = await setup()
  await start()
  const before = (await repo.getConversationContext(demo.conversationId))!.relationship.affinity
  sent.length = 0
  await say(episode.beats[0]!.options[0]!.intent, 0)

  assert.equal((await run())?.currentBeatId, episode.beats[0]!.options[0]!.next)
  assert.deepEqual((await run())?.path, [episode.firstBeatId, episode.beats[0]!.options[0]!.next])
  const sections = sent.filter((e) => e.type === 'message_delta').map((e) => (e.type === 'message_delta' ? e.section : null))
  assert.ok(sections.includes('narration') && sections.includes('line') && !sections.includes('options'))
  const end = last('message_end')
  assert.ok(end?.message.content.includes('[line]') && !end.message.content.includes('[options]'), 'stored text: narration and line, no options')
  assert.deepEqual(last('choices')?.options, ['sit by the lamp', 'stay by the door'])
  assert.equal(last('choices')?.beat.position, 2)
  assert.ok(!sent.some((e) => e.type === 'relationship_updated'))

  const after = (await repo.getConversationContext(demo.conversationId))!.relationship.affinity
  assert.equal(after - before, 1 + 1, 'the message gain and the option affinity; the seeded relationship already counts today')
  const prompt = persona().at(-1)!.system
  assert.ok(prompt.includes(episode.beats[1]!.brief), 'the prompt is the target beat')
  assert.ok(prompt.includes('just did: chose:'), 'the choice reaches the prompt as an action')
})

test('free text stays on the beat and gets the choices again', async () => {
  const { episode, sent, start, say, run, last } = await setup()
  await start()
  sent.length = 0
  await say('what is that on the desk?')
  assert.equal((await run())?.currentBeatId, episode.firstBeatId)
  assert.equal(last('choices')?.beat.position, 1)
  assert.ok(last('message_end'))
})

test('playing through: the photo beat sends its moment locked, the phone rings, END closes the run', async () => {
  const { repo, demo, episode, sent, start, say, run, last, persona } = await setup()
  await start()
  await say('sit', 0) // B1 -> B2
  await say('ask', 0) // B2 -> B4, the photo beat
  const photo = last('moment_offer')
  assert.ok(photo)
  assert.equal(photo.moment.id, episode.beats[3]!.photoMomentId)
  assert.equal(photo.moment.status, 'LOCKED')
  assert.equal(photo.moment.imageUrl, null)

  // B4 -> B5, the call beat: it rings and costs nothing.
  sent.length = 0
  const before = persona().length
  await say('stay', 0)
  const ring = last('incoming_call')
  assert.ok(ring, 'the phone rings')
  assert.equal(ring.characterName, 'Elliot')
  assert.equal(ring.audioUrl, null)
  assert.equal(ring.silent, 'NOT_RENDERED', 'no clip is recorded yet, so it plays out in text')
  assert.equal(persona().length, before, 'a ring generates nothing')
  assert.ok(!last('message_end'), 'and he says nothing yet')
  assert.deepEqual(last('choices')?.options, ['Answer', 'Let it ring'])
  assert.equal(last('choices')?.beat.kind, 'CALL')

  sent.length = 0
  await say('Answer', 0) // B5 -> B6 END
  assert.ok(last('message_end'), 'answering is when he speaks')
  assert.ok(last('episode_ended'))
  assert.ok(!last('choices'), 'no choices after the ending')
  assert.ok((await run())?.endedAt)
  assert.ok(persona().at(-1)!.system.includes('No [options] section at all'))

  // The episode is done: the next message is an ordinary chat turn.
  sent.length = 0
  await say('goodnight')
  assert.ok(last('message_end'))
  assert.ok(!last('choices'))
  assert.equal((await repo.listRuns(demo.relationshipId)).length, 1)
})

test('resume puts the chips back while an episode is open', async () => {
  const { deps, demo, sent, start, send, last } = await setup()
  await start()
  sent.length = 0
  await handleClientEvent(deps, { type: 'resume', conversationId: demo.conversationId, lastMessageId: null }, send)
  assert.equal(sent[0]?.type, 'history')
  assert.ok(last('choices'))
})

test('an authored choice is not crisis-screened; free text inside the story still is', async () => {
  const t = await setup()
  let screened: string[] = []
  t.deps.crisis = { async screen(text: string) { screened.push(text); return { crisis: false } } }
  await t.start()
  await t.say(t.episode.beats[0]!.options[0]!.intent, 0)
  assert.deepEqual(screened, [], 'our own option text never reaches the classifier')
  await t.say('honestly I feel awful tonight')
  assert.deepEqual(screened, ['honestly I feel awful tonight'])
})

test('a touch answers without moving the beat, and the server writes its text', async () => {
  const t = await setup()
  await t.start()
  const beat = (await t.run())!.currentBeatId
  t.sent.length = 0
  await t.deps.repo.updateRelationship(t.demo.relationshipId, { stage: 'CLOSE' })
  await handleClientEvent(
    t.deps,
    { type: 'send_message', conversationId: t.demo.conversationId, clientMsgId: randomUUID(), content: 'hand', touch: 'hand' },
    t.send
  )
  const ack = t.last('message_ack')
  assert.equal(ack?.message.content, 'reaches out and takes his hand', 'the client cannot choose the words')
  assert.equal((await t.run())?.currentBeatId, beat, 'the beat does not move')
  assert.ok(!t.last('choices'), 'the standing options are left alone')
  assert.ok(t.last('message_end'))
  const prompt = t.persona().at(-1)!.system
  assert.ok(prompt.includes('They just touched you'))
  assert.ok(prompt.includes('No [options] section at all'))
})

test('a hotspot the beat does not offer is treated as ordinary text, not a touch', async () => {
  const t = await setup()
  await t.start()
  t.sent.length = 0
  // Beat 1 offers 'hand' only.
  await handleClientEvent(
    t.deps,
    { type: 'send_message', conversationId: t.demo.conversationId, clientMsgId: randomUUID(), content: 'face', touch: 'face' },
    t.send
  )
  assert.equal(t.last('message_ack')?.message.content, 'face')
  assert.ok(t.last('choices'), 'an ordinary turn still refreshes the options')
})

test('the ring: a clip reaches Plus and never a free caller, and letting it ring is its own ending', async () => {
  // Pretend the clip has been rendered for the call beat.
  const clip = 'https://cdn.example.com/calls/elliot-ep1.m4a'
  const withClip = async (tier: 'FREE' | 'PLUS') => {
    const t = await setup()
    t.deps.billing = { async tierOf() { return tier } }
    const ep = await t.deps.repo.getEpisode(t.episode.id)
    const call = ep!.beats.find((b) => b.kind === 'CALL')!
    call.callUrl = clip
    call.callSeconds = 34
    await t.start()
    await t.say('sit', 0)
    await t.say('ask', 0)
    await t.say('stay', 0)
    return t
  }

  const plus = await withClip('PLUS')
  const heard = plus.last('incoming_call')!
  assert.equal(heard.audioUrl, clip)
  assert.equal(heard.seconds, 34)
  assert.equal(heard.silent, 'NONE')

  const free = await withClip('FREE')
  const unheard = free.last('incoming_call')!
  assert.equal(unheard.audioUrl, null, 'a free client never holds the file')
  assert.equal(unheard.seconds, null)
  assert.equal(unheard.silent, 'NEEDS_PLUS')

  // Letting it ring ends the episode too, on the other ending.
  free.sent.length = 0
  await free.say('Let it ring', 1)
  assert.ok(free.last('episode_ended'))
  const run = await free.run()
  assert.ok(run?.endedAt)
  assert.equal(run.path.at(-1), free.episode.beats[6]!.id, 'the declined ending, not the answered one')
})

test('a resume while the phone is ringing rings again', async () => {
  const t = await setup()
  await t.start()
  await t.say('sit', 0)
  await t.say('ask', 0)
  await t.say('stay', 0)
  t.sent.length = 0
  await handleClientEvent(t.deps, { type: 'resume', conversationId: t.demo.conversationId, lastMessageId: null }, t.send)
  assert.ok(t.last('incoming_call'), 'the client that reconnected still has a call waiting')
  assert.deepEqual(t.last('choices')?.options, ['Answer', 'Let it ring'])
})
