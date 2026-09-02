import type { z } from 'zod'
import {
  CharacterDetail,
  CharactersResponse,
  DEVICE_ID_HEADER,
  MomentsResponse,
  StartRelationshipResponse,
} from '@odyssey/shared'
import { API_URL } from './config'
import { getDeviceId } from './device'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/** Every response is validated against the shared schema before a screen sees it. */
async function request<T extends z.ZodTypeAny>(
  method: 'GET' | 'POST',
  path: string,
  schema: T
): Promise<z.infer<T>> {
  const deviceId = await getDeviceId()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { [DEVICE_ID_HEADER]: deviceId, accept: 'application/json' },
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : res.statusText
    throw new ApiError(res.status, message)
  }
  return schema.parse(body)
}

export const api = {
  characters: () => request('GET', '/characters', CharactersResponse),
  character: (id: string) => request('GET', `/characters/${id}`, CharacterDetail),
  start: (id: string) => request('POST', `/characters/${id}/start`, StartRelationshipResponse),
  moments: (id: string) => request('GET', `/characters/${id}/moments`, MomentsResponse),
}
