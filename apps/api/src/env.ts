import { z } from 'zod'

/** Fail fast at boot rather than at the first request that needs a missing var. */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Railway injects PORT. Do not hardcode it. */
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
})

export const env = Env.parse(process.env)
export type Env = z.infer<typeof Env>
