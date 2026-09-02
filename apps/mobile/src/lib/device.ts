import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'

const KEY = 'odyssey.deviceId'
let cached: string | null = null

/**
 * Anonymous identity: a UUID minted once and kept in the secure store. Sent as
 * x-device-id on every request. Replaced by real sign-in later; the server treats
 * it as opaque.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  let id = await SecureStore.getItemAsync(KEY)
  if (!id) {
    id = randomUUID()
    await SecureStore.setItemAsync(KEY, id)
  }
  cached = id
  return id
}
