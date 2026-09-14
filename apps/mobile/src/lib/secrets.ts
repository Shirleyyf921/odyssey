import { Platform } from 'react-native'

/**
 * Operator secrets (2026-09-14): the billing grant and the review queue. They
 * used to travel as EXPO_PUBLIC_* and so sat in the public web bundle, where
 * anyone with the demo link could read them. Now they are never compiled in:
 * on the web an operator puts them in their own browser once, and the store
 * build has no way to carry one at all.
 *
 *   localStorage.setItem('odyssey.reviewSecret', '…')
 *   localStorage.setItem('odyssey.grantSecret', '…')
 */
const KEYS = { grant: 'odyssey.grantSecret', review: 'odyssey.reviewSecret' } as const

export function operatorSecret(kind: keyof typeof KEYS): string | null {
  if (Platform.OS !== 'web') return null
  try {
    return globalThis.localStorage?.getItem(KEYS[kind]) ?? null
  } catch {
    return null
  }
}
