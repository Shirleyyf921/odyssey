import type { z } from 'zod'
import {
  CharacterDetail,
  CharactersResponse,
  DEVICE_ID_HEADER,
  EpisodesResponse,
  TonightResponse,
  GRANT_SECRET_HEADER,
  MeResponse,
  MomentsResponse,
  RestoreResponse,
  SignInResponse,
  StartRelationshipResponse,
  type DevGrantRequest,
  type DevPurchaseRequest,
  type DevSetStageRequest,
  type SignInRequest,
} from '@odyssey/shared'
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

async function headers(): Promise<Record<string, string>> {
  const [deviceId, token] = await Promise.all([getDeviceId(), getSessionToken()])
  return {
    [DEVICE_ID_HEADER]: deviceId,
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(GRANT_SECRET ? { [GRANT_SECRET_HEADER]: GRANT_SECRET } : {}),
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
  me: () => request('GET', '/me', MeResponse),
  /** Server re-reads RevenueCat for the caller. After a purchase, a restore, or a sign-in. */
  restore: () => request('POST', '/billing/restore', RestoreResponse),
  signIn: (body: SignInRequest) => request('POST', '/auth/sign-in', SignInResponse, body),
  signOut: () => request('POST', '/auth/sign-out', MeResponse.optional()),
  /** Dogfood: grant the caller a tier. Needs EXPO_PUBLIC_BILLING_GRANT_SECRET against production. */
  devGrant: (body: DevGrantRequest) => request('POST', '/billing/dev/grant', RestoreResponse, body),
  /** Dogfood: record a SKU purchase without the store. Same gating as devGrant. */
  devPurchase: (body: DevPurchaseRequest) => request('POST', '/billing/dev/purchase', RestoreResponse, body),
  /** Development builds only; the server refuses it in production. */
  devSetStage: (id: string, body: DevSetStageRequest) =>
    request('POST', `/characters/${id}/dev/stage`, StartRelationshipResponse, body),
}
