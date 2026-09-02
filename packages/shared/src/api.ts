import { z } from 'zod'
import { Character, CharacterProfile, MomentCard, Relationship } from './domain.js'

/**
 * REST shapes. The client validates every response against these, so a server
 * change that breaks the contract fails loudly at the boundary instead of deep
 * in a screen.
 */

/** A relationship as the client needs it: includes the conversation to open. */
export const RelationshipSummary = Relationship.extend({
  conversationId: z.string().uuid(),
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

export const ApiError = z.object({
  error: z.string(),
})
export type ApiError = z.infer<typeof ApiError>

/** Header carrying the anonymous device identity. Replaced by real sign-in later. */
export const DEVICE_ID_HEADER = 'x-device-id'
