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

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name'),
  locale: text('locale').notNull().default('en-US'),
  /** Server-side age gate. Null means not yet verified — see ARCHITECTURE.md section 12. */
  ageVerifiedAt: timestamptz('age_verified_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
})

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
  },
  (t) => [uniqueIndex('relationships_user_character_uq').on(t.userId, t.characterId)]
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationships.id, { onDelete: 'cascade' }),
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
    /** Dimension follows the embedding model; change both together. */
    embedding: vector('embedding', { dimensions: 1536 }),
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
