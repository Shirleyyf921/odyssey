import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import type { MomentUnlockRule } from '@odyssey/shared'

/**
 * Postgres schema. Mirrors ARCHITECTURE.md section 5 plus the visual-asset tables
 * from section 14. Enum values are duplicated from @odyssey/shared on purpose:
 * drizzle needs literals at module load, and a drift between the two is caught by
 * the typecheck in repo/drizzle.ts where rows are mapped to shared types.
 */

export const characterKind = pgEnum('character_kind', ['PRIMARY', 'EXPLORE'])
export const relationshipDepth = pgEnum('relationship_depth', ['DEEP', 'LIGHT'])
export const relationshipStage = pgEnum('relationship_stage', [
  'STRANGER',
  'ACQUAINTED',
  'CLOSE',
  'INTIMATE',
])
export const messageRole = pgEnum('message_role', ['USER', 'CHARACTER', 'SYSTEM'])
export const momentUnlockSource = pgEnum('moment_unlock_source', [
  'FREE',
  'STAGE',
  'AFFINITY',
  'PURCHASE',
  'GRANT',
])

export const authProvider = pgEnum('auth_provider', ['apple', 'google', 'dev'])

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/** Must match the embedding model in use. bge-m3 style models are 1024; change both together. */
export const EMBEDDING_DIMENSIONS = 1024

export const users = pgTable(
  'users',
  {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Anonymous device identity until real sign-in exists. */
  deviceId: text('device_id'),
  displayName: text('display_name'),
  locale: text('locale').notNull().default('en-US'),
  /** Server-side age gate. Null means not yet verified — see ARCHITECTURE.md section 12. */
  ageVerifiedAt: timestamptz('age_verified_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_device_id_uq').on(t.deviceId)]
)

/** One row per (provider, subject). A user may hold several; an anonymous user holds none. */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProvider('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('auth_identities_provider_subject_uq').on(t.provider, t.subject),
    index('auth_identities_user_idx').on(t.userId),
  ]
)

/** Opaque bearer sessions. Only the hash is stored, so a database read cannot impersonate anyone. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sessions_token_hash_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)]
)

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: characterKind('kind').notNull(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default(''),
  avatarUrl: text('avatar_url'),
  voiceId: text('voice_id'),
  /** Injected into the persona prompt. Product content, versioned with the row. */
  personaNotes: text('persona_notes').notNull().default(''),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
})

export const portraits = pgTable(
  'portraits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    position: integer('position').notNull().default(0),
    label: text('label'),
  },
  (t) => [index('portraits_character_idx').on(t.characterId, t.position)]
)

/** Where a conversation is set. Curated, produced offline. See ARCHITECTURE.md section 14. */
export const scenes = pgTable(
  'scenes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    setting: text('setting').notNull(),
    opener: text('opener').notNull(),
    backdropUrl: text('backdrop_url'),
    position: integer('position').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('scenes_character_idx').on(t.characterId, t.position)]
)

export const relationships = pgTable(
  'relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    depth: relationshipDepth('depth').notNull(),
    stage: relationshipStage('stage').notNull().default('STRANGER'),
    affinity: integer('affinity').notNull().default(0),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    // Progression state — see relationship/rules.ts and ARCHITECTURE.md section 15.
    /** Distinct UTC days with at least one user message. Gates stage transitions. */
    activeDays: integer('active_days').notNull().default(0),
    /** YYYY-MM-DD (UTC) of the last user message; daily counters reset when it changes. */
    lastActiveDate: text('last_active_date'),
    messageGainsToday: integer('message_gains_today').notNull().default(0),
    factGainsToday: integer('fact_gains_today').notNull().default(0),
    stageChangedAt: timestamptz('stage_changed_at'),
  },
  (t) => [uniqueIndex('relationships_user_character_uq').on(t.userId, t.characterId)]
)

/** Every affinity change with its reason. Exists so the rules can be tuned on data, not vibes. */
export const relationshipEvents = pgTable(
  'relationship_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('relationship_events_relationship_idx').on(t.relationshipId, t.createdAt)]
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    /** Null only for conversations created before scenes existed. */
    sceneId: uuid('scene_id').references(() => scenes.id, { onDelete: 'set null' }),
    /** Mid-term memory: rolling summary of everything up to summaryThroughMessageId. */
    summary: text('summary').notNull().default(''),
    summaryThroughMessageId: uuid('summary_through_message_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('conversations_relationship_idx').on(t.relationshipId)]
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRole('role').notNull(),
    content: text('content').notNull(),
    clientMsgId: uuid('client_msg_id'),
    inReplyTo: uuid('in_reply_to'),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    /** Idempotency across reconnects. Postgres allows repeated NULLs, so server-authored rows are unaffected. */
    uniqueIndex('messages_client_msg_uq').on(t.conversationId, t.clientMsgId),
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
  ]
)

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    fact: text('fact').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    confidence: real('confidence').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('memories_relationship_idx').on(t.relationshipId),
    index('memories_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ]
)

export const moments = pgTable(
  'moments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    caption: text('caption').notNull().default(''),
    imageUrl: text('image_url').notNull(),
    position: integer('position').notNull().default(0),
    unlockRule: jsonb('unlock_rule').$type<MomentUnlockRule>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('moments_character_idx').on(t.characterId, t.position)]
)

export const momentUnlocks = pgTable(
  'moment_unlocks',
  {
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
    momentId: uuid('moment_id')
      .notNull()
      .references(() => moments.id, { onDelete: 'cascade' }),
    source: momentUnlockSource('source').notNull(),
    unlockedAt: timestamptz('unlocked_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.relationshipId, t.momentId] })]
)
