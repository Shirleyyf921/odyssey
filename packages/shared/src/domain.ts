import { z } from 'zod'

/**
 * A character the user can talk to.
 *
 * PRIMARY is the dedicated boyfriend — one per user. EXPLORE characters are the
 * curated roster. The distinction drives memory strategy and capability tiering;
 * see ARCHITECTURE.md section 1.
 */
export const CharacterKind = z.enum(['PRIMARY', 'EXPLORE'])
export type CharacterKind = z.infer<typeof CharacterKind>

/**
 * Memory depth for a user-character relationship.
 *
 * DEEP runs all four memory layers. LIGHT runs short-term and rolling summary only,
 * skipping fact extraction and vector retrieval — roughly a third of the per-message
 * cost. See ARCHITECTURE.md section 4.
 */
export const RelationshipDepth = z.enum(['DEEP', 'LIGHT'])
export type RelationshipDepth = z.infer<typeof RelationshipDepth>

export const RelationshipStage = z.enum([
  'STRANGER',
  'ACQUAINTED',
  'CLOSE',
  'INTIMATE',
])
export type RelationshipStage = z.infer<typeof RelationshipStage>

/** Ordered so stages can be compared for unlock rules. */
export const STAGE_ORDER: readonly RelationshipStage[] = [
  'STRANGER',
  'ACQUAINTED',
  'CLOSE',
  'INTIMATE',
]

export const MessageRole = z.enum(['USER', 'CHARACTER', 'SYSTEM'])
export type MessageRole = z.infer<typeof MessageRole>

export const Character = z.object({
  id: z.string().uuid(),
  kind: CharacterKind,
  name: z.string().min(1).max(40),
  tagline: z.string().max(140),
  avatarUrl: z.string().url().nullable(),
  voiceId: z.string().nullable(),
})
export type Character = z.infer<typeof Character>

/**
 * Identity image. Produced offline and shown on the character page.
 *
 * Never generated at runtime: the face has to be the same every time, and runtime
 * generation cannot promise that for a face the user has not seen a hundred times.
 * See ARCHITECTURE.md section 14.
 */
/**
 * Where a hotspot sits on this portrait, as a fraction of its width and height
 * from the top left. Authored with the art (docs/story-pipeline.md, "Stage"):
 * geometry belongs to the image, which hotspots are live belongs to the beat.
 */
export const HotspotRect = z.object({
  hotspot: z.enum(['hand', 'shoulder', 'hair', 'face']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
})
export type HotspotRect = z.infer<typeof HotspotRect>

export const Portrait = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  url: z.string().url(),
  /** Display order on the character page. */
  position: z.number().int().min(0),
  /** Optional caption such as "casual" or "at the bar"; the client decides how to show it. */
  label: z.string().max(40).nullable(),
  /** Empty until the art is mapped; the stage then shows no touch targets. */
  hotspots: z.array(HotspotRect).default([]),
})
export type Portrait = z.infer<typeof Portrait>

export const CharacterProfile = Character.extend({
  portraits: z.array(Portrait),
})
export type CharacterProfile = z.infer<typeof CharacterProfile>

export const Relationship = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  depth: RelationshipDepth,
  stage: RelationshipStage,
  /** 0-100. Internal signal; deliberately not surfaced as a raw number in the UI. */
  affinity: z.number().int().min(0).max(100),
  startedAt: z.string().datetime(),
})
export type Relationship = z.infer<typeof Relationship>

export const Message = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
  /** Client-generated, for idempotent delivery across reconnects. */
  clientMsgId: z.string().uuid().nullable(),
  /** For CHARACTER messages: the USER message this answers. Lets a retried send replay its reply. */
  inReplyTo: z.string().uuid().nullable(),
  /**
   * A photo message: he sent this moment in the conversation. The content is the
   * caption in his voice; the card itself (locked or not) comes from the moments
   * endpoint or the `moment_offer` event. See ARCHITECTURE.md section 14.
   */
  momentId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
})
export type Message = z.infer<typeof Message>

// ---------------------------------------------------------------- scenes

/**
 * Where a conversation happens. A scene is a setting line the persona reads, the
 * character's opening message (his first line, in the beat-plus-speech shape,
 * which also fixes his register for everything after), and a backdrop image
 * that is the visual of that setting. Curated, produced offline, like portraits.
 * See ARCHITECTURE.md section 14.
 */
export const Scene = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string().min(1).max(60),
  /** One or two sentences the persona reads as "where you are". */
  setting: z.string().min(1).max(400),
  /** His first message. Inserted into the conversation when it starts. */
  opener: z.string().min(1).max(600),
  /** Null until the art exists. */
  backdropUrl: z.string().url().nullable(),
  position: z.number().int().min(0),
})
export type Scene = z.infer<typeof Scene>

// ---------------------------------------------------------------- moments

/**
 * How a collectible image is unlocked.
 *
 * STAGE and AFFINITY are earned through the relationship. PURCHASE is a consumable:
 * images are the one place metering does not corrode the fiction, because "he sent
 * you a photo" is a discrete act the user can pay for without feeling billed per
 * sentence. See ARCHITECTURE.md sections 7 and 14.
 */
export const MomentUnlockRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FREE') }),
  z.object({ kind: z.literal('STAGE'), stage: RelationshipStage }),
  z.object({ kind: z.literal('AFFINITY'), min: z.number().int().min(0).max(100) }),
  z.object({ kind: z.literal('PURCHASE'), sku: z.string().min(1) }),
])
export type MomentUnlockRule = z.infer<typeof MomentUnlockRule>

export const MomentUnlockSource = z.enum([
  'FREE',
  'STAGE',
  'AFFINITY',
  'PURCHASE',
  /** Manual grant: support, promotions, testing. */
  'GRANT',
])
export type MomentUnlockSource = z.infer<typeof MomentUnlockSource>

/** Collectible image. Curated and produced offline, like portraits. Server-side shape. */
export const Moment = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string().min(1).max(80),
  /** Written in the character's voice, revealed with the image. */
  caption: z.string().max(280),
  imageUrl: z.string().url(),
  /**
   * A tiny, heavily downsampled copy (about 24×32) that is safe to show while the
   * card is locked: enough to read as "a photo of him", not enough to see it. The
   * client scales it up under a blur and a dark layer. Null when there is no art.
   */
  teaserUrl: z.string().nullable().optional(),
  position: z.number().int().min(0),
  unlock: MomentUnlockRule,
})
export type Moment = z.infer<typeof Moment>

/**
 * What the client is allowed to see.
 *
 * imageUrl and caption are null while locked. Enforced when the card is built, not
 * in the client — a locked card must not carry the asset URL at all.
 */
export const MomentCard = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  title: z.string(),
  position: z.number().int().min(0),
  unlock: MomentUnlockRule,
  status: z.enum(['LOCKED', 'UNLOCKED']),
  imageUrl: z.string().url().nullable(),
  /** Sent in both states. Never the real image. */
  teaserUrl: z.string().nullable().default(null),
  caption: z.string().nullable(),
  unlockedAt: z.string().datetime().nullable(),
})
export type MomentCard = z.infer<typeof MomentCard>

export const MomentUnlock = z.object({
  momentId: z.string().uuid(),
  relationshipId: z.string().uuid(),
  source: MomentUnlockSource,
  unlockedAt: z.string().datetime(),
})
export type MomentUnlock = z.infer<typeof MomentUnlock>

// ---------------------------------------------------------------- billing

/**
 * Subscription tiers from ARCHITECTURE.md section 7. PREMIUM is defined so the
 * entitlement can exist in RevenueCat before voice ships; nothing grants it yet.
 */
export const Tier = z.enum(['FREE', 'PLUS', 'PREMIUM'])
export type Tier = z.infer<typeof Tier>

/** RevenueCat entitlement identifiers, configured in the RevenueCat dashboard under these exact names. */
export const ENTITLEMENTS = { PLUS: 'plus', PREMIUM: 'premium' } as const
export type EntitlementId = (typeof ENTITLEMENTS)[keyof typeof ENTITLEMENTS]

export const TIER_BY_ENTITLEMENT: Record<EntitlementId, Exclude<Tier, 'FREE'>> = {
  [ENTITLEMENTS.PLUS]: 'PLUS',
  [ENTITLEMENTS.PREMIUM]: 'PREMIUM',
}

export const TIER_ORDER: Tier[] = ['FREE', 'PLUS', 'PREMIUM']

export const Store = z.enum(['APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL', 'AMAZON', 'MAC_APP_STORE', 'UNKNOWN'])
export type Store = z.infer<typeof Store>

/**
 * What the client needs to know about the caller's paid state. Derived from the
 * subscriptions table at request time; never trusted from the client.
 */
export const BillingStatus = z.object({
  tier: Tier,
  /** When the current tier lapses. Null on FREE. */
  expiresAt: z.string().datetime().nullable(),
  /** True when the user turned off renewal; the tier holds until expiresAt. */
  willRenew: z.boolean(),
  /** Product ids of every one-time purchase on the account (moment SKUs). */
  purchasedSkus: z.array(z.string()),
  /** False until RevenueCat is configured on the server, so the client hides purchase UI. */
  enabled: z.boolean(),
})
export type BillingStatus = z.infer<typeof BillingStatus>

// ---------------------------------------------------------------- episodes (docs/story-pipeline.md)

/** SFW ships to the store build; MATURE only to the web build. A property of the episode, not the character. */
export const ContentRating = z.enum(['SFW', 'MATURE'])
export type ContentRating = z.infer<typeof ContentRating>

/**
 * When an episode becomes playable. STAGE and EPISODE are the hidden relationship
 * showing through: the user never sees a number, they see what is open tonight.
 */
export const EpisodeUnlockRule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FREE') }),
  z.object({ kind: z.literal('STAGE'), stage: RelationshipStage }),
  z.object({ kind: z.literal('PLUS') }),
  /** After finishing another episode. */
  z.object({ kind: z.literal('EPISODE'), episodeId: z.string().uuid() }),
])
export type EpisodeUnlockRule = z.infer<typeof EpisodeUnlockRule>

export const BeatKind = z.enum([
  /** Narration, his line, two authored options plus free text. */
  'STORY',
  /** He calls. A pre-rendered clip; answer or decline. */
  'CALL',
  /** Closing beat. His last line, no options. */
  'END',
])
export type BeatKind = z.infer<typeof BeatKind>

/** What the user can touch on the portrait at this beat. Geometry lives with the portrait. */
export const Hotspot = z.enum(['hand', 'shoulder', 'hair', 'face'])
export type Hotspot = z.infer<typeof Hotspot>

/**
 * An authored option. The writer sets what it means and where it leads; the
 * model phrases the button text in the moment. The third option, free text, is
 * implicit on every STORY beat.
 */
export const BeatOption = z.object({
  intent: z.string().min(1).max(200),
  /** Beat to go to. Null ends the episode from here. */
  next: z.string().uuid().nullable(),
  /** Credited when chosen. Small on purpose; the daily caps in the relationship rules still apply. */
  affinity: z.number().int().min(-3).max(3).default(0),
})
export type BeatOption = z.infer<typeof BeatOption>

export const Beat = z.object({
  id: z.string().uuid(),
  episodeId: z.string().uuid(),
  position: z.number().int().min(0),
  kind: BeatKind,
  /** For the model: what happens here, what he wants, what he must not do yet. Never shown. */
  brief: z.string().min(1).max(1200),
  /** Overrides the episode setting when the scene moves. */
  setting: z.string().max(400).nullable(),
  /** Up to two. Empty on CALL and END. */
  options: z.array(BeatOption).max(2),
  /** Where a spent beat goes when the user typed instead of choosing. Null ends the episode. */
  next: z.string().uuid().nullable(),
  /** A photo he sends at this beat, through the offer path, locked. */
  photoMomentId: z.string().uuid().nullable(),
  /** CALL only. Null until the clip is rendered; the beat then plays as text. */
  callUrl: z.string().url().nullable(),
  callSeconds: z.number().int().positive().nullable(),
  hotspots: z.array(Hotspot).default([]),
})
export type Beat = z.infer<typeof Beat>

export const Episode = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  position: z.number().int().min(0),
  title: z.string().min(1).max(80),
  /** One or two sentences on the card. */
  premise: z.string().min(1).max(280),
  /** Where the episode opens. Beats may override. */
  setting: z.string().min(1).max(400),
  /** His first line, in the beat-plus-speech shape. Inserted as a real message when the run starts. */
  opener: z.string().min(1).max(600),
  /** Backdrop and portraits come from this scene when set. */
  sceneId: z.string().uuid().nullable(),
  rating: ContentRating,
  unlock: EpisodeUnlockRule,
  firstBeatId: z.string().uuid(),
})
export type Episode = z.infer<typeof Episode>

/** One playthrough: where the user is and the path they took. One per relationship per episode. */
export const EpisodeRun = z.object({
  id: z.string().uuid(),
  relationshipId: z.string().uuid(),
  episodeId: z.string().uuid(),
  currentBeatId: z.string().uuid(),
  /** Beat ids in the order visited, current one last. */
  path: z.array(z.string().uuid()),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
})
export type EpisodeRun = z.infer<typeof EpisodeRun>

export const EpisodeStatus = z.enum(['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'DONE'])
export type EpisodeStatus = z.infer<typeof EpisodeStatus>

/** What the client sees on the "tonight" screen. Briefs and beats never leave the server. */
export const EpisodeCard = Episode.pick({
  id: true,
  characterId: true,
  position: true,
  title: true,
  premise: true,
  sceneId: true,
  rating: true,
  unlock: true,
}).extend({
  status: EpisodeStatus,
  /** Copy for a locked card, in plain words. Null unless LOCKED. */
  lockReason: z.string().nullable(),
  beatCount: z.number().int().min(0),
  /** 1-based position of the current beat while IN_PROGRESS; null otherwise. */
  currentBeat: z.number().int().min(1).nullable(),
})
export type EpisodeCard = z.infer<typeof EpisodeCard>
