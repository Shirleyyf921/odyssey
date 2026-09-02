import type { CompletionEvent, CompletionRequest, LlmProvider, ModelTier } from './types.js'

export type TierRoutes = Record<ModelTier, LlmProvider>

export interface GatewayLogger {
  info(obj: Record<string, unknown>, msg: string): void
  warn(obj: Record<string, unknown>, msg: string): void
}

/**
 * Routes a request to the provider configured for its tier.
 *
 * If the PIVOTAL provider refuses before emitting any text, the request is re-run
 * on EVERYDAY so the conversation never dead-ends on a vendor policy. Content that
 * the product itself must not answer is handled before generation, by the safety
 * pipeline (ARCHITECTURE.md section 12), not here.
 */
export class LlmGateway {
  constructor(
    private readonly routes: TierRoutes,
    private readonly log?: GatewayLogger
  ) {}

  providerFor(tier: ModelTier): LlmProvider {
    return this.routes[tier]
  }

  async *stream(
    tier: ModelTier,
    req: CompletionRequest,
    signal?: AbortSignal
  ): AsyncIterable<CompletionEvent> {
    const primary = this.routes[tier]
    let emitted = false
    for await (const event of primary.stream(req, signal)) {
      if (event.type === 'refusal' && !emitted && tier !== 'EVERYDAY') {
        this.log?.warn({ provider: primary.name, model: event.model }, 'refusal, falling back to EVERYDAY')
        yield* this.routes.EVERYDAY.stream(req, signal)
        return
      }
      if (event.type === 'delta') emitted = true
      yield event
    }
  }
}
