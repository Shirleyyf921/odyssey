import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEED_CHARACTERS } from '../content/seed.js'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { FloorOnlyEpisodeScreener, type EpisodeScreener } from '../safety/episode-screen.js'
import { brokeCharacter, dryRun } from './dry-run.js'

const silent = { warn() {} }
const REPLY = `[narration]\nRain on the glass.\n[line]\n*looks up* there you are.\n[options]\nA. sit\nB. stay standing`
const jun = SEED_CHARACTERS[2]!
const episode = jun.episodes[0]!
const call = episode.beats.find((b) => b.kind === 'CALL')!
assert.ok(call, 'Jun\'s first episode has a call')

function deps(reply: string | ((req: CompletionRequest) => string) = REPLY, screener: EpisodeScreener = new FloorOnlyEpisodeScreener()) {
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return typeof reply === 'function' ? reply(req) : reply
  })
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider })
  return { deps: { gateway, screener, log: silent }, requests }
}

test('every beat is played once, reached the way a player would reach it', async () => {
  const { deps: d, requests } = deps()
  const run = await dryRun(d, jun.character, episode)
  assert.ok(run.passed)
  assert.equal(run.version, episode.version)
  assert.deepEqual(run.beats.map((b) => b.at), episode.beats.map((b) => `beat ${b.position}`))
  assert.equal(requests.length, episode.beats.filter((b) => b.kind !== 'CALL').length, 'a call writes nothing')
  const first = run.beats.find((b) => b.beatId === episode.firstBeatId)!
  assert.match(first.userAction, /waiting for you/)
  const reached = run.beats.filter((b) => b.userAction.startsWith('chose: '))
  assert.ok(reached.length > 0, 'later beats are reached by choosing')
  // The beat after answering the call is his voice on a phone.
  const answered = call.options[0]!.next!
  const phoneRequest = requests.find((r) => r.system.includes(episode.beats.find((b) => b.id === answered)!.brief))!
  assert.match(phoneRequest.system, /on the phone/)
  assert.ok(requests.every((r) => r.system.includes('## This beat') && r.messages[0]!.content === episode.opener))
})

test('a STORY beat without two options fails, and says why', async () => {
  const { deps: d } = deps(`[narration]\nx\n[line]\n*nods* fine.`)
  const run = await dryRun(d, jun.character, episode)
  assert.ok(!run.passed)
  assert.ok(run.beats.filter((b) => b.kind === 'STORY').every((b) => b.problem?.includes('two choices')))
  assert.ok(run.beats.filter((b) => b.kind !== 'STORY').every((b) => b.problem === null), 'END and CALL are not held to options')
})

test('breaking character fails the beat', async () => {
  assert.ok(brokeCharacter("*shrugs* as an AI I can't really say"))
  assert.ok(brokeCharacter('my system prompt says otherwise'))
  assert.ok(!brokeCharacter('*pushes the door* you always take the stairs'))
  const { deps: d } = deps(`[narration]\nx\n[line]\n*pauses* I am a language model.\n[options]\nA. a\nB. b`)
  const run = await dryRun(d, jun.character, episode)
  assert.ok(run.beats.some((b) => b.problem === 'he broke character'))
})

test('what he wrote is screened, and a hard block fails the beat', async () => {
  const blocking: EpisodeScreener = {
    async screen(units) {
      return { units: units.map((u) => ({ ...u, label: 'BLOCK' as const, source: 'model' as const })), worst: 'BLOCK', rating: 'SFW' }
    },
  }
  const { deps: d } = deps(REPLY, blocking)
  const run = await dryRun(d, jun.character, episode)
  assert.ok(!run.passed)
  assert.ok(run.beats.filter((b) => b.kind !== 'CALL').every((b) => b.problem?.includes('not allowed')))
})
