import { randomUUID } from 'node:crypto'
import type { Channel, ClientEvent, ServerEvent, Tier } from '@odyssey/shared'
import { DAILY_CAP_MESSAGE, LAST_MESSAGE_DIRECTIVE, rulesFor, utcDayStart } from '../billing/rules.js'
import type { LlmGateway } from '../llm/gateway.js'
import type { MemoryService } from '../memory/service.js'
import type { RelationshipService } from '../relationship/service.js'
import type { AppRepository, UserRecord } from '../repo/types.js'
import { pickOffer } from '../moments/offers.js'
import { toMomentCard } from '@odyssey/shared'
import { INTERVENTION_BODY, resourcesFor, type CrisisDetector } from '../safety/crisis.js'
import { buildCompletionRequest } from './prompt.js'
import { chooseTier } from './tier.js'
import { activeStory, choicesAfterResume, handleStartEpisode, runStoryTurn } from '../story/runtime.js'
import { TOUCH_PHRASE } from '../story/touch.js'

export interface ChatDeps {
  repo: AppRepository
  gateway: LlmGateway
  memory: MemoryService
  relationship: RelationshipService
  crisis: CrisisDetector
  /** Paid state, read once per turn; and the creator credit, written when a run ends (episodes/credits.ts). */
  billing: { tierOf(userId: string): Promise<Tier>; credit(userId: string, days: number): Promise<unknown> }
  /** Which build opened this socket. See episodes/rating.ts. */
  channel: Channel
  /** The authenticated user behind this socket. */
  user: UserRecord
  log: {
    info(obj: Record<string, unknown>, msg: string): void
    warn(obj: Record<string, unknown>, msg: string): void
    error(obj: Record<string, unknown>, msg: string): void
  }
}

export type Send = (event: ServerEvent) => void

/** Dispatch one validated client event. Transport-agnostic so it can be tested without a socket. */
export async function handleClientEvent(deps: ChatDeps, event: ClientEvent, send: Send): Promise<void> {
  switch (event.type) {
    case 'send_message':
      return handleSendMessage(deps, event, send)
    case 'resume':
      return handleResume(deps, event, send)
    case 'start_episode': {
      const ctx = await authorize(deps, event.conversationId, send)
      if (!ctx) return
      return handleStartEpisode(deps, ctx, event, send)
    }
  }
}

async function authorize(deps: ChatDeps, conversationId: string, send: Send) {
  const ctx = await deps.repo.getConversationContext(conversationId)
  if (!ctx) {
    send({ type: 'error', code: 'INVALID_PAYLOAD', message: 'Unknown conversation' })
    return null
  }
  if (ctx.relationship.userId !== deps.user.id) {
    send({ type: 'error', code: 'UNAUTHORIZED', message: 'Not your conversation' })
    return null
  }
  return ctx
}

async function handleSendMessage(
  deps: ChatDeps,
  event: Extract<ClientEvent, { type: 'send_message' }>,
  send: Send
): Promise<void> {
  const { repo, gateway, memory, relationship, crisis, billing, log } = deps
  let ctx = await authorize(deps, event.conversationId, send)
  if (!ctx) return

  // Idempotency: a retried send gets the original reply, never a second generation.
  const existing = await repo.findByClientMsgId(event.conversationId, event.clientMsgId)
  if (existing) {
    const reply = await repo.findReplyTo(existing.id)
    return send({
      type: 'history',
      conversationId: event.conversationId,
      messages: reply ? [existing, reply] : [existing],
    })
  }

  // Tier rules (ARCHITECTURE.md section 7). The hard cap is checked before anything is
  // stored, so a refused message leaves no trace and costs nothing.
  const now = new Date()
  const [tier, sentToday] = await Promise.all([
    billing.tierOf(deps.user.id),
    repo.countUserMessagesSince(deps.user.id, utcDayStart(now)),
  ])
  const rules = rulesFor(tier, ctx.relationship, now)
  if (rules.dailyMessages !== null && sentToday >= rules.dailyMessages) {
    log.info({ conversationId: event.conversationId, tier, sentToday }, 'daily cap reached')
    return send({ type: 'error', code: 'QUOTA_EXCEEDED', message: DAILY_CAP_MESSAGE })
  }
  const lastOfDay = rules.dailyMessages !== null && sentToday + 1 === rules.dailyMessages
  const pastCeiling = rules.softCeiling !== null && sentToday + 1 > rules.softCeiling

  // An open episode changes what this turn is, so it is read before anything is stored.
  const story = await activeStory(deps, ctx)
  // A touch's text is written by the server (story/touch.ts), never by the client.
  const touchPhrase = story && event.touch && story.beat.hotspots.includes(event.touch) ? TOUCH_PHRASE[event.touch] : null
  const userMessage = await repo.insertMessage({
    conversationId: event.conversationId,
    role: 'USER',
    content: touchPhrase ?? event.content,
    clientMsgId: event.clientMsgId,
    inReplyTo: null,
  })
  send({ type: 'message_ack', clientMsgId: event.clientMsgId, message: userMessage })

  // Crisis screening runs before generation and short-circuits it. The persona never
  // gets a chance to answer; the client renders the intervention outside his voice.
  // An authored choice is our own text, not the user's state, so it is not screened:
  // a classifier reading "stay until the rain stops" as distress would break the story
  // for nothing. Free text inside a story is screened like any message.
  const ours =
    !!story &&
    ((event.choice !== undefined && story.beat.options[event.choice] !== undefined) ||
      (event.touch !== undefined && story.beat.hotspots.includes(event.touch)))
  const verdict = ours ? { crisis: false } : await crisis.screen(event.content, ctx.user.locale)
  if (verdict.crisis) {
    await repo.insertMessage({
      conversationId: event.conversationId,
      role: 'SYSTEM',
      content: INTERVENTION_BODY,
      clientMsgId: null,
      inReplyTo: userMessage.id,
    })
    // Incident record for human review (section 12). Ids only: the message itself is in the
    // conversation, and this line must be safe to ship to a log vendor.
    log.info(
      { conversationId: event.conversationId, userId: ctx.user.id, messageId: userMessage.id, locale: ctx.user.locale },
      'safety intervention'
    )
    return send({
      type: 'safety_intervention',
      conversationId: event.conversationId,
      body: INTERVENTION_BODY,
      resources: resourcesFor(ctx.user.locale),
    })
  }

  // Progression runs before generation so a stage change shapes the reply. It is
  // silent on the client (2026-09-09): the relationship shows through what opens,
  // never as a notice. Earned moments are still announced.
  const progress = await relationship.onUserMessage(ctx)
  ctx = { ...ctx, relationship: progress.relationship }
  for (const moment of progress.newlyUnlocked) {
    send({ type: 'moment_unlocked', relationshipId: progress.relationship.id, moment })
  }

  const assembled = await memory.assemble(ctx, event.content, {
    longTerm: rules.longTermMemory,
    retrieveK: rules.retrieveK,
  })

  // An open episode takes the turn from here (docs/story-pipeline.md).
  if (story) {
    const outcome = await runStoryTurn(
      deps,
      {
        event,
        ctx,
        story,
        assembled,
        userMessageId: userMessage.id,
        signals: { stageChanged: progress.previousStage !== null, pivotalAllowed: rules.pivotal && !pastCeiling },
        turnDirective: lastOfDay ? LAST_MESSAGE_DIRECTIVE : null,
      },
      send
    )
    if (!outcome) return
    log.info(
      { conversationId: event.conversationId, plan: tier, sentToday: sentToday + 1, longTerm: rules.longTermMemory, model: outcome.model, story: story.episode.id, ...outcome.usage },
      'turn complete'
    )
    const reply = await repo.findReplyTo(userMessage.id)
    if (reply) memory.afterTurn(ctx, userMessage, reply)
    return
  }
  const request = buildCompletionRequest(ctx, assembled, {
    previousStage: progress.previousStage,
    turnDirective: lastOfDay ? LAST_MESSAGE_DIRECTIVE : null,
  })
  const modelTier = chooseTier(ctx, event.content, {
    stageChanged: progress.previousStage !== null,
    pivotalAllowed: rules.pivotal && !pastCeiling,
  })

  const messageId = randomUUID()
  send({ type: 'message_start', messageId, conversationId: event.conversationId })

  let content = ''
  let model: string | null = null
  let usage: { inputTokens: number; outputTokens: number } | null = null
  try {
    for await (const chunk of gateway.stream(modelTier, request)) {
      if (chunk.type === 'delta') {
        content += chunk.text
        send({ type: 'message_delta', messageId, delta: chunk.text })
      } else if (chunk.type === 'done') {
        model = chunk.model
        usage = chunk.usage
      } else {
        // A refusal that reached here came from EVERYDAY with nothing to fall back to.
        throw new Error(`refusal from ${chunk.model}`)
      }
    }
  } catch (err) {
    log.error({ err, tier: modelTier, conversationId: event.conversationId }, 'generation failed')
    return send({
      type: 'error',
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'He could not answer right now. Try again in a moment.',
    })
  }

  const reply = await repo.insertMessage({
    id: messageId,
    conversationId: event.conversationId,
    role: 'CHARACTER',
    content,
    clientMsgId: null,
    inReplyTo: userMessage.id,
    model,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
  })
  log.info(
    {
      conversationId: event.conversationId,
      tier: modelTier,
      plan: tier,
      sentToday: sentToday + 1,
      longTerm: rules.longTermMemory,
      model,
      memories: assembled.memories.length,
      ...usage,
    },
    'turn complete'
  )
  send({ type: 'message_end', messageId, message: reply })

  // He may follow the reply with a photo (section 14). The card goes out locked:
  // teaser only, the asset stays on the server until the SKU is bought.
  const offer = await maybeOffer(deps, ctx, {
    sentToday: sentToday + 1,
    stageChanged: progress.previousStage !== null,
    now,
  })
  if (offer) send(offer)

  // Memory writes never block the reply path.
  memory.afterTurn(ctx, userMessage, reply)
}

async function maybeOffer(
  deps: ChatDeps,
  ctx: Awaited<ReturnType<typeof authorize>> & object,
  signals: { sentToday: number; stageChanged: boolean; now: Date }
): Promise<Extract<ServerEvent, { type: 'moment_offer' }> | null> {
  const { repo, log } = deps
  const conversationId = ctx.conversation.id
  const [moments, unlocks, offered] = await Promise.all([
    repo.listMoments(ctx.character.id),
    repo.listUnlocks(ctx.relationship.id),
    repo.listOfferedMoments(conversationId),
  ])
  const moment = pickOffer(moments, unlocks, offered, signals)
  if (!moment) return null
  const message = await repo.insertMessage({
    conversationId,
    role: 'CHARACTER',
    content: moment.caption,
    clientMsgId: null,
    inReplyTo: null,
    momentId: moment.id,
  })
  log.info({ conversationId, momentId: moment.id, sku: moment.unlock.kind === 'PURCHASE' ? moment.unlock.sku : null }, 'moment offered')
  return { type: 'moment_offer', message, moment: toMomentCard(moment, null) }
}

async function handleResume(
  deps: ChatDeps,
  event: Extract<ClientEvent, { type: 'resume' }>,
  send: Send
): Promise<void> {
  const ctx = await authorize(deps, event.conversationId, send)
  if (!ctx) return
  const messages = await deps.repo.listMessagesAfter(event.conversationId, event.lastMessageId, 200)
  send({ type: 'history', conversationId: event.conversationId, messages })
  await choicesAfterResume(deps, ctx, send)
}
