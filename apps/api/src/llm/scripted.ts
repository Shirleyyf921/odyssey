import type { CompletionEvent, CompletionRequest, LlmProvider } from './types.js'

/**
 * Stand-in provider for local dev without API keys and for tests. Streams a fixed
 * reply (or one computed from the request) word by word.
 */
export class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted'

  constructor(private readonly reply: string | ((req: CompletionRequest) => string) = defaultReply) {}

  async *stream(req: CompletionRequest): AsyncIterable<CompletionEvent> {
    const text = typeof this.reply === 'function' ? this.reply(req) : this.reply
    const words = text.split(/(?<=\s)/)
    for (const word of words) yield { type: 'delta', text: word }
    yield {
      type: 'done',
      model: 'scripted',
      usage: { inputTokens: req.system.length / 4, outputTokens: words.length },
    }
  }
}

function defaultReply(req: CompletionRequest): string {
  const last = req.messages.at(-1)?.content ?? ''
  return `(scripted) You said: "${last}". Set NOVITA_API_KEY or ANTHROPIC_API_KEY for a real reply.`
}
