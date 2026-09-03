import { z } from 'zod'
import { Character, CharacterProfile, MomentCard, Relationship, RelationshipStage, Scene } from './domain.js'

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

export const MeResponse = z.object({ user: AuthUser })
export type MeResponse = z.infer<typeof MeResponse>
