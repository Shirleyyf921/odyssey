import { Platform } from 'react-native'

/**
 * API origin. On a device use the machine's LAN address, not localhost:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 pnpm dev
 * The exported web build is served by the API itself (apps/api/src/web.ts), so
 * with nothing configured it talks to wherever it was loaded from.
 */
const configured = process.env.EXPO_PUBLIC_API_URL
const sameOrigin = Platform.OS === 'web' && typeof window !== 'undefined' && !window.location.origin.includes('localhost:808') ? window.location.origin : null
export const API_URL = (configured ?? sameOrigin ?? 'http://localhost:3000').replace(/\/$/, '')

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/chat'
