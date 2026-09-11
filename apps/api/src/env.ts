import { loadEnvFile } from 'node:process'
import { z } from 'zod'

// Local dev reads apps/api/.env (gitignored). Railway injects real env vars, so a
// missing file is normal. Values already in the environment win over the file.
try {
  loadEnvFile('.env')
} catch {
  // no .env: fine
}

/** Fail fast at boot rather than at the first request that needs a missing var. */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Railway injects PORT. Do not hardcode it. */
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** Optional locally: without it the API runs on an in-memory store with the seed roster. */
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  // EVERYDAY tier: any OpenAI-compatible host. Novita by default; DeepInfra is a URL change.
  NOVITA_API_KEY: z.string().min(1).optional(),
  NOVITA_BASE_URL: z.string().url().default('https://api.novita.ai/v3/openai'),
  NOVITA_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct'),
  /** Long-term memory embeddings, same host. Dimensions must match db/schema.ts. */
  NOVITA_EMBEDDING_MODEL: z.string().default('baai/bge-m3'),

  // PIVOTAL tier.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),

  /**
   * STORY tier: story turns and the author's dry-run. DeepSeek on the Novita host
   * by default, so the everyday key is enough; set the base URL and key to use
   * DeepSeek's own endpoint (`https://api.deepseek.com`, model `deepseek-chat`).
   */
  STORY_MODEL: z.string().default('deepseek/deepseek-v3.2'),
  STORY_BASE_URL: z.string().url().optional(),
  STORY_API_KEY: z.string().min(1).optional(),

  /**
   * Crisis classifier (ARCHITECTURE.md section 12): a small, fast model on the
   * OpenAI-compatible host, separate from the persona tiers. Needs NOVITA_API_KEY.
   */
  CRISIS_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct'),
  CRISIS_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  /**
   * Screens user-made episodes at submit (docs/ugc-pipeline.md). Off the request
   * path, so it can afford the persona-sized model: the 8B one blocks our own
   * briefs. Same host and key as CRISIS_MODEL.
   */
  SCREEN_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct'),
  SCREEN_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

  /** Which tier runs memory extraction and summaries. */
  MEMORY_TIER: z.enum(['EVERYDAY', 'PIVOTAL']).default('PIVOTAL'),

  // Sign-in. Apple audience is the bundle id; Google accepts every client id that may mint tokens.
  APPLE_BUNDLE_ID: z.string().default('com.odyssey.app'),
  /** Comma-separated. Empty disables Google sign-in. */
  GOOGLE_CLIENT_IDS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Billing (ARCHITECTURE.md section 7). Both optional until the store products exist;
  // without them purchase UI is hidden and everyone is FREE.
  /** RevenueCat secret API key (v1, `sk_...`), used to re-read a subscriber. */
  REVENUECAT_SECRET_KEY: z.string().min(1).optional(),
  /** The Authorization header value configured on the RevenueCat webhook. */
  REVENUECAT_WEBHOOK_SECRET: z.string().min(16).optional(),
  /**
   * Enables POST /billing/dev/grant in production for dogfooding, gated by this value in
   * the x-grant-secret header. Outside production the route is open without it.
   */
  BILLING_GRANT_SECRET: z.string().min(16).optional(),

  /** Where the exported web build lives (apps/mobile/dist). Served from this origin when present. */
  WEB_DIST: z.string().default('../mobile/dist'),

  // Review queue (docs/ugc-pipeline.md, "Moderation"). Required in production for /review; open outside it.
  REVIEW_SECRET: z.string().min(16).optional(),
  /** A mail on every submission that needs a person, via Resend's HTTP API. Both unset: the log line only. */
  RESEND_API_KEY: z.string().min(1).optional(),
  REVIEW_NOTIFY_EMAIL: z.string().email().optional(),
  REVIEW_NOTIFY_FROM: z.string().default('Odyssey review <onboarding@resend.dev>'),
})

export const env = Env.parse(process.env)
export type Env = z.infer<typeof Env>
