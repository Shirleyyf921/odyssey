import { randomUUID } from 'expo-crypto'
import { storage } from './storage'

const KEY = 'odyssey.deviceId'
let cached: string | null = null

/**
 * Anonymous identity: a UUID minted once and kept in the secure store. Sent as
 * x-device-id on every request. Replaced by real sign-in later; the server treats
 * it as opaque.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  let id = await storage.get(KEY)
  if (!id) {
    id = randomUUID()
    await storage.set(KEY, id)
  }
  cached = id
  return id
}
