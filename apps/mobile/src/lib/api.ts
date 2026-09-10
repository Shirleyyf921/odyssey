import type { z } from 'zod'
import {
  CHANNEL_HEADER,
  CharacterDetail,
  CharactersResponse,
  DEVICE_ID_HEADER,
  EpisodesResponse,
  TonightResponse,
  GRANT_SECRET_HEADER,
  MeResponse,
  MomentsResponse,
  REVIEW_SECRET_HEADER,
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
  type SignInRequest,
} from '@odyssey/shared'
import { Platform } from 'react-native'
import { API_URL } from './config'
import { getDeviceId } from './device'
import { getSessionToken, setSessionToken } from './session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

const GRANT_SECRET = process.env.EXPO_PUBLIC_BILLING_GRANT_SECRET
/** Admits the web build to /review in production. Only a reviewer's build carries it. */
const REVIEW_SECRET = process.env.EXPO_PUBLIC_REVIEW_SECRET
/**
 * Which build this is. The native binary is the one that ships to the stores,
 * so it says `store` and never sees MATURE; the web build says `web`. Compiled
 * in, not configured, so a store build cannot be talked into the other value.
 */
const CHANNEL = Platform.OS === 'web' ? 'web' : 'store'

async function headers(): Promise<Record<string, string>> {
  const [deviceId, token] = await Promise.all([getDeviceId(), getSessionToken()])
  return {
    [DEVICE_ID_HEADER]: deviceId,
    [CHANNEL_HEADER]: CHANNEL,
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(GRANT_SECRET ? { [GRANT_SECRET_HEADER]: GRANT_SECRET } : {}),
    ...(REVIEW_SECRET ? { [REVIEW_SECRET_HEADER]: REVIEW_SECRET } : {}),
  }
}

/** Every response is validated against the shared schema before a screen sees it. */
async function request<T extends z.ZodTypeAny>(
  method: 'GET' | 'POST',
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
    throw new ApiError(res.status, message)
  }
  return schema.parse(json)
}

export const api = {
  characters: () => request('GET', '/characters', CharactersResponse),
  character: (id: string) => request('GET', `/characters/${id}`, CharacterDetail),
  start: (id: string) => request('POST', `/characters/${id}/start`, StartRelationshipResponse),
  moments: (id: string) => request('GET', `/characters/${id}/moments`, MomentsResponse),
  episodes: (id: string) => request('GET', `/characters/${id}/episodes`, EpisodesResponse),
  tonight: () => request('GET', '/tonight', TonightResponse),
  /** Flag a user-made episode. One per player; enough of them take it down pending review. */
  reportEpisode: (id: string, body: ReportEpisodeRequest) => request('POST', `/episodes/${id}/report`, ReportEpisodeResponse, body),
  me: () => request('GET', '/me', MeResponse),
  /** Age declaration; MATURE episodes stay hidden until it passes. */
  declareAge: (body: AgeGateRequest) => request('POST', '/me/age', MeResponse, body),
  /** Server re-reads RevenueCat for the caller. After a purchase, a restore, or a sign-in. */
  restore: () => request('POST', '/billing/restore', RestoreResponse),
  signIn: (body: SignInRequest) => request('POST', '/auth/sign-in', SignInResponse, body),
  signOut: () => request('POST', '/auth/sign-out', MeResponse.optional()),
  /** Dogfood: grant the caller a tier. Needs EXPO_PUBLIC_BILLING_GRANT_SECRET against production. */
  devGrant: (body: DevGrantRequest) => request('POST', '/billing/dev/grant', RestoreResponse, body),
  /** Dogfood: record a SKU purchase without the store. Same gating as devGrant. */
  devPurchase: (body: DevPurchaseRequest) => request('POST', '/billing/dev/purchase', RestoreResponse, body),
  /** The review queue (docs/ugc-pipeline.md, step 6). Needs EXPO_PUBLIC_REVIEW_SECRET against production. */
  reviewQueue: () => request('GET', '/review/episodes', ReviewQueueResponse),
  reviewDecide: (id: string, body: ReviewDecisionRequest) => request('POST', `/review/episodes/${id}`, ReviewDecisionResponse, body),
  /** Development builds only; the server refuses it in production. */
  devSetStage: (id: string, body: DevSetStageRequest) =>
    request('POST', `/characters/${id}/dev/stage`, StartRelationshipResponse, body),
}
