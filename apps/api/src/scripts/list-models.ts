import { env } from '../env.js'
import { fetchWithRetry } from '../llm/http.js'

/**
 * `pnpm --filter @odyssey/api list:models [filter]`
 *
 * Asks the EVERYDAY host (Novita by default) which chat models it serves, so
 * NOVITA_MODEL can be picked from what actually exists today rather than from
 * a blog post. Optional filter is a case-insensitive substring, e.g. "qwen".
 */

if (!env.NOVITA_API_KEY) {
  console.log('NOVITA_API_KEY is not set (apps/api/.env).')
  process.exit(1)
}

const filter = (process.argv[2] ?? '').toLowerCase()
let res: Response
try {
  res = await fetchWithRetry(`${env.NOVITA_BASE_URL.replace(/\/$/, '')}/models`, {
    headers: { authorization: `Bearer ${env.NOVITA_API_KEY}` },
  })
} catch (err) {
  const cause = (err as { cause?: { code?: string } }).cause
  console.log(`Could not reach ${env.NOVITA_BASE_URL} after 3 tries (${cause?.code ?? String(err)}).`)
  console.log('Check your connection or VPN; the terminal must be able to reach api.novita.ai.')
  process.exit(1)
}
if (!res.ok) {
  console.log(`${res.status}: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}

interface ModelRow {
  id: string
  context_size?: number
  input_token_price_per_m?: number
  output_token_price_per_m?: number
  display_name?: string
  model_type?: string
  features?: string[]
}
const json = (await res.json()) as { data?: ModelRow[] }
const rows = (json.data ?? [])
  .filter((m) => (m.model_type ?? 'chat') === 'chat' || m.model_type === undefined)
  .filter((m) => !filter || m.id.toLowerCase().includes(filter))
  .sort((a, b) => a.id.localeCompare(b.id))

/** Price fields are printed as the host returns them; units differ by host, so read them next to the console. */
const money = (v?: number) => (v === undefined ? '' : String(v))

console.log(`${rows.length} models on ${env.NOVITA_BASE_URL}${filter ? ` matching "${filter}"` : ''}\n`)
console.log(`${'model id'.padEnd(52)} ${'ctx'.padStart(7)}  ${'in/M'.padStart(9)}  ${'out/M'.padStart(9)}`)
for (const m of rows) {
  console.log(
    `${m.id.padEnd(52)} ${String(m.context_size ?? '').padStart(7)}  ${money(m.input_token_price_per_m).padStart(9)}  ${money(m.output_token_price_per_m).padStart(9)}`
  )
}
console.log(`\ncurrent NOVITA_MODEL=${env.NOVITA_MODEL}`)
