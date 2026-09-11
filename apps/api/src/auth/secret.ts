import { timingSafeEqual } from 'node:crypto'

/** Constant-time match of a header against a configured secret; a `Bearer ` prefix is allowed. */
export function secretMatches(header: unknown, secret: string): boolean {
  if (typeof header !== 'string') return false
  const given = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
