import { renderReachOut, renderRelationshipContext } from '@odyssey/prompts'
import type { Message } from '@odyssey/shared'
import type { LlmGateway } from '../llm/gateway.js'
import type { MemoryService } from '../memory/service.js'
import type { AppRepository, RelationshipRecord } from '../repo/types.js'

interface Log {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

/** UTC calendar day, the same key `lastActiveDate` uses. */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)

function nightsBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/**
 * He reaches out first (ARCHITECTURE.md section 8), on demand and inside the
 * rate limit the section demands: only when they have not written today, at
 * most once a day, and never twice unanswered. No push yet: the message is
 * written into the conversation and the home screen shows it, so it is
 * waiting when they open the app. Content carries context or it is not sent.
 */
export class ReachOutService {
  constructor(
    private readonly repo: AppRepository,
    private readonly gateway: LlmGateway,
    private readonly memory: MemoryService,
    private readonly log: Log
  ) {}

  /** Whether he would write today. Pure, so the route and the test agree. */
  static due(r: Pick<RelationshipRecord, 'lastActiveDate' | 'reachedOutOn'>, today = dayKey()): boolean {
    if (!r.lastActiveDate || r.lastActiveDate >= today) return false
    if (r.reachedOutOn === today) return false
    // He wrote after their last message and they never answered: he does not write again.
    if (r.reachedOutOn && r.reachedOutOn > r.lastActiveDate) return false
    return true
  }

  async maybeReachOut(relationship: RelationshipRecord, today = dayKey()): Promise<Message | null> {
    if (!ReachOutService.due(relationship, today)) return null
    const ctx = await this.repo.getConversationContext(relationship.conversationId)
    if (!ctx) return null
    const runs = await this.repo.listRuns(relationship.id)
    const open = runs.find((r) => !r.endedAt)
    const episode = open ? await this.repo.getEpisode(open.episodeId) : null
    const beat = episode?.beats.find((b) => b.id === open!.currentBeatId)
    const assembled = await this.memory.assemble(ctx, 'what they told him, what they were doing, what they were in the middle of')
    const system = renderReachOut({
      characterName: ctx.character.name,
      userName: ctx.user.displayName,
      personaNotes: ctx.character.personaNotes,
      relationshipContext: renderRelationshipContext(relationship.stage, false),
      conversationSummary: assembled.summary || '(nothing before this)',
      retrievedMemories: assembled.memories,
      nightsGone: Math.max(1, nightsBetween(relationship.lastActiveDate!, today)),
      leftOff: episode && beat ? { title: episode.title, beat: beat.position + 1, count: episode.beats.length } : null,
    })
    let text = ''
    try {
      for await (const chunk of this.gateway.stream('STORY', { system, messages: [{ role: 'user', content: '(write first)' }], maxTokens: 160, temperature: 0.9 })) {
        if (chunk.type === 'delta') text += chunk.text
        else if (chunk.type === 'refusal') throw new Error('refusal')
      }
    } catch (err) {
      this.log.warn({ err: err instanceof Error ? err.message : String(err), relationshipId: relationship.id }, 'reach-out: generation failed; nothing sent')
      return null
    }
    text = text.trim()
    if (!text) return null
    const message = await this.repo.insertMessage({ conversationId: relationship.conversationId, role: 'CHARACTER', content: text, clientMsgId: null, inReplyTo: null })
    await this.repo.updateRelationship(relationship.id, { reachedOutOn: today })
    this.log.info({ relationshipId: relationship.id, characterId: relationship.characterId, nightsGone: nightsBetween(relationship.lastActiveDate!, today) }, 'reach-out: he wrote first')
    return message
  }
}
