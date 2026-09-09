import type { MomentCard, RelationshipStage } from '@odyssey/shared'
import { evaluateUnlocks } from '../moments/unlocks.js'
import type { AppRepository, ConversationContext, RelationshipRecord } from '../repo/types.js'
import { RULES, applyFacts, applyUserMessage, type ProgressResult } from './rules.js'

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

  /** A story choice's authored affinity. Small and uncapped by the day: it is content, not grinding. */
  async onChoice(relationship: RelationshipRecord, delta: number, reason: string): Promise<RelationshipRecord> {
    if (!delta) return relationship
    const affinity = Math.max(0, Math.min(RULES.maxAffinity, relationship.affinity + delta))
    if (affinity === relationship.affinity) return relationship
    const updated = await this.repo.updateRelationship(relationship.id, { affinity })
    await this.repo.insertRelationshipEvents([{ relationshipId: relationship.id, delta: affinity - relationship.affinity, reason }])
    return updated
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
    const [moments, purchases] = await Promise.all([
      this.repo.listMoments(relationship.characterId),
      this.repo.listPurchases(relationship.userId),
    ])
    const skus = new Set(purchases.filter((p) => !p.refundedAt).map((p) => p.productId))
    const { newlyUnlocked } = await evaluateUnlocks(this.repo, moments, relationship, skus)
    return newlyUnlocked
  }
}
