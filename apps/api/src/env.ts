import { z } from 'zod'

/** Fail fast at boot rather than at the first request that needs a missing var. */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Railway injects PORT. Do not hardcode it. */
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** Optional locally: without it the API runs on an in-memory store with a demo conversation. */
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  // EVERYDAY tier: any OpenAI-compatible host. Novita by default; DeepInfra is a URL change.
  NOVITA_API_KEY: z.string().min(1).optional(),
  NOVITA_BASE_URL: z.string().url().default('https://api.novita.ai/v3/openai'),
  NOVITA_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct'),

  // PIVOTAL tier.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
})

export const env = Env.parse(process.env)
export type Env = z.infer<typeof Env>
