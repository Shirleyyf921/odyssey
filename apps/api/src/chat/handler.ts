import { randomUUID } from 'node:crypto'
import type { ClientEvent, ServerEvent } from '@odyssey/shared'
import type { LlmGateway } from '../llm/gateway.js'
import type { MemoryService } from '../memory/service.js'
import type { RelationshipService } from '../relationship/service.js'
import type { ChatRepository, UserRecord } from '../repo/types.js'
import { INTERVENTION_BODY, resourcesFor, type CrisisDetector } from '../safety/crisis.js'
import { buildCompletionRequest } from './prompt.js'
import { chooseTier } from './tier.js'

export interface ChatDeps {
  repo: ChatRepository
  gateway: LlmGateway
  memory: MemoryService
  relationship: RelationshipService
  crisis: CrisisDetector
  /** The authenticated user behind this socket. */
  user: UserRecord
  log: { info(obj: Record<string, unknown>, msg: string): void; error(obj: Record<string, unknown>, msg: string): void }
}

export type Send = (event: ServerEvent) => void

/** Dispatch one validated client event. Transport-agnostic so it can be tested without a socket. */
export async function handleClientEvent(deps: ChatDeps, event: ClientEvent, send: Send): Promise<void> {
  switch (event.type) {
    case 'send_message':
      return handleSendMessage(deps, event, send)
    case 'resume':
      return handleResume(deps, event, send)
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
  const { repo, gateway, memory, relationship, crisis, log } = deps
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

  const userMessage = await repo.insertMessage({
    conversationId: event.conversationId,
    role: 'USER',
    content: event.content,
    clientMsgId: event.clientMsgId,
    inReplyTo: null,
  })
  send({ type: 'message_ack', clientMsgId: event.clientMsgId, message: userMessage })

  // Crisis screening runs before generation and short-circuits it. The persona never
  // gets a chance to answer; the client renders the intervention outside his voice.
  const verdict = await crisis.screen(event.content, ctx.user.locale)
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

  // Progression runs before generation so a stage change shapes the reply. The
  // client hears about it before he speaks, and any moment it earned arrives with it.
  const affinityBefore = ctx.relationship.affinity
  const progress = await relationship.onUserMessage(ctx)
  ctx = { ...ctx, relationship: progress.relationship }
  if (progress.previousStage || progress.relationship.affinity !== affinityBefore) {
    const { userId: _u, conversationId: _c, activeDays: _a, lastActiveDate: _l, messageGainsToday: _m, factGainsToday: _f, ...pub } =
      progress.relationship
    send({ type: 'relationship_updated', relationship: pub, previousStage: progress.previousStage })
  }
  for (const moment of progress.newlyUnlocked) {
    send({ type: 'moment_unlocked', relationshipId: progress.relationship.id, moment })
  }

  const assembled = await memory.assemble(ctx, event.content)
  const request = buildCompletionRequest(ctx, assembled, { previousStage: progress.previousStage })
  const tier = chooseTier(ctx, event.content, { stageChanged: progress.previousStage !== null })

  const messageId = randomUUID()
  send({ type: 'message_start', messageId, conversationId: event.conversationId })

  let content = ''
  let model: string | null = null
  let usage: { inputTokens: number; outputTokens: number } | null = null
  try {
    for await (const chunk of gateway.stream(tier, request)) {
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
    log.error({ err, tier, conversationId: event.conversationId }, 'generation failed')
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
    { conversationId: event.conversationId, tier, model, memories: assembled.memories.length, ...usage },
    'turn complete'
  )
  send({ type: 'message_end', messageId, message: reply })

  // Memory writes never block the reply path.
  memory.afterTurn(ctx, userMessage, reply)
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
}
