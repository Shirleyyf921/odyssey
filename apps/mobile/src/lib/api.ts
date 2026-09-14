import { z } from 'zod'
import {
  AskPhotoResponse,
  type DevPhotoCreditsRequest,
  CHANNEL_HEADER,
  CharacterDetail,
  CharactersResponse,
  DEVICE_ID_HEADER,
  EpisodesResponse,
  HomeResponse,
  TonightResponse,
  GRANT_SECRET_HEADER,
  MeResponse,
  ProfileResponse,
  MomentsResponse,
  AiDraftResponse,
  AuthoredEpisodeResponse,
  MyEpisodesResponse,
  REVIEW_SECRET_HEADER,
  SkeletonsResponse,
  SubmitEpisodeResponse,
  ReportEpisodeResponse,
  RestoreResponse,
  ReviewDecisionResponse,
  ReviewQueueResponse,
  SignInResponse,
  StartRelationshipResponse,
  type AgeGateRequest,
  type DevGrantRequest,
  type DevPurchaseRequest,
  type DevSetStageRequest,
  type ReportEpisodeRequest,
  type ReviewDecisionRequest,
  type RenameRequest,
  type AiDraftRequest,
  type EpisodeDraft,
  type SignInRequest,
} from '@odyssey/shared'
import { Platform } from 'react-native'
import { operatorSecret } from './secrets'
import { API_URL } from './config'
import { getDeviceId } from './device'
import { getSessionToken, setSessionToken } from './session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The server's machine-readable reason when it sends one (a 402's NEEDS_PLUS, USED_TODAY). */
    readonly code: string | null = null
  ) {
    super(message)
  }
}

/**
 * Which build this is. The native binary is the one that ships to the stores,
 * so it says `store` and never sees MATURE; the web build says `web`. Compiled
 * in, not configured, so a store build cannot be talked into the other value.
 */
const CHANNEL = Platform.OS === 'web' ? 'web' : 'store'

async function headers(): Promise<Record<string, string>> {
  const [deviceId, token] = await Promise.all([getDeviceId(), getSessionToken()])
  const grant = operatorSecret('grant')
  const review = operatorSecret('review')
  return {
    [DEVICE_ID_HEADER]: deviceId,
    [CHANNEL_HEADER]: CHANNEL,
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    // Operator secrets ride along only when this browser holds them (src/lib/secrets.ts).
    ...(grant ? { [GRANT_SECRET_HEADER]: grant } : {}),
    ...(review ? { [REVIEW_SECRET_HEADER]: review } : {}),
  }
}

/** Every response is validated against the shared schema before a screen sees it. */
async function request<T extends z.ZodTypeAny>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  schema: T,
  body?: unknown
): Promise<z.infer<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(await headers()), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return schema.parse(undefined)
  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      typeof json === 'object' && json && 'error' in json ? String((json as { error: unknown }).error) : res.statusText
    // An expired session must not strand the app: drop it and let the caller retry as guest.
    if (res.status === 401 && (await getSessionToken())) await setSessionToken(null)
    const code = typeof json === 'object' && json && 'code' in json ? String((json as { code: unknown }).code) : null
    throw new ApiError(res.status, message, code)
  }
  return schema.parse(json)
}

export const api = {
  characters: () => request('GET', '/characters', CharactersResponse),
  character: (id: string) => request('GET', `/characters/${id}`, CharacterDetail),
  start: (id: string) => request('POST', `/characters/${id}/start`, StartRelationshipResponse),
  moments: (id: string) => request('GET', `/characters/${id}/moments`, MomentsResponse),
  /** Ask him for a picture (docs/story-pipeline.md). 402 with a code when he may not; the store maps it. */
  askPhoto: (conversationId: string) => request('POST', `/conversations/${conversationId}/photos`, AskPhotoResponse),
  /** Dogfood: pictures onto the balance, the way a purchase will. Same gating as devGrant. */
  devPhotoCredits: (body: DevPhotoCreditsRequest) => request('POST', '/billing/dev/photo-credits', z.object({ remaining: z.number() }), body),
  episodes: (id: string) => request('GET', `/characters/${id}/episodes`, EpisodesResponse),
  tonight: () => request('GET', '/tonight', TonightResponse),
  /** The whole home screen in one call. */
  home: () => request('GET', '/home', HomeResponse),
  /** Flag a user-made episode. One per player; enough of them take it down pending review. */
  reportEpisode: (id: string, body: ReportEpisodeRequest) => request('POST', `/episodes/${id}/report`, ReportEpisodeResponse, body),
  me: () => request('GET', '/me', MeResponse),
  profile: () => request('GET', '/me/profile', ProfileResponse),
  rename: (body: RenameRequest) => request('POST', '/me/name', MeResponse, body),
  /** Age declaration; MATURE episodes stay hidden until it passes. */
  declareAge: (body: AgeGateRequest) => request('POST', '/me/age', MeResponse, body),
  /** Server re-reads RevenueCat for the caller. After a purchase, a restore, or a sign-in. */
  restore: () => request('POST', '/billing/restore', RestoreResponse),
  signIn: (body: SignInRequest) => request('POST', '/auth/sign-in', SignInResponse, body),
  signOut: () => request('POST', '/auth/sign-out', MeResponse.optional()),
  /** Dogfood: grant the caller a tier. Needs the grant secret in this browser against production. */
  devGrant: (body: DevGrantRequest) => request('POST', '/billing/dev/grant', RestoreResponse, body),
  /** Dogfood: record a SKU purchase without the store. Same gating as devGrant. */
  devPurchase: (body: DevPurchaseRequest) => request('POST', '/billing/dev/purchase', RestoreResponse, body),
  // ---- the editor (docs/ugc-pipeline.md, section 2). Web only; the author sees their own briefs.
  myEpisodes: () => request('GET', '/me/episodes', MyEpisodesResponse),
  myEpisode: (id: string) => request('GET', `/me/episodes/${id}`, AuthoredEpisodeResponse),
  createEpisode: (body: EpisodeDraft) => request('POST', '/me/episodes', AuthoredEpisodeResponse, body),
  updateEpisode: (id: string, body: EpisodeDraft) => request('PUT', `/me/episodes/${id}`, AuthoredEpisodeResponse, body),
  deleteEpisode: (id: string) => request('DELETE', `/me/episodes/${id}`, MyEpisodesResponse.optional()),
  dryRunEpisode: (id: string) => request('POST', `/me/episodes/${id}/dry-run`, AuthoredEpisodeResponse),
  submitEpisode: (id: string) => request('POST', `/me/episodes/${id}/submit`, SubmitEpisodeResponse),
  skeletons: (characterId: string) => request('GET', `/me/skeletons/${characterId}`, SkeletonsResponse),
  aiDraft: (body: AiDraftRequest) => request('POST', '/me/episodes/ai-draft', AiDraftResponse, body),
  /** The review queue (docs/ugc-pipeline.md, step 6). Needs the review secret in this browser against production. */
  reviewQueue: () => request('GET', '/review/episodes', ReviewQueueResponse),
  reviewDecide: (id: string, body: ReviewDecisionRequest) => request('POST', `/review/episodes/${id}`, ReviewDecisionResponse, body),
  /** Development builds only; the server refuses it in production. */
  devSetStage: (id: string, body: DevSetStageRequest) =>
    request('POST', `/characters/${id}/dev/stage`, StartRelationshipResponse, body),
}
