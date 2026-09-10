import type {
  AuthProvider,
  Beat,
  Character,
  CharacterKind,
  ContentRating,
  DryRun,
  Episode,
  EpisodeDraft,
  EpisodeLifecycle,
  ReviewReport,
  EpisodeRun,
  ReportReason,
  Message,
  MessageRole,
  Moment,
  MomentUnlock,
  MomentUnlockSource,
  Portrait,
  Relationship,
  RelationshipDepth,
  Scene,
  Store,
} from '@odyssey/shared'

export interface UserRecord {
  id: string
  displayName: string | null
  locale: string
  /** Null until the age declaration is made. Gates MATURE episodes (docs/story-pipeline.md, step 6). */
  ageVerifiedAt: Date | null
}

export interface IdentityRecord {
  userId: string
  provider: AuthProvider
  subject: string
  email: string | null
}

export interface SessionRecord {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export interface CharacterRecord extends Character {
  personaNotes: string
}

/** Progression counters. Server-only; the client sees stage and affinity through Relationship. */
export interface RelationshipProgress {
  activeDays: number
  lastActiveDate: string | null
  messageGainsToday: number
  factGainsToday: number
}

export interface RelationshipRecord extends Relationship, RelationshipProgress {
  userId: string
  /** One conversation per relationship for now. */
  conversationId: string
  sceneId: string | null
}

export type RelationshipPatch = Partial<
  Pick<RelationshipRecord, 'stage' | 'affinity'> & RelationshipProgress & { stageChangedAt: Date }
>

export interface RelationshipEvent {
  relationshipId: string
  delta: number
  reason: string
}

export interface MemoryRecord {
  id: string
  relationshipId: string
  fact: string
  confidence: number
  createdAt: string
}

export interface NewMemory {
  relationshipId: string
  fact: string
  embedding: number[] | null
  confidence: number
}

export interface ConversationSummary {
  text: string
  /** Last message folded into the summary; the short-term window starts after it. */
  throughMessageId: string | null
}

/** Everything the chat pipeline needs to know about a conversation, in one read. */
export interface ConversationContext {
  conversation: { id: string; relationshipId: string; scene: Scene | null }
  relationship: RelationshipRecord
  character: { id: string; kind: CharacterKind; name: string; personaNotes: string }
  user: { id: string; displayName: string | null; locale: string; ageVerifiedAt: Date | null }
}

export type BillingEnvironment = 'SANDBOX' | 'PRODUCTION'

/** A RevenueCat entitlement as last synced. See db/schema.ts `subscriptions`. */
export interface SubscriptionRecord {
  userId: string
  entitlement: string
  productId: string
  store: Store
  environment: BillingEnvironment
  purchasedAt: Date
  expiresAt: Date | null
  unsubscribedAt: Date | null
  billingIssueAt: Date | null
  rcAppUserId: string
}

/** A one-time purchase (moment SKU). See db/schema.ts `purchases`. */
export interface PurchaseRecord {
  userId: string
  productId: string
  store: Store
  environment: BillingEnvironment
  storeTransactionId: string
  purchasedAt: Date
  refundedAt: Date | null
  rcAppUserId: string
}

/** An episode with its beats, in position order. Server-only: briefs never reach the client. */
export interface EpisodeRecord extends Episode {
  beats: Beat[]
  dryRun: DryRun | null
}

/** Runs pin the episode version they started on (docs/ugc-pipeline.md, section 1). */
export interface CreateRunInput {
  relationshipId: string
  episodeId: string
  currentBeatId: string
  episodeVersion: number
}

export interface EpisodePatch {
  status?: EpisodeLifecycle
  /** Reset when a reviewer puts an unlisted episode back; the old reports are read, not forgotten. */
  reportCount?: number
  version?: number
  rating?: ContentRating
  reviewNote?: string | null
  lastReviewedAt?: Date | null
  dryRun?: DryRun | null
}

export interface RunCounts {
  started: number
  finished: number
}

export interface EpisodeRunPatch {
  currentBeatId?: string
  path?: string[]
  endedAt?: Date | null
}

export interface NewMessage {
  /** Supplied by the caller for CHARACTER messages so the id can be streamed before the row exists. */
  id?: string
  conversationId: string
  role: MessageRole
  content: string
  clientMsgId: string | null
  inReplyTo: string | null
  /** A photo message. */
  momentId?: string | null
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
}

export interface ChatRepository {
  getConversationContext(conversationId: string): Promise<ConversationContext | null>
  findByClientMsgId(conversationId: string, clientMsgId: string): Promise<Message | null>
  /** The CHARACTER message answering the given USER message, if generation finished. */
  findReplyTo(messageId: string): Promise<Message | null>
  insertMessage(input: NewMessage): Promise<Message>
  /** Oldest first. */
  listRecentMessages(conversationId: string, limit: number): Promise<Message[]>
  /** Messages created after `afterId` (all messages when null), oldest first. */
  listMessagesAfter(conversationId: string, afterId: string | null, limit: number): Promise<Message[]>
  /** USER messages this person sent since `since`, across every relationship. Drives the daily caps. */
  countUserMessagesSince(userId: string, since: Date): Promise<number>
  /** Photo messages in this conversation, oldest first. Drives the offer cadence. */
  listOfferedMoments(conversationId: string): Promise<Array<{ momentId: string; createdAt: string }>>

  // mid-term memory
  getSummary(conversationId: string): Promise<ConversationSummary>
  setSummary(conversationId: string, summary: ConversationSummary): Promise<void>

  // long-term memory
  insertMemories(items: NewMemory[]): Promise<void>
  /** Nearest by cosine distance. Rows without an embedding are never returned here. */
  searchMemories(relationshipId: string, embedding: number[], limit: number): Promise<MemoryRecord[]>
  /** Most recent first. Fallback when no embedding is available. */
  listMemories(relationshipId: string, limit: number): Promise<MemoryRecord[]>
}

export interface AppRepository extends ChatRepository {
  getOrCreateUserByDevice(deviceId: string): Promise<UserRecord>
  getUser(id: string): Promise<UserRecord | null>
  createUser(input: { displayName: string | null }): Promise<UserRecord>
  updateUser(id: string, patch: { displayName?: string | null; ageVerifiedAt?: Date | null }): Promise<UserRecord>

  // auth
  findIdentity(provider: AuthProvider, subject: string): Promise<IdentityRecord | null>
  createIdentity(input: IdentityRecord): Promise<IdentityRecord>
  listIdentities(userId: string): Promise<IdentityRecord[]>
  createSession(input: SessionRecord): Promise<void>
  /** Null when unknown, expired, or revoked. */
  findUserBySession(tokenHash: string, now: Date): Promise<UserRecord | null>
  revokeSession(tokenHash: string): Promise<void>
  /**
   * Fold an anonymous user into an account: relationships move where the account
   * has none for that character, the device mapping follows, and the anonymous
   * row is deleted (cascading whatever collided). Returns how many moved.
   */
  mergeUsers(fromUserId: string, intoUserId: string): Promise<{ moved: number }>

  listCharacters(): Promise<CharacterRecord[]>
  getCharacter(id: string): Promise<CharacterRecord | null>
  listPortraits(characterId: string): Promise<Portrait[]>
  listScenes(characterId: string): Promise<Scene[]>

  listRelationships(userId: string): Promise<RelationshipRecord[]>
  findRelationship(userId: string, characterId: string): Promise<RelationshipRecord | null>
  /** Creates the relationship and its conversation, set in `sceneId` when given. */
  createRelationship(
    userId: string,
    characterId: string,
    depth: RelationshipDepth,
    sceneId?: string | null
  ): Promise<RelationshipRecord>
  updateRelationship(id: string, patch: RelationshipPatch): Promise<RelationshipRecord>
  insertRelationshipEvents(events: RelationshipEvent[]): Promise<void>

  listMoments(characterId: string): Promise<Moment[]>
  listUnlocks(relationshipId: string): Promise<MomentUnlock[]>
  insertUnlock(input: { relationshipId: string; momentId: string; source: MomentUnlockSource }): Promise<MomentUnlock>

  // episodes (docs/story-pipeline.md)
  /** What players may see: LIVE only, in position order. */
  listEpisodes(characterId: string): Promise<EpisodeRecord[]>
  /** Any status. Callers that serve players must check `status` themselves. */
  getEpisode(id: string): Promise<EpisodeRecord | null>
  // authoring (docs/ugc-pipeline.md, section 2)
  listEpisodesByAuthor(userId: string): Promise<EpisodeRecord[]>
  /** A new UGC row in DRAFT, version 1, unlock FREE, with the draft's beats. */
  createEpisode(authorId: string, draft: EpisodeDraft): Promise<EpisodeRecord>
  /** Rewrites the fields and beats of an existing row; status and version are untouched. */
  replaceEpisode(id: string, draft: EpisodeDraft): Promise<EpisodeRecord>
  updateEpisode(id: string, patch: EpisodePatch): Promise<EpisodeRecord>
  deleteEpisode(id: string): Promise<void>
  listRuns(relationshipId: string): Promise<EpisodeRun[]>
  findRun(relationshipId: string, episodeId: string): Promise<EpisodeRun | null>
  createRun(input: CreateRunInput): Promise<EpisodeRun>
  updateRun(id: string, patch: EpisodeRunPatch): Promise<EpisodeRun>
  // serving and reports (docs/ugc-pipeline.md, section 1, "Serving rules")
  /** Runs started and runs that reached an END, per episode. Episodes nobody has played are absent. */
  countRuns(episodeIds: string[]): Promise<Map<string, RunCounts>>
  /**
   * One report per player per episode. A repeat is not counted and does not
   * move `reportCount`. Returns the count after this call either way.
   */
  reportEpisode(input: { episodeId: string; reporterId: string; reason: ReportReason }): Promise<{ counted: boolean; reportCount: number }>
  // review queue (docs/ugc-pipeline.md, "Moderation")
  /** SUBMITTED and UNLISTED, oldest first: what a person still has to read. */
  listEpisodesForReview(): Promise<EpisodeRecord[]>
  listReports(episodeId: string): Promise<ReviewReport[]>

  // billing — written only by the RevenueCat reconcile path
  /** Upsert on (userId, entitlement). */
  upsertSubscription(input: SubscriptionRecord): Promise<void>
  listSubscriptions(userId: string): Promise<SubscriptionRecord[]>
  /** Upsert on storeTransactionId. */
  upsertPurchase(input: PurchaseRecord): Promise<void>
  listPurchases(userId: string): Promise<PurchaseRecord[]>
}
