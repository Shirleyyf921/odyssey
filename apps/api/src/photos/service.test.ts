import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tier } from '@odyssey/shared'
import type { ChatDeps } from '../chat/handler.js'
import { LlmGateway } from '../llm/gateway.js'
import { ScriptedProvider } from '../llm/scripted.js'
import type { CompletionRequest } from '../llm/types.js'
import { MemoryService } from '../memory/service.js'
import { RelationshipService } from '../relationship/service.js'
import { MemoryRepository } from '../repo/memory.js'
import { NoopCrisisDetector } from '../safety/crisis.js'
import { ScriptedImageProvider } from './provider.js'
import { PhotoRefused, PhotoService } from './service.js'

const silent = { info() {}, warn() {}, error() {} }
const SCENE = '{"scene": "Ash at the window at four in the morning, glasses pushed up, the chipped mug you left in March on the sill, looking over his shoulder at the camera, not smiling.", "caption": "You left it here. I still have not moved it."}'

async function setup(tier: Tier = 'PLUS', reply: string | ((req: CompletionRequest) => string) = SCENE) {
  const repo = new MemoryRepository()
  const demo = await repo.seedDemo()
  const requests: CompletionRequest[] = []
  const provider = new ScriptedProvider((req) => {
    requests.push(req)
    return typeof reply === 'function' ? reply(req) : reply
  })
  const gateway = new LlmGateway({ EVERYDAY: provider, PIVOTAL: provider, STORY: provider })
  const memory = new MemoryService(repo, gateway, null, silent)
  const images = new ScriptedImageProvider()
  const deps: ChatDeps = {
    repo,
    gateway,
    memory,
    relationship: new RelationshipService(repo, silent),
    crisis: new NoopCrisisDetector(),
    channel: 'web',
    billing: { async tierOf() { return tier }, async credit() {} },
    user: { id: demo.userId, displayName: 'Shirley', locale: 'en-US', ageVerifiedAt: null },
    log: silent,
  }
  const ctx = (await repo.getConversationContext(demo.conversationId))!
  const photos = new PhotoService(images, { perDayPlus: 1 })
  return { repo, deps, ctx, demo, images, requests, photos }
}

test('Plus asks once: the scene comes from the story model with what he remembers, the picture is hers alone', async () => {
  const { repo, deps, ctx, demo, images, requests, photos } = await setup('PLUS')
  await repo.insertMessage({ conversationId: demo.conversationId, role: 'USER', content: 'send me one of you', clientMsgId: null, inReplyTo: null })
  const { moment, message } = await photos.ask(deps, ctx)

  // The prompt to the image model: the rules, his look, the model's scene, the rating's reach, his hero as reference.
  assert.equal(images.prompts.length, 1)
  const sent = images.prompts[0]!
  assert.ok(sent.prompt.includes('Ash, twenty-nine'), 'his look line')
  assert.ok(sent.prompt.includes('chipped mug'), 'the scene the model wrote')
  assert.ok(sent.prompt.includes('no bare torso'), 'SFW reach when no story is open')
  assert.ok(sent.prompt.includes('he does not grin'), 'the expression rule')
  assert.equal(sent.references.length, 1, 'his hero rides along')
  // The scene prompt saw the last line.
  assert.ok(requests[0]!.system.includes('you: send me one of you'))

  // What she gets: an unlocked card of his, a message carrying it, and nobody else sees the card.
  assert.equal(moment.status, 'UNLOCKED')
  assert.equal(moment.asked, true)
  assert.equal(moment.caption, 'You left it here. I still have not moved it.')
  assert.ok(moment.imageUrl?.endsWith(`/photos/${moment.id}.jpg`))
  assert.equal(message.momentId, moment.id)
  assert.equal(message.role, 'CHARACTER')
  assert.ok((await repo.getPhotoBlob(moment.id))?.image.length)
  assert.equal((await repo.listUnlocks(demo.relationshipId)).find((u) => u.momentId === moment.id)?.source, 'ASKED')
  assert.ok((await repo.listMoments(demo.characterId, demo.userId)).some((m) => m.id === moment.id), 'she sees it')
  assert.ok(!(await repo.listMoments(demo.characterId)).some((m) => m.id === moment.id), 'the catalogue does not carry it')
  assert.ok(!(await repo.listMoments(demo.characterId, 'someone-else')).some((m) => m.id === moment.id), 'nobody else sees it')

  // Once a day on the allowance.
  await assert.rejects(photos.ask(deps, ctx), (err: unknown) => err instanceof PhotoRefused && err.code === 'USED_TODAY')
})

test('Free is refused to the paywall; a bought credit lets anyone ask, and a failed picture gives it back', async () => {
  const { repo, deps, ctx, demo, images, photos } = await setup('FREE')
  await assert.rejects(photos.ask(deps, ctx), (err: unknown) => err instanceof PhotoRefused && err.code === 'NEEDS_PLUS')

  await repo.addPhotoCredits(demo.userId, 1)
  const { moment } = await photos.ask(deps, ctx)
  assert.equal(moment.status, 'UNLOCKED')
  assert.equal(await repo.photoCredits(demo.userId), 0, 'the credit is spent')
  assert.equal(images.prompts.length, 1)

  await repo.addPhotoCredits(demo.userId, 1)
  images.generate = async () => { throw new Error('model down') }
  await assert.rejects(photos.ask(deps, ctx), (err: unknown) => err instanceof PhotoRefused && err.code === 'UNAVAILABLE')
  assert.equal(await repo.photoCredits(demo.userId), 1, 'given back')
})

test('when the story model does not answer in JSON, the scene falls back and the picture still comes', async () => {
  const { deps, ctx, images, photos } = await setup('PLUS', 'I would rather not say.')
  const { moment } = await photos.ask(deps, ctx)
  assert.equal(moment.caption, 'Here.')
  assert.ok(images.prompts[0]!.prompt.includes('SCENE: Ash,'))
})

test('no provider: refused as unavailable, nothing spent', async () => {
  const { repo, deps, ctx, demo } = await setup('PLUS')
  await repo.addPhotoCredits(demo.userId, 1)
  const off = new PhotoService(null, { perDayPlus: 1 })
  assert.equal(off.enabled, false)
  await assert.rejects(off.ask(deps, ctx), (err: unknown) => err instanceof PhotoRefused && err.code === 'UNAVAILABLE')
  assert.equal(await repo.photoCredits(demo.userId), 1)
})

test('the menu: NOW is SFW anywhere; the hotter kinds need the level, and reach further when given', async () => {
  const { repo, deps, ctx, demo, images, requests, photos } = await setup('PLUS')
  // ACQUAINTED, no age declaration: the hotter kinds are refused before anything is spent.
  await repo.addPhotoCredits(demo.userId, 1)
  await assert.rejects(photos.ask(deps, ctx, 'ONLY_YOU'), (err: unknown) => err instanceof PhotoRefused && err.code === 'LEVEL')
  assert.equal(await repo.photoCredits(demo.userId), 1, 'nothing spent')
  assert.equal(images.prompts.length, 0)

  await repo.updateUser(demo.userId, { ageVerifiedAt: new Date() })
  await repo.updateRelationship(demo.relationshipId, { stage: 'CLOSE' })
  const closer = (await repo.getConversationContext(demo.conversationId))!
  await assert.rejects(photos.ask({ ...deps, channel: 'store' }, closer, 'MORNING'), (err: unknown) => err instanceof PhotoRefused && err.code === 'LEVEL', 'never on the store build')
  const { moment } = await photos.ask({ ...deps, channel: 'web' }, closer, 'MORNING')
  assert.equal(moment.title, 'The morning')
  const sent = images.prompts.at(-1)!.prompt
  assert.ok(sent.includes('open shirt is allowed'), 'the MATURE reach')
  assert.ok(sent.includes('fully covered below the waist'), 'and its hard line')
  assert.ok(requests.at(-1)!.system.includes('the morning after'), 'what she asked for reaches the scene model')
})
