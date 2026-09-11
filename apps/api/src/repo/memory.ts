import { randomUUID } from 'node:crypto'
import type {
  AuthProvider,
  EpisodeDraft,
  ReviewReport,
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
import { SEED_CHARACTERS } from '../content/seed.js'
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

interface StoredMemory extends MemoryRecord {
  embedding: number[] | null
}

/**
 * In-memory repository. Used by tests and by local dev without Postgres.
 * Not for production: nothing survives a restart.
 */
export class MemoryRepository implements AppRepository {
  private users = new Map<string, UserRecord>()
  private usersByDevice = new Map<string, string>()
  private characters = new Map<string, CharacterRecord>()
  private portraits = new Map<string, Portrait[]>()
  private scenes = new Map<string, Scene[]>()
  private moments = new Map<string, Moment[]>()
  private episodes = new Map<string, EpisodeRecord[]>()
  private runs = new Map<string, EpisodeRun>()
  private reports = new Map<string, ReviewReport & { episodeId: string }>()
  private reportCounts = new Map<string, number>()
  private credits: Array<{ authorId: string; episodeId: string; runId: string; days: number; createdAt: Date }> = []
  private relationships = new Map<string, RelationshipRecord>()
  private conversations = new Map<
    string,
    { id: string; relationshipId: string; sceneId: string | null; summary: ConversationSummary }
  >()
  private messages = new Map<string, Message[]>()
  private unlocks = new Map<string, MomentUnlock[]>()
  private memories = new Map<string, StoredMemory[]>()
  readonly relationshipEvents: Array<RelationshipEvent & { createdAt: string }> = []
  private identities: IdentityRecord[] = []
  private sessions = new Map<string, SessionRecord & { revokedAt: Date | null }>()
  private subscriptions: SubscriptionRecord[] = []
  private purchases: PurchaseRecord[] = []

  constructor(seed = SEED_CHARACTERS) {
    for (const s of seed) {
      this.characters.set(s.character.id, s.character)
      this.portraits.set(s.character.id, [...s.portraits])
      this.scenes.set(s.character.id, [...s.scenes])
      this.moments.set(s.character.id, [...s.moments])
      this.episodes.set(s.character.id, s.episodes.map((e) => ({ ...e, beats: [...e.beats].sort((a, b) => a.position - b.position) })))
    }
  }

  /** One user with a relationship to the first seeded character. Returns the ids so a test can drive it. */
  async seedDemo(deviceId = randomUUID()) {
    const user = await this.getOrCreateUserByDevice(deviceId)
    const character = [...this.characters.values()][0]
    if (!character) throw new Error('no seeded characters')
    const relationship = await this.createRelationship(user.id, character.id, 'DEEP')
    // Demo relationships start warmed up so the seeded moments have something to unlock against.
    relationship.stage = 'ACQUAINTED'
    relationship.affinity = 20
    return {
      deviceId,
      userId: user.id,
      characterId: character.id,
      relationshipId: relationship.id,
      conversationId: relationship.conversationId,
    }
  }

  // ---------------------------------------------------------------- users

  async getOrCreateUserByDevice(deviceId: string): Promise<UserRecord> {
    const existing = this.usersByDevice.get(deviceId)
    if (existing) return this.users.get(existing)!
    const user: UserRecord = { id: randomUUID(), displayName: null, locale: 'en-US', ageVerifiedAt: null }
    this.users.set(user.id, user)
    this.usersByDevice.set(deviceId, user.id)
    return user
  }

  async getUser(id: string) {
    return this.users.get(id) ?? null
  }

  async createUser(input: { displayName: string | null }): Promise<UserRecord> {
    const user: UserRecord = { id: randomUUID(), displayName: input.displayName, locale: 'en-US', ageVerifiedAt: null }
    this.users.set(user.id, user)
    return user
  }

  async updateUser(id: string, patch: { displayName?: string | null; ageVerifiedAt?: Date | null }) {
    const user = this.users.get(id)
    if (!user) throw new Error(`unknown user ${id}`)
    const updated = {
      ...user,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.ageVerifiedAt !== undefined ? { ageVerifiedAt: patch.ageVerifiedAt } : {}),
    }
    this.users.set(id, updated)
    return updated
  }

  // ---------------------------------------------------------------- auth

  async findIdentity(provider: AuthProvider, subject: string) {
    return this.identities.find((i) => i.provider === provider && i.subject === subject) ?? null
  }

  async createIdentity(input: IdentityRecord) {
    if (await this.findIdentity(input.provider, input.subject)) throw new Error('identity exists')
    this.identities.push({ ...input })
    return input
  }

  async listIdentities(userId: string) {
    return this.identities.filter((i) => i.userId === userId)
  }

  async createSession(input: SessionRecord) {
    this.sessions.set(input.tokenHash, { ...input, revokedAt: null })
  }

  async findUserBySession(tokenHash: string, now: Date) {
    const s = this.sessions.get(tokenHash)
    if (!s || s.revokedAt || s.expiresAt <= now) return null
    return this.users.get(s.userId) ?? null
  }

  async revokeSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash)
    if (s) s.revokedAt = new Date()
  }

  async mergeUsers(fromUserId: string, intoUserId: string) {
    let moved = 0
    for (const rel of [...this.relationships.values()]) {
      if (rel.userId !== fromUserId) continue
      const collides = await this.findRelationship(intoUserId, rel.characterId)
      if (collides) {
        this.relationships.delete(rel.id)
        this.conversations.delete(rel.conversationId)
        this.messages.delete(rel.conversationId)
        this.unlocks.delete(rel.id)
        this.memories.delete(rel.id)
        continue
      }
      this.relationships.set(rel.id, { ...rel, userId: intoUserId })
      moved++
    }
    for (const [device, userId] of this.usersByDevice) {
      if (userId === fromUserId) this.usersByDevice.set(device, intoUserId)
    }
    for (const [hash, s] of this.sessions) if (s.userId === fromUserId) this.sessions.delete(hash)
    const heldEntitlements = new Set(this.subscriptions.filter((s) => s.userId === intoUserId).map((s) => s.entitlement))
    this.subscriptions = this.subscriptions.flatMap((s) => {
      if (s.userId !== fromUserId) return [s]
      return heldEntitlements.has(s.entitlement) ? [] : [{ ...s, userId: intoUserId }]
    })
    this.purchases = this.purchases.map((p) => (p.userId === fromUserId ? { ...p, userId: intoUserId } : p))
    this.users.delete(fromUserId)
    return { moved }
  }

  // ---------------------------------------------------------------- episodes

  async listEpisodes(characterId: string) {
    return [...(this.episodes.get(characterId) ?? [])].filter((e) => e.status === 'LIVE').sort((a, b) => a.position - b.position)
  }
  async listEpisodesByAuthor(userId: string) {
    return [...this.episodes.values()].flat().filter((e) => e.authorId === userId)
  }
  async createEpisode(authorId: string, draft: EpisodeDraft) {
    const id = randomUUID()
    const episode = this.fromDraft({ id, authorId, origin: 'UGC', status: 'DRAFT', version: 1, position: 0, unlock: { kind: 'FREE' }, reviewNote: null, dryRun: null }, draft)
    this.episodes.set(draft.characterId, [...(this.episodes.get(draft.characterId) ?? []), episode])
    return episode
  }
  async replaceEpisode(id: string, draft: EpisodeDraft) {
    const current = await this.getEpisode(id)
    if (!current) throw new Error('episode not found')
    const episode = this.fromDraft(current, draft)
    this.episodes.set(current.characterId, (this.episodes.get(current.characterId) ?? []).map((e) => (e.id === id ? episode : e)))
    return episode
  }
  async insertCredit(input: { authorId: string; episodeId: string; runId: string; days: number }) {
    if (this.credits.some((c) => c.runId === input.runId)) return false
    this.credits.push({ ...input, createdAt: new Date() })
    return true
  }
  async creditedDaysSince(authorId: string, since: Date) {
    return this.credits.filter((c) => c.authorId === authorId && c.createdAt >= since).reduce((n, c) => n + c.days, 0)
  }
  async creditedDaysOf(episodeIds: string[]) {
    const out = new Map<string, number>()
    for (const c of this.credits) if (episodeIds.includes(c.episodeId)) out.set(c.episodeId, (out.get(c.episodeId) ?? 0) + c.days)
    return out
  }
  async listEpisodesForReview() {
    return [...this.episodes.values()].flat().filter((e) => e.status === 'SUBMITTED' || e.status === 'UNLISTED')
  }
  async listReports(episodeId: string) {
    return [...this.reports.values()].filter((r) => r.episodeId === episodeId).map(({ reason, createdAt }) => ({ reason, createdAt }))
  }
  async updateEpisode(id: string, patch: EpisodePatch) {
    const current = await this.getEpisode(id)
    if (!current) throw new Error('episode not found')
    const { lastReviewedAt: _reviewed, reportCount, ...fields } = patch
    if (reportCount !== undefined) this.reportCounts.set(id, reportCount)
    const episode = { ...current, ...fields }
    this.episodes.set(current.characterId, (this.episodes.get(current.characterId) ?? []).map((e) => (e.id === id ? episode : e)))
    return episode
  }
  async deleteEpisode(id: string) {
    for (const [characterId, list] of this.episodes) this.episodes.set(characterId, list.filter((e) => e.id !== id))
  }
  private fromDraft(
    row: Pick<EpisodeRecord, 'id' | 'authorId' | 'origin' | 'status' | 'version' | 'position' | 'unlock' | 'reviewNote' | 'dryRun'>,
    draft: EpisodeDraft
  ): EpisodeRecord {
    const { beats, ...fields } = draft
    return { ...row, ...fields, beats: beats.map((b) => ({ ...b, episodeId: row.id })).sort((a, b) => a.position - b.position) }
  }
  async getEpisode(id: string) {
    for (const list of this.episodes.values()) {
      const hit = list.find((e) => e.id === id)
      if (hit) return hit
    }
    return null
  }
  async listRuns(relationshipId: string) {
    return [...this.runs.values()].filter((r) => r.relationshipId === relationshipId).map((r) => ({ ...r }))
  }
  async findRun(relationshipId: string, episodeId: string) {
    const hit = [...this.runs.values()].find((r) => r.relationshipId === relationshipId && r.episodeId === episodeId)
    return hit ? { ...hit } : null
  }
  async createRun(input: CreateRunInput) {
    if (await this.findRun(input.relationshipId, input.episodeId)) throw new Error('run already exists')
    const run: EpisodeRun = { id: randomUUID(), ...input, path: [input.currentBeatId], startedAt: new Date().toISOString(), endedAt: null }
    this.runs.set(run.id, run)
    return { ...run }
  }
  async updateRun(id: string, patch: EpisodeRunPatch) {
    const current = this.runs.get(id)
    if (!current) throw new Error(`unknown run ${id}`)
    const updated: EpisodeRun = {
      ...current,
      ...(patch.currentBeatId ? { currentBeatId: patch.currentBeatId } : {}),
      ...(patch.path ? { path: patch.path } : {}),
      ...(patch.endedAt !== undefined ? { endedAt: patch.endedAt?.toISOString() ?? null } : {}),
    }
    this.runs.set(id, updated)
    return { ...updated }
  }
  async countRuns(episodeIds: string[]) {
    const out = new Map<string, RunCounts>()
    for (const r of this.runs.values()) {
      if (!episodeIds.includes(r.episodeId)) continue
      const c = out.get(r.episodeId) ?? { started: 0, finished: 0 }
      c.started += 1
      if (r.endedAt) c.finished += 1
      out.set(r.episodeId, c)
    }
    return out
  }
  async reportEpisode(input: { episodeId: string; reporterId: string; reason: ReportReason }) {
    const key = `${input.episodeId}:${input.reporterId}`
    const counts = this.reportCounts
    if (this.reports.has(key)) return { counted: false, reportCount: counts.get(input.episodeId) ?? 0 }
    this.reports.set(key, { episodeId: input.episodeId, reason: input.reason, createdAt: new Date().toISOString() })
    const n = (counts.get(input.episodeId) ?? 0) + 1
    counts.set(input.episodeId, n)
    return { counted: true, reportCount: n }
  }

  // ---------------------------------------------------------------- billing

  async upsertSubscription(input: SubscriptionRecord) {
    const i = this.subscriptions.findIndex((s) => s.userId === input.userId && s.entitlement === input.entitlement)
    if (i >= 0) this.subscriptions[i] = { ...input }
    else this.subscriptions.push({ ...input })
  }
  async listSubscriptions(userId: string) {
    return this.subscriptions.filter((s) => s.userId === userId).map((s) => ({ ...s }))
  }
  async upsertPurchase(input: PurchaseRecord) {
    const i = this.purchases.findIndex((p) => p.storeTransactionId === input.storeTransactionId)
    if (i >= 0) this.purchases[i] = { ...input }
    else this.purchases.push({ ...input })
  }
  async listPurchases(userId: string) {
    return this.purchases.filter((p) => p.userId === userId).map((p) => ({ ...p }))
  }

  // ---------------------------------------------------------------- characters

  async listCharacters() {
    return [...this.characters.values()]
  }

  async getCharacter(id: string) {
    return this.characters.get(id) ?? null
  }

  async listPortraits(characterId: string) {
    return [...(this.portraits.get(characterId) ?? [])].sort((a, b) => a.position - b.position)
  }

  async listScenes(characterId: string) {
    return [...(this.scenes.get(characterId) ?? [])].sort((a, b) => a.position - b.position)
  }

  // ---------------------------------------------------------------- relationships

  async listRelationships(userId: string) {
    return [...this.relationships.values()].filter((r) => r.userId === userId)
  }

  async findRelationship(userId: string, characterId: string) {
    return (
      [...this.relationships.values()].find((r) => r.userId === userId && r.characterId === characterId) ??
      null
    )
  }

  async createRelationship(userId: string, characterId: string, depth: RelationshipDepth, sceneId: string | null = null) {
    const existing = await this.findRelationship(userId, characterId)
    if (existing) return existing
    if (!this.characters.has(characterId)) throw new Error(`unknown character ${characterId}`)
    const relationship: RelationshipRecord = {
      id: randomUUID(),
      userId,
      characterId,
      depth,
      stage: 'STRANGER',
      affinity: 0,
      startedAt: new Date().toISOString(),
      conversationId: randomUUID(),
      sceneId,
      activeDays: 0,
      lastActiveDate: null,
      messageGainsToday: 0,
      factGainsToday: 0,
      reachedOutOn: null,
    }
    this.relationships.set(relationship.id, relationship)
    this.conversations.set(relationship.conversationId, {
      id: relationship.conversationId,
      relationshipId: relationship.id,
      sceneId,
      summary: { text: '', throughMessageId: null },
    })
    this.messages.set(relationship.conversationId, [])
    return relationship
  }

  async updateRelationship(id: string, patch: RelationshipPatch) {
    const current = this.relationships.get(id)
    if (!current) throw new Error(`unknown relationship ${id}`)
    const { stageChangedAt: _ignored, ...fields } = patch
    const updated: RelationshipRecord = { ...current, ...fields }
    this.relationships.set(id, updated)
    return updated
  }

  async insertRelationshipEvents(events: RelationshipEvent[]) {
    const createdAt = new Date().toISOString()
    for (const e of events) this.relationshipEvents.push({ ...e, createdAt })
  }

  // ---------------------------------------------------------------- moments

  async listMoments(characterId: string) {
    return [...(this.moments.get(characterId) ?? [])].sort((a, b) => a.position - b.position)
  }

  async listUnlocks(relationshipId: string) {
    return [...(this.unlocks.get(relationshipId) ?? [])]
  }

  async insertUnlock(input: { relationshipId: string; momentId: string; source: MomentUnlockSource }) {
    const list = this.unlocks.get(input.relationshipId) ?? []
    const existing = list.find((u) => u.momentId === input.momentId)
    if (existing) return existing
    const unlock: MomentUnlock = { ...input, unlockedAt: new Date().toISOString() }
    list.push(unlock)
    this.unlocks.set(input.relationshipId, list)
    return unlock
  }

  // ---------------------------------------------------------------- chat

  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    const conversation = this.conversations.get(conversationId)
    if (!conversation) return null
    const relationship = this.relationships.get(conversation.relationshipId)!
    const character = this.characters.get(relationship.characterId)!
    const user = this.users.get(relationship.userId)!
    const scene = (this.scenes.get(character.id) ?? []).find((sc) => sc.id === conversation.sceneId) ?? null
    return {
      conversation: { id: conversation.id, relationshipId: conversation.relationshipId, scene },
      relationship,
      character: { id: character.id, kind: character.kind, name: character.name, personaNotes: character.personaNotes },
      user,
    }
  }

  async findByClientMsgId(conversationId: string, clientMsgId: string) {
    return this.list(conversationId).find((m) => m.clientMsgId === clientMsgId) ?? null
  }

  async findReplyTo(messageId: string) {
    for (const list of this.messages.values()) {
      const hit = list.find((m) => m.inReplyTo === messageId)
      if (hit) return hit
    }
    return null
  }

  async insertMessage(input: NewMessage): Promise<Message> {
    const list = this.list(input.conversationId)
    const message: Message = {
      id: input.id ?? randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      clientMsgId: input.clientMsgId,
      inReplyTo: input.inReplyTo,
      momentId: input.momentId ?? null,
      createdAt: new Date().toISOString(),
    }
    list.push(message)
    return message
  }

  async listOfferedMoments(conversationId: string) {
    return (this.messages.get(conversationId) ?? [])
      .filter((m) => m.momentId)
      .map((m) => ({ momentId: m.momentId!, createdAt: m.createdAt }))
  }

  async listRecentMessages(conversationId: string, limit: number) {
    return this.list(conversationId).slice(-limit)
  }

  async listMessagesAfter(conversationId: string, afterId: string | null, limit: number) {
    const list = this.list(conversationId)
    const start = afterId ? list.findIndex((m) => m.id === afterId) + 1 : 0
    return list.slice(start, start + limit)
  }

  async countUserMessagesSince(userId: string, since: Date) {
    let n = 0
    for (const rel of this.relationships.values()) {
      if (rel.userId !== userId) continue
      for (const m of this.messages.get(rel.conversationId) ?? []) {
        if (m.role === 'USER' && new Date(m.createdAt) >= since) n++
      }
    }
    return n
  }

  // ---------------------------------------------------------------- memory

  async getSummary(conversationId: string) {
    return this.conversation(conversationId).summary
  }

  async setSummary(conversationId: string, summary: ConversationSummary) {
    this.conversation(conversationId).summary = summary
  }

  async insertMemories(items: NewMemory[]) {
    for (const item of items) {
      const list = this.memories.get(item.relationshipId) ?? []
      list.push({
        id: randomUUID(),
        relationshipId: item.relationshipId,
        fact: item.fact,
        confidence: item.confidence,
        embedding: item.embedding,
        createdAt: new Date().toISOString(),
      })
      this.memories.set(item.relationshipId, list)
    }
  }

  async searchMemories(relationshipId: string, embedding: number[], limit: number) {
    return (this.memories.get(relationshipId) ?? [])
      .filter((m): m is StoredMemory & { embedding: number[] } => m.embedding !== null)
      .map((m) => ({ m, score: cosine(m.embedding, embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ m }) => strip(m))
  }

  async listMemories(relationshipId: string, limit: number) {
    return (this.memories.get(relationshipId) ?? []).slice(-limit).reverse().map(strip)
  }

  // ---------------------------------------------------------------- internals

  private list(conversationId: string) {
    const list = this.messages.get(conversationId)
    if (!list) throw new Error(`unknown conversation ${conversationId}`)
    return list
  }

  private conversation(conversationId: string) {
    const c = this.conversations.get(conversationId)
    if (!c) throw new Error(`unknown conversation ${conversationId}`)
    return c
  }
}

function strip(m: StoredMemory): MemoryRecord {
  const { embedding: _embedding, ...rest } = m
  return rest
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}
