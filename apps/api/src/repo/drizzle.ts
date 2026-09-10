import { and, asc, cosineDistance, count, desc, eq, gt, gte, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm'
import type {
  AuthProvider,
  Beat,
  DraftBeat,
  EpisodeDraft,
  EpisodeRun,
  Message,
  Moment,
  MomentUnlock,
  MomentUnlockSource,
  Portrait,
  RelationshipDepth,
  ReportReason,
  Scene,
} from '@odyssey/shared'
import type { Db } from '../db/client.js'
import {
  authIdentities,
  beats,
  characters,
  conversations,
  episodeReports,
  episodeRuns,
  episodes,
  memories,
  messages,
  momentUnlocks,
  moments,
  portraits,
  purchases,
  relationshipEvents,
  relationships,
  scenes,
  sessions,
  subscriptions,
  users,
} from '../db/schema.js'
import type {
  AppRepository,
  CharacterRecord,
  ConversationContext,
  ConversationSummary,
  EpisodeRecord,
  CreateRunInput,
  EpisodePatch,
  EpisodeRunPatch,
  IdentityRecord,
  MemoryRecord,
  NewMemory,
  NewMessage,
  PurchaseRecord,
  RelationshipEvent,
  RelationshipPatch,
  RelationshipRecord,
  RunCounts,
  SessionRecord,
  SubscriptionRecord,
  UserRecord,
} from './types.js'

const userColumns = { id: users.id, displayName: users.displayName, locale: users.locale, ageVerifiedAt: users.ageVerifiedAt }

type MessageRow = typeof messages.$inferSelect
type RelationshipRow = typeof relationships.$inferSelect
type MemoryRow = typeof memories.$inferSelect
type EpisodeRow = typeof episodes.$inferSelect
type BeatRow = typeof beats.$inferSelect
type RunRow = typeof episodeRuns.$inferSelect

function toBeat(r: BeatRow): Beat {
  return {
    id: r.id,
    episodeId: r.episodeId,
    position: r.position,
    kind: r.kind,
    brief: r.brief,
    setting: r.setting,
    options: r.options,
    next: r.nextBeatId,
    photoMomentId: r.photoMomentId,
    callUrl: r.callUrl,
    callSeconds: r.callSeconds,
    hotspots: r.hotspots,
  }
}

function toBeatRow(episodeId: string, b: DraftBeat): typeof beats.$inferInsert {
  return {
    id: b.id,
    episodeId,
    position: b.position,
    kind: b.kind,
    brief: b.brief,
    setting: b.setting,
    options: b.options,
    nextBeatId: b.next,
    photoMomentId: b.photoMomentId,
    callUrl: b.callUrl,
    callSeconds: b.callSeconds,
    hotspots: b.hotspots,
  }
}

function toEpisode(r: EpisodeRow, beatRows: BeatRow[]): EpisodeRecord {
  return {
    id: r.id,
    characterId: r.characterId,
    position: r.position,
    title: r.title,
    premise: r.premise,
    setting: r.setting,
    opener: r.opener,
    sceneId: r.sceneId,
    rating: r.rating,
    unlock: r.unlockRule,
    firstBeatId: r.firstBeatId,
    authorId: r.authorId,
    origin: r.origin,
    status: r.status,
    version: r.version,
    reviewNote: r.reviewNote,
    dryRun: r.dryRun ?? null,
    beats: beatRows.sort((a, b) => a.position - b.position).map(toBeat),
  }
}

function toRun(r: RunRow): EpisodeRun {
  return {
    id: r.id,
    relationshipId: r.relationshipId,
    episodeId: r.episodeId,
    currentBeatId: r.currentBeatId,
    episodeVersion: r.episodeVersion,
    path: r.path,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
  }
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    clientMsgId: row.clientMsgId,
    inReplyTo: row.inReplyTo,
    momentId: row.momentId,
    createdAt: row.createdAt.toISOString(),
  }
}

function toRelationship(row: RelationshipRow, conversationId: string, sceneId: string | null = null): RelationshipRecord {
  return {
    id: row.id,
    userId: row.userId,
    characterId: row.characterId,
    depth: row.depth,
    stage: row.stage,
    affinity: row.affinity,
    startedAt: row.startedAt.toISOString(),
    conversationId,
    sceneId,
    activeDays: row.activeDays,
    lastActiveDate: row.lastActiveDate,
    messageGainsToday: row.messageGainsToday,
    factGainsToday: row.factGainsToday,
  }
}

function toMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    relationshipId: row.relationshipId,
    fact: row.fact,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  }
}

export class DrizzleRepository implements AppRepository {
  constructor(private readonly db: Db) {}

  // ---------------------------------------------------------------- users

  async getOrCreateUserByDevice(deviceId: string): Promise<UserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({ deviceId })
      .onConflictDoUpdate({ target: users.deviceId, set: { deviceId } })
      .returning(userColumns)
    if (!row) throw new Error('user upsert returned no row')
    return row
  }

  async getUser(id: string) {
    const [row] = await this.db.select(userColumns).from(users).where(eq(users.id, id)).limit(1)
    return row ?? null
  }

  async createUser(input: { displayName: string | null }): Promise<UserRecord> {
    const [row] = await this.db.insert(users).values({ displayName: input.displayName }).returning(userColumns)
    if (!row) throw new Error('user insert returned no row')
    return row
  }

  async updateUser(id: string, patch: { displayName?: string | null; ageVerifiedAt?: Date | null }) {
    const [row] = await this.db.update(users).set(patch).where(eq(users.id, id)).returning(userColumns)
    if (!row) throw new Error(`unknown user ${id}`)
    return row
  }

  // ---------------------------------------------------------------- auth

  async findIdentity(provider: AuthProvider, subject: string) {
    const [row] = await this.db
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, provider), eq(authIdentities.subject, subject)))
      .limit(1)
    return row ? { userId: row.userId, provider: row.provider, subject: row.subject, email: row.email } : null
  }

  async createIdentity(input: IdentityRecord) {
    await this.db.insert(authIdentities).values(input)
    return input
  }

  async listIdentities(userId: string): Promise<IdentityRecord[]> {
    const rows = await this.db.select().from(authIdentities).where(eq(authIdentities.userId, userId))
    return rows.map((r) => ({ userId: r.userId, provider: r.provider, subject: r.subject, email: r.email }))
  }

  async createSession(input: SessionRecord) {
    await this.db.insert(sessions).values(input)
  }

  async findUserBySession(tokenHash: string, now: Date) {
    const [row] = await this.db
      .select(userColumns)
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
      .limit(1)
    return row ?? null
  }

  async revokeSession(tokenHash: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenHash))
  }

  async mergeUsers(fromUserId: string, intoUserId: string) {
    return this.db.transaction(async (tx) => {
      const taken = await tx
        .select({ characterId: relationships.characterId })
        .from(relationships)
        .where(eq(relationships.userId, intoUserId))
      const takenIds = taken.map((t) => t.characterId)
      const moved = await tx
        .update(relationships)
        .set({ userId: intoUserId })
        .where(
          takenIds.length
            ? and(eq(relationships.userId, fromUserId), notInArray(relationships.characterId, takenIds))
            : eq(relationships.userId, fromUserId)
        )
        .returning({ id: relationships.id })
      // The device follows the account so the next anonymous request lands on it, unless
      // the account already owns another device.
      const [from] = await tx.select({ deviceId: users.deviceId }).from(users).where(eq(users.id, fromUserId)).limit(1)
      const [into] = await tx.select({ deviceId: users.deviceId }).from(users).where(eq(users.id, intoUserId)).limit(1)
      await tx.update(users).set({ deviceId: null }).where(eq(users.id, fromUserId))
      if (from?.deviceId && into && !into.deviceId) {
        await tx.update(users).set({ deviceId: from.deviceId }).where(eq(users.id, intoUserId))
      }
      // Paid state follows the person. A subscription the account already holds for the
      // same entitlement wins; the guest's row is then dropped by the cascade below.
      const held = await tx
        .select({ entitlement: subscriptions.entitlement })
        .from(subscriptions)
        .where(eq(subscriptions.userId, intoUserId))
      const heldIds = held.map((h) => h.entitlement)
      await tx
        .update(subscriptions)
        .set({ userId: intoUserId })
        .where(
          heldIds.length
            ? and(eq(subscriptions.userId, fromUserId), notInArray(subscriptions.entitlement, heldIds))
            : eq(subscriptions.userId, fromUserId)
        )
      await tx.update(purchases).set({ userId: intoUserId }).where(eq(purchases.userId, fromUserId))
      // Cascades the colliding relationships, their messages, unlocks, memories, and sessions.
      await tx.delete(users).where(eq(users.id, fromUserId))
      return { moved: moved.length }
    })
  }

  // ---------------------------------------------------------------- characters

  async listCharacters(): Promise<CharacterRecord[]> {
    return this.db.select().from(characters).orderBy(asc(characters.createdAt))
  }

  async getCharacter(id: string) {
    const [row] = await this.db.select().from(characters).where(eq(characters.id, id)).limit(1)
    return row ?? null
  }

  async listPortraits(characterId: string): Promise<Portrait[]> {
    return this.db
      .select()
      .from(portraits)
      .where(eq(portraits.characterId, characterId))
      .orderBy(asc(portraits.position))
  }

  // ---------------------------------------------------------------- relationships

  private relationshipQuery() {
    return this.db
      .select({ relationship: relationships, conversationId: conversations.id, sceneId: conversations.sceneId })
      .from(relationships)
      .innerJoin(conversations, eq(conversations.relationshipId, relationships.id))
  }

  async listRelationships(userId: string) {
    const rows = await this.relationshipQuery().where(eq(relationships.userId, userId))
    return rows.map((r) => toRelationship(r.relationship, r.conversationId, r.sceneId))
  }

  async findRelationship(userId: string, characterId: string) {
    const [row] = await this.relationshipQuery()
      .where(and(eq(relationships.userId, userId), eq(relationships.characterId, characterId)))
      .limit(1)
    return row ? toRelationship(row.relationship, row.conversationId, row.sceneId) : null
  }

  async createRelationship(userId: string, characterId: string, depth: RelationshipDepth, sceneId: string | null = null) {
    return this.db.transaction(async (tx) => {
      const [rel] = await tx
        .insert(relationships)
        .values({ userId, characterId, depth })
        .onConflictDoNothing()
        .returning()
      if (!rel) {
        const existing = await this.findRelationship(userId, characterId)
        if (!existing) throw new Error('relationship exists but could not be read')
        return existing
      }
      const [conv] = await tx
        .insert(conversations)
        .values({ relationshipId: rel.id, sceneId })
        .returning({ id: conversations.id })
      if (!conv) throw new Error('conversation insert returned no row')
      return toRelationship(rel, conv.id, sceneId)
    })
  }

  async listScenes(characterId: string): Promise<Scene[]> {
    const rows = await this.db.select().from(scenes).where(eq(scenes.characterId, characterId)).orderBy(asc(scenes.position))
    return rows.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      title: r.title,
      setting: r.setting,
      opener: r.opener,
      backdropUrl: r.backdropUrl,
      position: r.position,
    }))
  }

  async updateRelationship(id: string, patch: RelationshipPatch) {
    const [row] = await this.db.update(relationships).set(patch).where(eq(relationships.id, id)).returning()
    if (!row) throw new Error(`unknown relationship ${id}`)
    const [conv] = await this.db
      .select({ id: conversations.id, sceneId: conversations.sceneId })
      .from(conversations)
      .where(eq(conversations.relationshipId, id))
      .limit(1)
    if (!conv) throw new Error(`relationship ${id} has no conversation`)
    return toRelationship(row, conv.id, conv.sceneId)
  }

  async insertRelationshipEvents(events: RelationshipEvent[]) {
    if (!events.length) return
    await this.db.insert(relationshipEvents).values(events)
  }

  // ---------------------------------------------------------------- moments

  async listMoments(characterId: string): Promise<Moment[]> {
    const rows = await this.db
      .select()
      .from(moments)
      .where(eq(moments.characterId, characterId))
      .orderBy(asc(moments.position))
    return rows.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      title: r.title,
      caption: r.caption,
      imageUrl: r.imageUrl,
      teaserUrl: r.teaserUrl,
      position: r.position,
      unlock: r.unlockRule,
    }))
  }

  async listUnlocks(relationshipId: string): Promise<MomentUnlock[]> {
    const rows = await this.db.select().from(momentUnlocks).where(eq(momentUnlocks.relationshipId, relationshipId))
    return rows.map((r) => ({
      relationshipId: r.relationshipId,
      momentId: r.momentId,
      source: r.source,
      unlockedAt: r.unlockedAt.toISOString(),
    }))
  }

  async insertUnlock(input: { relationshipId: string; momentId: string; source: MomentUnlockSource }) {
    const [row] = await this.db
      .insert(momentUnlocks)
      .values(input)
      .onConflictDoUpdate({
        target: [momentUnlocks.relationshipId, momentUnlocks.momentId],
        set: { relationshipId: input.relationshipId },
      })
      .returning()
    if (!row) throw new Error('unlock upsert returned no row')
    return { relationshipId: row.relationshipId, momentId: row.momentId, source: row.source, unlockedAt: row.unlockedAt.toISOString() }
  }

  // ---------------------------------------------------------------- episodes

  async listEpisodes(characterId: string): Promise<EpisodeRecord[]> {
    const rows = await this.db
      .select()
      .from(episodes)
      .where(and(eq(episodes.characterId, characterId), eq(episodes.status, 'LIVE')))
      .orderBy(asc(episodes.position))
    if (!rows.length) return []
    const beatRows = await this.db
      .select()
      .from(beats)
      .where(inArray(beats.episodeId, rows.map((r) => r.id)))
    return rows.map((r) => toEpisode(r, beatRows.filter((b) => b.episodeId === r.id)))
  }

  async getEpisode(id: string) {
    const [row] = await this.db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
    if (!row) return null
    const beatRows = await this.db.select().from(beats).where(eq(beats.episodeId, id))
    return toEpisode(row, beatRows)
  }

  // ---------------------------------------------------------------- authoring (docs/ugc-pipeline.md)

  async listEpisodesByAuthor(userId: string): Promise<EpisodeRecord[]> {
    const rows = await this.db.select().from(episodes).where(eq(episodes.authorId, userId)).orderBy(desc(episodes.createdAt))
    if (!rows.length) return []
    const beatRows = await this.db
      .select()
      .from(beats)
      .where(inArray(beats.episodeId, rows.map((r) => r.id)))
    return rows.map((r) => toEpisode(r, beatRows.filter((b) => b.episodeId === r.id)))
  }

  async createEpisode(authorId: string, draft: EpisodeDraft): Promise<EpisodeRecord> {
    const { beats: draftBeats, ...fields } = draft
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(episodes)
        .values({ ...fields, unlockRule: { kind: 'FREE' }, authorId, origin: 'UGC', status: 'DRAFT', version: 1, position: 0, reviewNote: null })
        .returning()
      if (!row) throw new Error('episode insert returned no row')
      const beatRows = await tx.insert(beats).values(draftBeats.map((b) => toBeatRow(row.id, b))).returning()
      return toEpisode(row, beatRows)
    })
  }

  async replaceEpisode(id: string, draft: EpisodeDraft): Promise<EpisodeRecord> {
    const { beats: draftBeats, characterId: _characterId, ...fields } = draft
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(episodes).set(fields).where(eq(episodes.id, id)).returning()
      if (!row) throw new Error('episode not found')
      await tx.delete(beats).where(eq(beats.episodeId, id))
      const beatRows = await tx.insert(beats).values(draftBeats.map((b) => toBeatRow(id, b))).returning()
      return toEpisode(row, beatRows)
    })
  }

  async updateEpisode(id: string, patch: EpisodePatch): Promise<EpisodeRecord> {
    const [row] = await this.db.update(episodes).set(patch).where(eq(episodes.id, id)).returning()
    if (!row) throw new Error('episode not found')
    const beatRows = await this.db.select().from(beats).where(eq(beats.episodeId, id))
    return toEpisode(row, beatRows)
  }

  async deleteEpisode(id: string) {
    await this.db.delete(episodes).where(eq(episodes.id, id))
  }

  async listRuns(relationshipId: string) {
    const rows = await this.db.select().from(episodeRuns).where(eq(episodeRuns.relationshipId, relationshipId))
    return rows.map(toRun)
  }

  async findRun(relationshipId: string, episodeId: string) {
    const [row] = await this.db
      .select()
      .from(episodeRuns)
      .where(and(eq(episodeRuns.relationshipId, relationshipId), eq(episodeRuns.episodeId, episodeId)))
      .limit(1)
    return row ? toRun(row) : null
  }

  async createRun(input: CreateRunInput) {
    const [row] = await this.db
      .insert(episodeRuns)
      .values({ ...input, path: [input.currentBeatId] })
      .returning()
    if (!row) throw new Error('run insert returned no row')
    return toRun(row)
  }

  async updateRun(id: string, patch: EpisodeRunPatch) {
    const [row] = await this.db.update(episodeRuns).set(patch).where(eq(episodeRuns.id, id)).returning()
    if (!row) throw new Error(`unknown run ${id}`)
    return toRun(row)
  }

  async countRuns(episodeIds: string[]): Promise<Map<string, RunCounts>> {
    if (!episodeIds.length) return new Map()
    const rows = await this.db
      .select({
        episodeId: episodeRuns.episodeId,
        started: count(),
        finished: count(episodeRuns.endedAt),
      })
      .from(episodeRuns)
      .where(inArray(episodeRuns.episodeId, episodeIds))
      .groupBy(episodeRuns.episodeId)
    return new Map(rows.map((r) => [r.episodeId, { started: Number(r.started), finished: Number(r.finished) }]))
  }

  async reportEpisode(input: { episodeId: string; reporterId: string; reason: ReportReason }) {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(episodeReports)
        .values(input)
        .onConflictDoNothing({ target: [episodeReports.episodeId, episodeReports.reporterId] })
        .returning({ id: episodeReports.id })
      if (inserted.length) {
        const [row] = await tx
          .update(episodes)
          .set({ reportCount: sql`${episodes.reportCount} + 1` })
          .where(eq(episodes.id, input.episodeId))
          .returning({ reportCount: episodes.reportCount })
        return { counted: true, reportCount: row?.reportCount ?? 0 }
      }
      const [row] = await tx.select({ reportCount: episodes.reportCount }).from(episodes).where(eq(episodes.id, input.episodeId)).limit(1)
      return { counted: false, reportCount: row?.reportCount ?? 0 }
    })
  }

  // ---------------------------------------------------------------- billing

  async upsertSubscription(input: SubscriptionRecord) {
    await this.db
      .insert(subscriptions)
      .values({ ...input, syncedAt: new Date() })
      .onConflictDoUpdate({
        target: [subscriptions.userId, subscriptions.entitlement],
        set: {
          productId: input.productId,
          store: input.store,
          environment: input.environment,
          purchasedAt: input.purchasedAt,
          expiresAt: input.expiresAt,
          unsubscribedAt: input.unsubscribedAt,
          billingIssueAt: input.billingIssueAt,
          rcAppUserId: input.rcAppUserId,
          syncedAt: new Date(),
        },
      })
  }

  async listSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    const rows = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId))
    return rows.map((r) => ({
      userId: r.userId,
      entitlement: r.entitlement,
      productId: r.productId,
      store: r.store,
      environment: r.environment,
      purchasedAt: r.purchasedAt,
      expiresAt: r.expiresAt,
      unsubscribedAt: r.unsubscribedAt,
      billingIssueAt: r.billingIssueAt,
      rcAppUserId: r.rcAppUserId,
    }))
  }

  async upsertPurchase(input: PurchaseRecord) {
    await this.db
      .insert(purchases)
      .values({ ...input, syncedAt: new Date() })
      .onConflictDoUpdate({
        target: purchases.storeTransactionId,
        set: {
          userId: input.userId,
          productId: input.productId,
          store: input.store,
          environment: input.environment,
          purchasedAt: input.purchasedAt,
          refundedAt: input.refundedAt,
          rcAppUserId: input.rcAppUserId,
          syncedAt: new Date(),
        },
      })
  }

  async listPurchases(userId: string): Promise<PurchaseRecord[]> {
    const rows = await this.db.select().from(purchases).where(eq(purchases.userId, userId))
    return rows.map((r) => ({
      userId: r.userId,
      productId: r.productId,
      store: r.store,
      environment: r.environment,
      storeTransactionId: r.storeTransactionId,
      purchasedAt: r.purchasedAt,
      refundedAt: r.refundedAt,
      rcAppUserId: r.rcAppUserId,
    }))
  }

  // ---------------------------------------------------------------- chat

  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    const [row] = await this.db
      .select({
        conversation: { id: conversations.id, relationshipId: conversations.relationshipId, sceneId: conversations.sceneId },
        relationship: relationships,
        character: {
          id: characters.id,
          kind: characters.kind,
          name: characters.name,
          personaNotes: characters.personaNotes,
        },
        user: userColumns,
      })
      .from(conversations)
      .innerJoin(relationships, eq(relationships.id, conversations.relationshipId))
      .innerJoin(characters, eq(characters.id, relationships.characterId))
      .innerJoin(users, eq(users.id, relationships.userId))
      .where(eq(conversations.id, conversationId))
      .limit(1)
    if (!row) return null
    const scene = row.conversation.sceneId
      ? ((await this.listScenes(row.character.id)).find((sc) => sc.id === row.conversation.sceneId) ?? null)
      : null
    return {
      conversation: { id: row.conversation.id, relationshipId: row.conversation.relationshipId, scene },
      relationship: toRelationship(row.relationship, row.conversation.id, row.conversation.sceneId),
      character: row.character,
      user: row.user,
    }
  }

  async findByClientMsgId(conversationId: string, clientMsgId: string) {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.clientMsgId, clientMsgId)))
      .limit(1)
    return row ? toMessage(row) : null
  }

  async findReplyTo(messageId: string) {
    const [row] = await this.db.select().from(messages).where(eq(messages.inReplyTo, messageId)).limit(1)
    return row ? toMessage(row) : null
  }

  async insertMessage(input: NewMessage): Promise<Message> {
    const [row] = await this.db
      .insert(messages)
      .values({
        ...(input.id ? { id: input.id } : {}),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        clientMsgId: input.clientMsgId,
        inReplyTo: input.inReplyTo,
        momentId: input.momentId ?? null,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
      })
      .returning()
    if (!row) throw new Error('insert returned no row')
    return toMessage(row)
  }

  async listRecentMessages(conversationId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
    return rows.reverse().map(toMessage)
  }

  async listMessagesAfter(conversationId: string, afterId: string | null, limit: number) {
    let after: Date | null = null
    if (afterId) {
      const [anchor] = await this.db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, afterId))
        .limit(1)
      after = anchor?.createdAt ?? null
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        after
          ? and(eq(messages.conversationId, conversationId), gt(messages.createdAt, after))
          : eq(messages.conversationId, conversationId)
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit)
    return rows.map(toMessage)
  }

  async countUserMessagesSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(relationships, eq(relationships.id, conversations.relationshipId))
      .where(and(eq(relationships.userId, userId), eq(messages.role, 'USER'), gte(messages.createdAt, since)))
    return row?.n ?? 0
  }

  async listOfferedMoments(conversationId: string) {
    const rows = await this.db
      .select({ momentId: messages.momentId, createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNotNull(messages.momentId)))
      .orderBy(asc(messages.createdAt))
    return rows.flatMap((r) => (r.momentId ? [{ momentId: r.momentId, createdAt: r.createdAt.toISOString() }] : []))
  }

  // ---------------------------------------------------------------- memory

  async getSummary(conversationId: string): Promise<ConversationSummary> {
    const [row] = await this.db
      .select({ text: conversations.summary, throughMessageId: conversations.summaryThroughMessageId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)
    return row ?? { text: '', throughMessageId: null }
  }

  async setSummary(conversationId: string, summary: ConversationSummary) {
    await this.db
      .update(conversations)
      .set({ summary: summary.text, summaryThroughMessageId: summary.throughMessageId })
      .where(eq(conversations.id, conversationId))
  }

  async insertMemories(items: NewMemory[]) {
    if (!items.length) return
    await this.db.insert(memories).values(items)
  }

  async searchMemories(relationshipId: string, embedding: number[], limit: number) {
    const distance = cosineDistance(memories.embedding, embedding)
    const rows = await this.db
      .select()
      .from(memories)
      .where(and(eq(memories.relationshipId, relationshipId), isNotNull(memories.embedding)))
      .orderBy(sql`${distance} asc`)
      .limit(limit)
    return rows.map(toMemory)
  }

  async listMemories(relationshipId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(memories)
      .where(eq(memories.relationshipId, relationshipId))
      .orderBy(desc(memories.createdAt))
      .limit(limit)
    return rows.map(toMemory)
  }
}
