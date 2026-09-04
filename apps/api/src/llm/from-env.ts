import type { Env } from '../env.js'
import { EMBEDDING_DIMENSIONS } from '../db/schema.js'
import { HashEmbeddings, OpenAiCompatibleEmbeddings, type EmbeddingProvider } from '../memory/embeddings.js'
import { AnthropicProvider } from './anthropic.js'
import { LlmGateway, type TierRoutes } from './gateway.js'
import { OpenAiCompatibleProvider } from './openai-compatible.js'
import { ScriptedProvider } from './scripted.js'
import type { LlmProvider } from './types.js'

export interface InferenceStack {
  /** Real providers only, in the order they were configured. */
  configured: LlmProvider[]
  routes: TierRoutes
  embeddings: EmbeddingProvider
  /** True when at least one tier is served by a real model. */
  live: boolean
  /** Small model for crisis screening, or null when there is no key for it. */
  crisisProvider: LlmProvider | null
}

/**
 * One place that turns env into providers, so the server and the check script
 * cannot drift. EVERYDAY prefers the OpenAI-compatible host, PIVOTAL prefers
 * Anthropic; each falls back to the other, then to scripted replies.
 */
export function inferenceFromEnv(env: Env): InferenceStack {
  const novita = env.NOVITA_API_KEY
    ? new OpenAiCompatibleProvider({
        name: 'novita',
        baseUrl: env.NOVITA_BASE_URL,
        apiKey: env.NOVITA_API_KEY,
        model: env.NOVITA_MODEL,
      })
    : null
  const anthropic = env.ANTHROPIC_API_KEY
    ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
    : null
  const scripted = new ScriptedProvider()

  const everyday = novita ?? anthropic ?? scripted
  const pivotal = anthropic ?? novita ?? scripted

  const embeddings: EmbeddingProvider = env.NOVITA_API_KEY
    ? new OpenAiCompatibleEmbeddings({
        name: 'novita',
        baseUrl: env.NOVITA_BASE_URL,
        apiKey: env.NOVITA_API_KEY,
        model: env.NOVITA_EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      })
    : new HashEmbeddings(EMBEDDING_DIMENSIONS)

  const crisisProvider = env.NOVITA_API_KEY
    ? new OpenAiCompatibleProvider({
        name: 'novita-crisis',
        baseUrl: env.NOVITA_BASE_URL,
        apiKey: env.NOVITA_API_KEY,
        model: env.CRISIS_MODEL,
      })
    : null

  const candidates: Array<LlmProvider | null> = [novita, anthropic]
  return {
    configured: candidates.filter((p): p is LlmProvider => p !== null),
    routes: { EVERYDAY: everyday, PIVOTAL: pivotal },
    embeddings,
    live: everyday !== scripted,
    crisisProvider,
  }
}

export function gatewayFromEnv(env: Env, log?: ConstructorParameters<typeof LlmGateway>[1]) {
  const stack = inferenceFromEnv(env)
  return { ...stack, gateway: new LlmGateway(stack.routes, log) }
}
