import type { MomentCard, RelationshipStage } from '@odyssey/shared'
import { evaluateUnlocks } from '../moments/unlocks.js'
import type { AppRepository, ConversationContext, RelationshipRecord } from '../repo/types.js'
import { applyFacts, applyUserMessage, type ProgressResult } from './rules.js'

interface Log {
  info(obj: Record<string, unknown>, msg: string): void
}

export interface ProgressOutcome {
  relationship: RelationshipRecord
  previousStage: RelationshipStage | null
  /** Moments whose earned unlock was recorded by this step. */
  newlyUnlocked: MomentCard[]
}

/** Applies the rules to a relationship row and records the audit trail. */
export class RelationshipService {
  constructor(
    private readonly repo: AppRepository,
    private readonly log: Log
  ) {}

  /** Runs before generation so a stage change shapes the reply that follows. */
  async onUserMessage(ctx: ConversationContext): Promise<ProgressOutcome> {
    const result = applyUserMessage(ctx.relationship)
    const relationship = await this.persist(ctx.relationship, result)
    if (result.previousStage) {
      this.log.info(
        { relationshipId: relationship.id, from: result.previousStage, to: relationship.stage },
        'stage advanced'
      )
    }
    const newlyUnlocked = await this.unlockEarned(relationship)
    return { relationship, previousStage: result.previousStage, newlyUnlocked }
  }

  /** Runs from the memory job after facts are stored. Affinity only. */
  async onFactsShared(ctx: ConversationContext, count: number): Promise<void> {
    if (count <= 0) return
    const result = applyFacts(ctx.relationship, count)
    await this.persist(ctx.relationship, result)
  }

  private async persist(current: RelationshipRecord, result: ProgressResult): Promise<RelationshipRecord> {
    const { next, events, previousStage } = result
    if (!events.length && !previousStage && next.activeDays === current.activeDays) return current
    const updated = await this.repo.updateRelationship(current.id, {
      stage: next.stage,
      affinity: next.affinity,
      activeDays: next.activeDays,
      lastActiveDate: next.lastActiveDate,
      messageGainsToday: next.messageGainsToday,
      factGainsToday: next.factGainsToday,
      ...(previousStage ? { stageChangedAt: new Date() } : {}),
    })
    if (events.length) {
      await this.repo.insertRelationshipEvents(
        events.map((e) => ({ relationshipId: current.id, delta: e.delta, reason: e.reason }))
      )
    }
    return updated
  }

  private async unlockEarned(relationship: RelationshipRecord): Promise<MomentCard[]> {
    const moments = await this.repo.listMoments(relationship.characterId)
    const { newlyUnlocked } = await evaluateUnlocks(this.repo, moments, relationship)
    return newlyUnlocked
  }
}
