import { fetchWithRetry } from './http.js'
import { readSse } from './sse.js'
import type { CompletionEvent, CompletionRequest, LlmProvider } from './types.js'

export interface OpenAiCompatibleOptions {
  /** Shown in logs and usage records, e.g. "novita" or "deepinfra". */
  name: string
  baseUrl: string
  apiKey: string
  model: string
  fetch?: typeof fetch
}

interface ChatChunk {
  model?: string
  choices?: Array<{ delta?: { content?: string | null } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
}

/**
 * Any vendor exposing the OpenAI chat-completions wire format: Novita, DeepInfra,
 * and most open-weight hosts. One class, several instances, so failover between
 * them is a config change.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: OpenAiCompatibleOptions) {
    this.name = opts.name
    this.fetchImpl = opts.fetch ?? fetch
  }

  async *stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<CompletionEvent> {
    const res = await fetchWithRetry(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.opts.apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: this.opts.model,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature ?? 0.8,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      }),
      signal,
    }, this.fetchImpl)
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '')
      throw new Error(`${this.name} ${res.status}: ${detail.slice(0, 300)}`)
    }

    let model = this.opts.model
    let usage = { inputTokens: 0, outputTokens: 0 }
    for await (const data of readSse(res.body)) {
      if (data === '[DONE]') break
      let chunk: ChatChunk
      try {
        chunk = JSON.parse(data) as ChatChunk
      } catch {
        continue
      }
      if (chunk.model) model = chunk.model
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        }
      }
      const text = chunk.choices?.[0]?.delta?.content
      if (text) yield { type: 'delta', text }
    }
    yield { type: 'done', model, usage }
  }
}
