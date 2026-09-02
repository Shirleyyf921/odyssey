import { renderFactExtractionPrompt, renderSummaryPrompt } from '@odyssey/prompts'
import type { Message } from '@odyssey/shared'
import type { LlmGateway } from '../llm/gateway.js'
import type { ModelTier } from '../llm/types.js'
import type { ChatRepository, ConversationContext } from '../repo/types.js'
import type { EmbeddingProvider } from './embeddings.js'

export interface MemoryOptions {
  /** Verbatim turns kept in the prompt. Older ones are folded into the summary. */
  shortTermTurns: number
  /** Fold when this many messages have accumulated past the short-term window. */
  summaryBatch: number
  /** Memories retrieved per turn. */
  retrieveK: number
  /** Tier for extraction and summarization. */
  tier: ModelTier
}

export const DEFAULT_MEMORY_OPTIONS: MemoryOptions = {
  shortTermTurns: 20,
  summaryBatch: 12,
  retrieveK: 6,
  tier: 'PIVOTAL',
}

/** Called after facts are stored, with how many. Lets progression credit sharing without a dependency on it. */
export type FactsHook = (ctx: ConversationContext, count: number) => Promise<void>

export interface AssembledMemory {
  /** Verbatim short-term window, oldest first. */
  history: Message[]
  summary: string
  memories: string[]
}

interface Log {
  info(obj: Record<string, unknown>, msg: string): void
  error(obj: Record<string, unknown>, msg: string): void
}

/**
 * The four memory layers from ARCHITECTURE.md section 4, minus relationship
 * state which lives on the Relationship row.
 *
 * Reads happen on the reply path and must stay cheap: one summary read, one
 * embedding call, one vector query. Writes happen after the reply is sent and
 * never block it. LIGHT relationships skip the long-term layer entirely.
 */
export class MemoryService {
  private readonly opts: MemoryOptions
  private readonly pending = new Set<Promise<void>>()

  constructor(
    private readonly repo: ChatRepository,
    private readonly gateway: LlmGateway,
    private readonly embeddings: EmbeddingProvider | null,
    private readonly log: Log,
    opts: Partial<MemoryOptions> = {},
    private readonly onFacts: FactsHook | null = null
  ) {
    this.opts = { ...DEFAULT_MEMORY_OPTIONS, ...opts }
  }

  async assemble(ctx: ConversationContext, query: string): Promise<AssembledMemory> {
    const summary = await this.repo.getSummary(ctx.conversation.id)
    const window = await this.repo.listMessagesAfter(
      ctx.conversation.id,
      summary.throughMessageId,
      this.opts.shortTermTurns + this.opts.summaryBatch
    )
    const history = window.slice(-this.opts.shortTermTurns)

    let memories: string[] = []
    if (ctx.relationship.depth === 'DEEP') {
      const found = await this.retrieve(ctx.relationship.id, query)
      memories = found.map((m) => m.fact)
    }
    return { history, summary: summary.text, memories }
  }

  /** Schedules extraction and summary folding. Returns immediately; await `drain()` to wait. */
  afterTurn(ctx: ConversationContext, userMessage: Message, reply: Message): void {
    const job = this.runAfterTurn(ctx, userMessage, reply)
      .catch((err) => this.log.error({ err, conversationId: ctx.conversation.id }, 'memory job failed'))
      .finally(() => this.pending.delete(job))
    this.pending.add(job)
  }

  /** Waits for in-flight jobs. Used by tests and graceful shutdown. */
  async drain(): Promise<void> {
    await Promise.all([...this.pending])
  }

  // ---------------------------------------------------------------- internals

  private async retrieve(relationshipId: string, query: string) {
    if (!this.embeddings) return this.repo.listMemories(relationshipId, this.opts.retrieveK)
    const [vec] = await this.embeddings.embed([query])
    if (!vec) return []
    return this.repo.searchMemories(relationshipId, vec, this.opts.retrieveK)
  }

  private async runAfterTurn(ctx: ConversationContext, userMessage: Message, reply: Message) {
    if (ctx.relationship.depth === 'DEEP') await this.extract(ctx, userMessage, reply)
    await this.foldSummary(ctx)
  }

  private async extract(ctx: ConversationContext, userMessage: Message, reply: Message) {
    const userName = ctx.user.displayName ?? 'the user'
    const prompt = renderFactExtractionPrompt({
      characterName: ctx.character.name,
      userName,
      transcript: transcript([userMessage, reply], ctx.character.name, userName),
    })
    const raw = await this.complete(prompt, 'Extract the facts.')
    const facts = parseFacts(raw)
    if (!facts.length) return

    const vectors = this.embeddings ? await this.embeddings.embed(facts.map((f) => f.fact)) : []
    await this.repo.insertMemories(
      facts.map((f, i) => ({
        relationshipId: ctx.relationship.id,
        fact: f.fact,
        confidence: f.confidence,
        embedding: vectors[i] ?? null,
      }))
    )
    this.log.info({ relationshipId: ctx.relationship.id, count: facts.length }, 'memories stored')
    await this.onFacts?.(ctx, facts.length)
  }

  private async foldSummary(ctx: ConversationContext) {
    const summary = await this.repo.getSummary(ctx.conversation.id)
    const unsummarized = await this.repo.listMessagesAfter(
      ctx.conversation.id,
      summary.throughMessageId,
      this.opts.shortTermTurns + this.opts.summaryBatch
    )
    const overflow = unsummarized.length - this.opts.shortTermTurns
    if (overflow < this.opts.summaryBatch) return

    const toFold = unsummarized.slice(0, overflow)
    const userName = ctx.user.displayName ?? 'the user'
    const prompt = renderSummaryPrompt({
      characterName: ctx.character.name,
      userName,
      previousSummary: summary.text,
      transcript: transcript(toFold, ctx.character.name, userName),
    })
    const text = (await this.complete(prompt, 'Write the updated summary.')).trim()
    const last = toFold.at(-1)
    if (!text || !last) return
    await this.repo.setSummary(ctx.conversation.id, { text, throughMessageId: last.id })
    this.log.info({ conversationId: ctx.conversation.id, folded: toFold.length }, 'summary updated')
  }

  private async complete(system: string, user: string): Promise<string> {
    let out = ''
    for await (const ev of this.gateway.stream(this.opts.tier, {
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 600,
      temperature: 0.2,
    })) {
      if (ev.type === 'delta') out += ev.text
    }
    return out
  }
}

function transcript(messages: Message[], characterName: string, userName: string): string {
  return messages
    .filter((m) => m.role !== 'SYSTEM')
    .map((m) => `${m.role === 'USER' ? userName : characterName}: ${m.content}`)
    .join('\n')
}

/** Tolerates prose around the array and drops anything that is not a fact object. */
export function parseFacts(raw: string): Array<{ fact: string; confidence: number }> {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: Array<{ fact: string; confidence: number }> = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const fact = (item as { fact?: unknown }).fact
    if (typeof fact !== 'string' || !fact.trim()) continue
    const c = (item as { confidence?: unknown }).confidence
    const confidence = typeof c === 'number' && c >= 0 && c <= 1 ? c : 0.5
    out.push({ fact: fact.trim(), confidence })
  }
  return out
}
