import Anthropic from '@anthropic-ai/sdk'
import type { CompletionEvent, CompletionRequest, LlmProvider } from './types.js'

export interface AnthropicOptions {
  apiKey: string
  model: string
}

/** The PIVOTAL tier. Persona prefix is cached; effort stays low because this is chat, not code. */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic'
  private readonly client: Anthropic

  constructor(private readonly opts: AnthropicOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey })
  }

  async *stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<CompletionEvent> {
    const stream = this.client.messages.stream(
      {
        model: this.opts.model,
        max_tokens: req.maxTokens ?? 1024,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: 'low' },
      },
      { signal }
    )
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'delta', text: event.delta.text }
      }
    }
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      yield { type: 'refusal', model: final.model }
      return
    }
    yield {
      type: 'done',
      model: final.model,
      usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
    }
  }
}
