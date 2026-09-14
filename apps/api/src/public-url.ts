/**
 * Where this deployment is reachable from a browser. Art URLs are absolute in
 * the database, so the seed needs it at write time; Railway hands us the
 * domain, local dev is the API's own port. PUBLIC_URL overrides both (a custom
 * domain, a LAN address for a phone on the same wifi).
 *
 * Kept apart from env.ts so the seed script can read it without parsing the
 * whole environment.
 */
export function publicUrl(): string {
  const set = process.env.PUBLIC_URL?.replace(/\/$/, '')
  if (set) return set
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railway) return `https://${railway}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

/** A file under apps/api/art, served at /art (2026-09-14: the art left the Lovart CDN). */
export function art(file: string): string {
  return `${publicUrl()}/art/${file}`
}
