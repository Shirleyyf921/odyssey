/**
 * API origin. On a device use the machine's LAN address, not localhost:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 pnpm dev
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/chat'
