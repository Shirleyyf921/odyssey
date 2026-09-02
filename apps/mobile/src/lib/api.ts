import type { z } from 'zod'
import {
  CharacterDetail,
  CharactersResponse,
  DEVICE_ID_HEADER,
  MeResponse,
  MomentsResponse,
  SignInResponse,
  StartRelationshipResponse,
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

async function headers(): Promise<Record<string, string>> {
  const [deviceId, token] = await Promise.all([getDeviceId(), getSessionToken()])
  return {
    [DEVICE_ID_HEADER]: deviceId,
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  me: () => request('GET', '/me', MeResponse),
  signIn: (body: SignInRequest) => request('POST', '/auth/sign-in', SignInResponse, body),
  signOut: () => request('POST', '/auth/sign-out', MeResponse.optional()),
}
