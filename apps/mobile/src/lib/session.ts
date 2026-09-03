import { storage } from './storage'

const KEY = 'odyssey.sessionToken'
let cached: string | null | undefined

/** Bearer token from sign-in. Absent means guest, identified by the device id. */
export async function getSessionToken(): Promise<string | null> {
  if (cached !== undefined) return cached
  cached = await storage.get(KEY)
  return cached
}

export async function setSessionToken(token: string | null): Promise<void> {
  cached = token
  if (token) await storage.set(KEY, token)
  else await storage.remove(KEY)
}
