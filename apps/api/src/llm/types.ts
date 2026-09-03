/**
 * LLM gateway contract. Business code never imports a vendor SDK; it asks the
 * gateway for a tier and gets back a stream of deltas. See ARCHITECTURE.md section 6.
 */

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  system: string
  messages: ChatTurn[]
  maxTokens?: number
  temperature?: number
}

export interface CompletionUsage {
  inputTokens: number
  outputTokens: number
}

export type CompletionEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; model: string; usage: CompletionUsage }
  /** The vendor's safety layer declined to answer. Not an error: the gateway routes around it. */
  | { type: 'refusal'; model: string }

export interface LlmProvider {
  readonly name: string
  stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<CompletionEvent>
}

/**
 * EVERYDAY carries the bulk of conversation on a cheap open-weight model.
 * PIVOTAL is reserved for moments that decide whether the relationship feels real,
 * and for memory extraction, on a stronger model.
 */
export type ModelTier = 'EVERYDAY' | 'PIVOTAL'
