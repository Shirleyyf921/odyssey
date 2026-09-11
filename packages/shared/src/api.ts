import { z } from 'zod'
import { Beat, BeatKind, BillingStatus, Character, ContentRating, Tier, CharacterProfile, DryRun, Episode, EpisodeCard, EpisodeDraft, EpisodeLifecycle, Hotspot, MomentCard, Relationship, RelationshipStage, ReportReason, Scene } from './domain.js'

/**
 * REST shapes. The client validates every response against these, so a server
 * change that breaks the contract fails loudly at the boundary instead of deep
 * in a screen.
 */

/** A relationship as the client needs it: includes the conversation to open. */
export const RelationshipSummary = Relationship.extend({
  conversationId: z.string().uuid(),
  /** The scene the conversation is set in. Null only for conversations older than scenes. */
  sceneId: z.string().uuid().nullable(),
})
export type RelationshipSummary = z.infer<typeof RelationshipSummary>

export const CharacterListItem = Character.extend({
  /** First identity image, for the roster. Null until assets exist. */
  portraitUrl: z.string().url().nullable(),
  relationship: RelationshipSummary.nullable(),
})
export type CharacterListItem = z.infer<typeof CharacterListItem>

export const CharactersResponse = z.object({
  characters: z.array(CharacterListItem),
})
export type CharactersResponse = z.infer<typeof CharactersResponse>

export const CharacterDetail = CharacterProfile.extend({
  relationship: RelationshipSummary.nullable(),
  momentCount: z.number().int().min(0),
  scenes: z.array(Scene),
})
export type CharacterDetail = z.infer<typeof CharacterDetail>

export const StartRelationshipResponse = z.object({
  relationship: RelationshipSummary,
})
export type StartRelationshipResponse = z.infer<typeof StartRelationshipResponse>

export const MomentsResponse = z.object({
  characterId: z.string().uuid(),
  relationship: RelationshipSummary.nullable(),
  moments: z.array(MomentCard),
})
export type MomentsResponse = z.infer<typeof MomentsResponse>

/**
 * The home screen (docs/story-pipeline.md, step 5). One card per character: who
 * he is, and the one episode to show for him tonight. The server picks it so
 * every client agrees on what "tonight" means.
 */
export const TonightItem = z.object({
  character: CharacterListItem,
  /** In progress, else the first available, else the next locked, else the last played. Null when he has no episodes. */
  episode: EpisodeCard.nullable(),
})
export type TonightItem = z.infer<typeof TonightItem>

export const TonightResponse = z.object({ items: z.array(TonightItem) })
export type TonightResponse = z.infer<typeof TonightResponse>

/**
 * The episodes one character offers, with the caller's status on each. Story
 * pipeline, section 3 step 1. `episodes` is ours, in order; `community` is what
 * readers wrote for him and we let through, best-finished first
 * (docs/ugc-pipeline.md, "Serving rules").
 */
export const EpisodesResponse = z.object({
  characterId: z.string().uuid(),
  relationship: RelationshipSummary.nullable(),
  episodes: z.array(EpisodeCard),
  community: z.array(EpisodeCard),
})
export type EpisodesResponse = z.infer<typeof EpisodesResponse>

/** A player flags a user-made episode. One per player per episode; a second one is answered, not counted. */
export const ReportEpisodeRequest = z.object({ reason: ReportReason })
export type ReportEpisodeRequest = z.infer<typeof ReportEpisodeRequest>

export const ReportEpisodeResponse = z.object({
  /** False when this player had already reported it. */
  counted: z.boolean(),
  /** LIVE, or UNLISTED once enough players have said so. */
  status: EpisodeLifecycle,
})
export type ReportEpisodeResponse = z.infer<typeof ReportEpisodeResponse>

/**
 * An author's own episode, beats and briefs included: this is the one place
 * briefs leave the server, and only to the person who wrote them.
 * docs/ugc-pipeline.md, section 2.
 */
export const AuthoredEpisode = Episode.extend({ beats: z.array(Beat), dryRun: DryRun.nullable() })
export type AuthoredEpisode = z.infer<typeof AuthoredEpisode>

export const MyEpisodesResponse = z.object({ episodes: z.array(AuthoredEpisode) })
export type MyEpisodesResponse = z.infer<typeof MyEpisodesResponse>

export const AuthoredEpisodeResponse = z.object({ episode: AuthoredEpisode })
export type AuthoredEpisodeResponse = z.infer<typeof AuthoredEpisodeResponse>

/**
 * What submit says back (docs/ugc-pipeline.md, "Moderation"). REJECTED names the
 * beat; SUBMITTED means the automated screen passed and a human may still look.
 * The rating on the episode is the one the screen settled on, which may be
 * higher than the author declared.
 */
export const SubmitEpisodeResponse = z.object({
  episode: AuthoredEpisode,
  outcome: z.enum(['SUBMITTED', 'REJECTED']),
  notes: z.array(z.string()),
})
export type SubmitEpisodeResponse = z.infer<typeof SubmitEpisodeResponse>

/** Development only: jump a relationship to a stage without waiting the days out. */
export const DevSetStageRequest = z.object({
  stage: RelationshipStage,
})
export type DevSetStageRequest = z.infer<typeof DevSetStageRequest>

export const ApiError = z.object({
  error: z.string(),
})
export type ApiError = z.infer<typeof ApiError>

/** Header carrying the anonymous device identity. Replaced by real sign-in later. */
export const DEVICE_ID_HEADER = 'x-device-id'

/**
 * Which build is asking (docs/story-pipeline.md, step 6). The store binary is
 * compiled to say `store` and MATURE episodes are never served to it; the web
 * build says `web`. Absent means `store`, because the wrong default here is a
 * delisting. This is a client assertion, so it is the second of two gates: the
 * first is age assurance, which is server-side.
 */
export const CHANNEL_HEADER = 'x-odyssey-channel'
export const Channel = z.enum(['store', 'web'])
export type Channel = z.infer<typeof Channel>

/**
 * Age declaration. A date of birth the user types is not assurance, and
 * ARCHITECTURE section 11 still owes a real check; it is enough to gate MATURE
 * on something the server holds rather than on nothing.
 */
export const AgeGateRequest = z.object({
  /** YYYY-MM-DD. */
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type AgeGateRequest = z.infer<typeof AgeGateRequest>

// ---------------------------------------------------------------- auth

/** `dev` exists only outside production: any string is accepted as the subject. */
export const AuthProvider = z.enum(['apple', 'google', 'dev'])
export type AuthProvider = z.infer<typeof AuthProvider>

export const SignInRequest = z.object({
  provider: AuthProvider,
  /** Apple identityToken or Google id_token: a JWT verified server-side. */
  identityToken: z.string().min(1).max(8192),
  /**
   * Apple sends the name only on the very first sign-in and never again, so
   * the client must forward it the one time it sees it.
   */
  fullName: z.string().trim().min(1).max(80).optional(),
})
export type SignInRequest = z.infer<typeof SignInRequest>

export const AuthUser = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  locale: z.string(),
  /** False for anonymous device users. */
  signedIn: z.boolean(),
  providers: z.array(AuthProvider),
  /** Whether the age declaration has been made. Gates MATURE episodes; see AgeGateRequest. */
  ageVerified: z.boolean(),
})
export type AuthUser = z.infer<typeof AuthUser>

export const SignInResponse = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  user: AuthUser,
  /** True when the device's anonymous progress was carried into the account. */
  merged: z.boolean(),
})
export type SignInResponse = z.infer<typeof SignInResponse>

export const MeResponse = z.object({ user: AuthUser, billing: BillingStatus })
export type MeResponse = z.infer<typeof MeResponse>

// ---------------------------------------------------------------- billing

/**
 * Re-read the caller's state from RevenueCat and write it down. The client calls
 * this after a purchase, after "Restore purchases", and after sign-in, so the
 * server never depends on the webhook having arrived first.
 */
export const RestoreResponse = z.object({ billing: BillingStatus })
export type RestoreResponse = z.infer<typeof RestoreResponse>

/**
 * Manual grant for dogfooding: gives the caller a tier without a store purchase.
 * Outside production it is open; in production it needs the grant secret header.
 * FREE revokes earlier grants. Never reaches a real user.
 */
export const DevGrantRequest = z.object({
  tier: Tier,
  /** How long the grant lasts. Ignored for FREE. */
  days: z.number().int().min(1).max(365).default(30),
})
export type DevGrantRequest = z.infer<typeof DevGrantRequest>

/** Dogfood: record a one-time purchase for the caller without the store. Same gating as DevGrantRequest. */
export const DevPurchaseRequest = z.object({ sku: z.string().min(1) })
export type DevPurchaseRequest = z.infer<typeof DevPurchaseRequest>

/** Header carrying BILLING_GRANT_SECRET in production. */
export const GRANT_SECRET_HEADER = 'x-grant-secret'

// ---------------------------------------------------------------- review queue (docs/ugc-pipeline.md, "Moderation")

/** Header carrying REVIEW_SECRET in production. Open outside it, like the grant route. */
export const REVIEW_SECRET_HEADER = 'x-review-secret'

/** A report as the reviewer sees it: the reason and when. Who reported stays in the row. */
export const ReviewReport = z.object({ reason: ReportReason, createdAt: z.string().datetime() })
export type ReviewReport = z.infer<typeof ReviewReport>

/**
 * One episode as the reviewer reads it: the author's whole draft, briefs and
 * transcript included, plus who wrote it and what players said about it.
 */
export const ReviewItem = AuthoredEpisode.extend({
  characterName: z.string(),
  authorName: z.string().nullable(),
  /** How many the author already has LIVE; the first three are read by a person no matter what. */
  authorLiveCount: z.number().int().min(0),
  reports: z.array(ReviewReport),
})
export type ReviewItem = z.infer<typeof ReviewItem>

export const ReviewQueueResponse = z.object({ items: z.array(ReviewItem) })
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponse>

/**
 * What a reviewer may do. SUBMITTED goes LIVE or REJECTED; UNLISTED goes back
 * LIVE or REMOVED; a LIVE one can be REMOVED. A note is required when the
 * author is told no: they read it.
 */
export const ReviewDecisionRequest = z.object({
  decision: z.enum(['LIVE', 'REJECTED', 'REMOVED']),
  note: z.string().trim().max(1000).optional(),
})
export type ReviewDecisionRequest = z.infer<typeof ReviewDecisionRequest>

export const ReviewDecisionResponse = z.object({ episode: AuthoredEpisode })
export type ReviewDecisionResponse = z.infer<typeof ReviewDecisionResponse>

// ---------------------------------------------------------------- the editor (docs/ugc-pipeline.md, section 2)

/**
 * The shape of one of our episodes with the words taken out: which beat is
 * which kind, where the photo and the call land, how the options branch. A
 * creator starts from one of these; the wiring is ours, the words are theirs.
 */
export const SkeletonBeat = z.object({
  position: z.number().int().min(0),
  kind: BeatKind,
  /** Positions the options lead to, in order; null ends the episode from there. */
  optionsTo: z.array(z.number().int().min(0).nullable()).max(2),
  /** Position the beat falls through to on free text; null ends. */
  nextTo: z.number().int().min(0).nullable(),
  hasPhoto: z.boolean(),
  hotspots: z.array(Hotspot),
})
export type SkeletonBeat = z.infer<typeof SkeletonBeat>

export const Skeleton = z.object({
  /** The official episode it was taken from. */
  id: z.string().uuid(),
  title: z.string(),
  rating: ContentRating,
  beats: z.array(SkeletonBeat).min(1),
})
export type Skeleton = z.infer<typeof Skeleton>

export const SkeletonsResponse = z.object({ characterId: z.string().uuid(), skeletons: z.array(Skeleton) })
export type SkeletonsResponse = z.infer<typeof SkeletonsResponse>

/**
 * "Draft beats from this premise." The model fills the words into a skeleton
 * we wire; the result is a draft in the author's hands, not a saved row, and
 * it is moderated exactly like typed text when submitted.
 */
export const AiDraftRequest = z.object({
  characterId: z.string().uuid(),
  premise: z.string().min(1).max(280),
  /** Where it opens, if the author already knows. */
  setting: z.string().max(400).optional(),
  rating: ContentRating.default('SFW'),
  /** Beats to fill. Omitted: five beats, four STORY then END, straight through. */
  skeleton: z.array(SkeletonBeat).min(1).max(20).optional(),
})
export type AiDraftRequest = z.infer<typeof AiDraftRequest>

export const AiDraftResponse = z.object({ draft: EpisodeDraft, model: z.string().nullable() })
export type AiDraftResponse = z.infer<typeof AiDraftResponse>
