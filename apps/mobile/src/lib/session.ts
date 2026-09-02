import * as SecureStore from 'expo-secure-store'

const KEY = 'odyssey.sessionToken'
let cached: string | null | undefined

/** Bearer token from sign-in. Absent means guest, identified by the device id. */
export async function getSessionToken(): Promise<string | null> {
  if (cached !== undefined) return cached
  cached = await SecureStore.getItemAsync(KEY)
  return cached
}

export async function setSessionToken(token: string | null): Promise<void> {
  cached = token
  if (token) await SecureStore.setItemAsync(KEY, token)
  else await SecureStore.deleteItemAsync(KEY)
}
