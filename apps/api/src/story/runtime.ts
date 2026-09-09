import { randomUUID } from 'node:crypto'
import { renderStoryTurn } from '@odyssey/prompts'
import { toMomentCard, type Beat, type ClientEvent, type EpisodeRun, type RelationshipStage, type ServerEvent } from '@odyssey/shared'
import { availability, toEpisodeCard } from '../episodes/availability.js'
import { TOUCH_PHRASE, allowedHotspots } from './touch.js'
import type { CompletionRequest } from '../llm/types.js'
import type { AssembledMemory } from '../memory/service.js'
import type { ConversationContext, EpisodeRecord } from '../repo/types.js'
import { chooseTier } from '../chat/tier.js'
import type { ChatDeps, Send } from '../chat/handler.js'
import { generateStoryTurn } from './generate.js'

/**
 * Story mode inside the conversation (docs/story-pipeline.md, runtime). The
 * chat handler owns the turn (auth, caps, crisis, progression, memory); this
 * module owns what changes when an episode is open: which beat we are on,
 * where a choice leads, the prompt, and the events after his line.
 */

export interface StoryState {
  run: EpisodeRun
  episode: EpisodeRecord
  beat: Beat
}

export async function activeStory(deps: ChatDeps, ctx: ConversationContext): Promise<StoryState | null> {
  const runs = await deps.repo.listRuns(ctx.relationship.id)
  const run = runs.find((r) => !r.endedAt)
  if (!run) return null
  const episode = await deps.repo.getEpisode(run.episodeId)
  const beat = episode?.beats.find((b) => b.id === run.currentBeatId)
  if (!episode || !beat) {
    deps.log.error({ runId: run.id }, 'story: run points at a missing episode or beat; ending it')
    await deps.repo.updateRun(run.id, { endedAt: new Date() })
    return null
  }
  return { run, episode, beat }
}

/** Button text while nothing has been generated for this beat yet: the authored intents. */
function intentsOf(beat: Beat): string[] {
  return beat.options.map((o) => o.intent)
}

function choicesEvent(
  conversationId: string,
  messageId: string,
  episode: EpisodeRecord,
  beat: Beat,
  options: string[],
  stage: RelationshipStage
): ServerEvent {
  return {
    type: 'choices',
    conversationId,
    messageId,
    options: beat.kind === 'STORY' ? options : [],
    beat: {
      position: episode.beats.findIndex((b) => b.id === beat.id) + 1,
      count: episode.beats.length,
      kind: beat.kind,
      // Filtered here, so the stage never has to be told what it has not earned.
      hotspots: allowedHotspots(beat, stage),
    },
  }
}

/** start_episode: open or resume. His opener becomes a real message on a new run. */
export async function handleStartEpisode(
  deps: ChatDeps,
  ctx: ConversationContext,
  event: Extract<ClientEvent, { type: 'start_episode' }>,
  send: Send
): Promise<void> {
  const { repo, billing, log } = deps
  const episode = await repo.getEpisode(event.episodeId)
  if (!episode || episode.characterId !== ctx.character.id) {
    return send({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Unknown episode' })
  }
  const [all, runs, tier] = await Promise.all([repo.listEpisodes(ctx.character.id), repo.listRuns(ctx.relationship.id), billing.tierOf(ctx.user.id)])
  const open = runs.find((r) => !r.endedAt)
  if (open && open.episodeId !== episode.id) {
    return send({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Finish the open episode first' })
  }
  const state = availability(episode, ctx.relationship, tier, runs, all)
  if (state.status === 'LOCKED') return send({ type: 'error', code: 'QUOTA_EXCEEDED', message: state.lockReason ?? 'Not yet' })
  if (state.status === 'DONE') return send({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Already played' })

  let run = open ?? null
  let message = null
  if (!run) {
    run = await repo.createRun({ relationshipId: ctx.relationship.id, episodeId: episode.id, currentBeatId: episode.firstBeatId })
    message = await repo.insertMessage({
      conversationId: ctx.conversation.id,
      role: 'CHARACTER',
      content: episode.opener,
      clientMsgId: null,
      inReplyTo: null,
    })
    log.info({ conversationId: ctx.conversation.id, episodeId: episode.id, runId: run.id }, 'episode started')
  }
  const runsNow = run === open ? runs : [...runs, run]
  send({ type: 'episode_started', conversationId: ctx.conversation.id, episode: toEpisodeCard(episode, ctx.relationship, tier, runsNow, all), message })
  const beat = episode.beats.find((b) => b.id === run.currentBeatId)!
  const lastCharacter = message ?? (await repo.listRecentMessages(ctx.conversation.id, 20)).filter((m) => m.role === 'CHARACTER').at(-1)
  if (lastCharacter) send(choicesEvent(ctx.conversation.id, lastCharacter.id, episode, beat, intentsOf(beat), ctx.relationship.stage))
}

/** After a resume, put the chips back if an episode is open. Intents, since options are not stored. */
export async function choicesAfterResume(deps: ChatDeps, ctx: ConversationContext, send: Send): Promise<void> {
  const story = await activeStory(deps, ctx)
  if (!story) return
  const last = (await deps.repo.listRecentMessages(ctx.conversation.id, 20)).filter((m) => m.role === 'CHARACTER').at(-1)
  if (last) send(choicesEvent(ctx.conversation.id, last.id, story.episode, story.beat, intentsOf(story.beat), ctx.relationship.stage))
}

export interface StoryTurnInput {
  event: Extract<ClientEvent, { type: 'send_message' }>
  ctx: ConversationContext
  story: StoryState
  assembled: AssembledMemory
  userMessageId: string
  signals: { stageChanged: boolean; pivotalAllowed: boolean }
  /** Copy of the persona directive for the last message of a free day; null otherwise. */
  turnDirective: string | null
}

/**
 * One story turn: resolve the beat, generate it, store his message, advance the
 * run. Returns the stored reply id so the handler can log and run afterTurn.
 * Sends: message_start, section-tagged deltas, message_end, then choices or
 * episode_ended, then a beat photo if there is one.
 */
export async function runStoryTurn(deps: ChatDeps, input: StoryTurnInput, send: Send): Promise<{ replyId: string; model: string | null; usage: { inputTokens: number; outputTokens: number } | null } | null> {
  const { repo, gateway, relationship, log } = deps
  const { event, story, assembled } = input
  let { ctx } = input
  const conversationId = ctx.conversation.id

  // Where the choice leads. Free text and touches stay on the beat; a choice moves
  // and is credited.
  const touch = event.touch && allowedHotspots(story.beat, ctx.relationship.stage).includes(event.touch) ? event.touch : null
  const chosen = !touch && event.choice !== undefined ? (story.beat.options[event.choice] ?? null) : null
  let target: Beat | null = story.beat
  let userAction = touch ? TOUCH_PHRASE[touch] : event.content
  if (chosen) {
    userAction = `chose: ${event.content}`
    const rel = await relationship.onChoice(ctx.relationship, chosen.affinity, `story:${story.episode.id}:${story.beat.position}:${event.choice}`)
    ctx = { ...ctx, relationship: rel }
    target = chosen.next ? (story.episode.beats.find((b) => b.id === chosen.next) ?? null) : null
    if (!target) {
      log.error({ beatId: story.beat.id, choice: event.choice }, 'story: option points nowhere; ending on the current beat')
      target = { ...story.beat, kind: 'END', options: [] }
    }
  }
  const beat = target
  const expectOptions = beat.kind === 'STORY' && !touch

  const system = renderStoryTurn({
    characterName: ctx.character.name,
    userName: ctx.user.displayName,
    personaNotes: ctx.character.personaNotes,
    stage: ctx.relationship.stage,
    justAdvanced: input.signals.stageChanged,
    conversationSummary: assembled.summary || '(nothing before this)',
    retrievedMemories: assembled.memories,
    episode: { title: story.episode.title, premise: story.episode.premise, setting: story.episode.setting },
    beat: {
      kind: beat.kind === 'END' ? 'END' : 'STORY',
      brief: beat.brief,
      setting: beat.setting,
      optionIntents: expectOptions ? beat.options.map((o) => o.intent) : [],
      hotspots: beat.hotspots,
    },
    userAction,
    opening: false,
    reacting: !!touch,
  })
  const request: CompletionRequest = {
    system: input.turnDirective ? `${system}\n\n## Right now\n- ${input.turnDirective}` : system,
    messages: assembled.history
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', content: m.content })),
  }
  const modelTier = chooseTier(ctx, event.content, input.signals)

  const messageId = randomUUID()
  send({ type: 'message_start', messageId, conversationId })
  let result
  try {
    result = await generateStoryTurn(gateway, modelTier, request, {
      expectOptions,
      onEvent: (e) => send({ type: 'message_delta', messageId, delta: e.delta, section: e.section }),
      log,
    })
  } catch (err) {
    log.error({ err, tier: modelTier, conversationId }, 'story generation failed')
    send({ type: 'error', code: 'UPSTREAM_UNAVAILABLE', message: 'He could not answer right now. Try again in a moment.' })
    return null
  }

  const reply = await repo.insertMessage({
    id: messageId,
    conversationId,
    role: 'CHARACTER',
    content: result.raw,
    clientMsgId: null,
    inReplyTo: input.userMessageId,
    model: result.model,
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
  })
  send({ type: 'message_end', messageId, message: reply })

  // Advance the run, then tell the client what is next. A touch never advances.
  const moved = beat.id !== story.beat.id
  const ended = beat.kind === 'END'
  await repo.updateRun(story.run.id, {
    ...(moved ? { currentBeatId: beat.id, path: [...story.run.path, beat.id] } : {}),
    ...(ended ? { endedAt: new Date() } : {}),
  })
  if (ended) {
    log.info({ conversationId, episodeId: story.episode.id, path: [...story.run.path, ...(moved ? [beat.id] : [])] }, 'episode ended')
    send({ type: 'episode_ended', conversationId, episodeId: story.episode.id })
  } else if (!touch) {
    send(choicesEvent(conversationId, messageId, story.episode, beat, result.turn.options.length >= 2 ? result.turn.options : [], ctx.relationship.stage))
  }

  // A photo written into this beat goes out locked, once.
  if (moved && beat.photoMomentId) await offerBeatPhoto(deps, ctx, beat.photoMomentId, send)

  log.info({ conversationId, episodeId: story.episode.id, beat: beat.position, moved, touch, repaired: result.repaired }, 'story turn')
  return { replyId: reply.id, model: result.model, usage: result.usage }
}

async function offerBeatPhoto(deps: ChatDeps, ctx: ConversationContext, momentId: string, send: Send): Promise<void> {
  const { repo, log } = deps
  const [moments, unlocks, offered] = await Promise.all([
    repo.listMoments(ctx.character.id),
    repo.listUnlocks(ctx.relationship.id),
    repo.listOfferedMoments(ctx.conversation.id),
  ])
  const moment = moments.find((m) => m.id === momentId)
  if (!moment || offered.some((o) => o.momentId === momentId)) return
  const unlock = unlocks.find((u) => u.momentId === momentId) ?? null
  const message = await repo.insertMessage({
    conversationId: ctx.conversation.id,
    role: 'CHARACTER',
    content: moment.caption,
    clientMsgId: null,
    inReplyTo: null,
    momentId: moment.id,
  })
  log.info({ conversationId: ctx.conversation.id, momentId }, 'beat photo sent')
  send({ type: 'moment_offer', message, moment: toMomentCard(moment, unlock) })
}
