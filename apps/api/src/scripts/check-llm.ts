import { env } from '../env.js'
import { inferenceFromEnv } from '../llm/from-env.js'
import type { LlmProvider } from '../llm/types.js'

/**
 * `pnpm --filter @odyssey/api check:llm`
 *
 * Sends one short turn through every configured provider and one embedding
 * call, and prints what came back. Run it right after putting keys in .env,
 * before touching the app: a wrong key, model id, or base URL shows up here as
 * a plain sentence instead of as a silent scripted reply in the chat.
 */

const stack = inferenceFromEnv(env)

if (!stack.configured.length) {
  console.log('No provider keys found. Put NOVITA_API_KEY and/or ANTHROPIC_API_KEY in apps/api/.env and run again.')
  process.exit(1)
}

let failed = false

async function probe(provider: LlmProvider) {
  const started = Date.now()
  let text = ''
  try {
    for await (const ev of provider.stream({
      system: 'You are Elliot. Reply in one short, warm sentence.',
      messages: [{ role: 'user', content: 'hey, long day at work' }],
      maxTokens: 80,
    })) {
      if (ev.type === 'delta') text += ev.text
      if (ev.type === 'done') {
        console.log(`✓ ${provider.name}  model=${ev.model}  ${Date.now() - started}ms  tokens in/out=${ev.usage.inputTokens}/${ev.usage.outputTokens}`)
      }
      if (ev.type === 'refusal') console.log(`! ${provider.name} refused (${ev.model})`)
    }
    console.log(`  "${text.trim()}"`)
  } catch (err) {
    failed = true
    console.log(`✗ ${provider.name}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

for (const provider of stack.configured) await probe(provider)

if (stack.embeddings.name !== 'hash') {
  const started = Date.now()
  try {
    const [vec] = await stack.embeddings.embed(['my sister Mia moved to Leeds'])
    console.log(`✓ embeddings ${stack.embeddings.name}  dims=${vec?.length}  ${Date.now() - started}ms`)
  } catch (err) {
    failed = true
    console.log(`✗ embeddings: ${err instanceof Error ? err.message : String(err)}`)
  }
} else {
  console.log('- embeddings: no NOVITA_API_KEY, long-term memory would use hash embeddings')
}

console.log(`\nroutes: EVERYDAY=${stack.routes.EVERYDAY.name}  PIVOTAL=${stack.routes.PIVOTAL.name}  memory=${env.MEMORY_TIER}`)
process.exit(failed ? 1 : 0)
