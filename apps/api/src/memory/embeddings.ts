import { createHash } from 'node:crypto'

export interface EmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  embed(texts: string[]): Promise<number[][]>
}

export interface OpenAiCompatibleEmbeddingOptions {
  name: string
  baseUrl: string
  apiKey: string
  model: string
  dimensions: number
  fetch?: typeof fetch
}

/** `/embeddings` on any OpenAI-compatible host (Novita, DeepInfra, ...). */
export class OpenAiCompatibleEmbeddings implements EmbeddingProvider {
  readonly name: string
  readonly dimensions: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: OpenAiCompatibleEmbeddingOptions) {
    this.name = opts.name
    this.dimensions = opts.dimensions
    this.fetchImpl = opts.fetch ?? fetch
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []
    const res = await this.fetchImpl(`${this.opts.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.opts.model, input: texts }),
    })
    if (!res.ok) throw new Error(`${this.name} embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json = (await res.json()) as { data?: Array<{ index?: number; embedding: number[] }> }
    const out: number[][] = new Array(texts.length)
    json.data?.forEach((d, i) => {
      const vec = d.embedding
      if (vec.length !== this.dimensions) {
        throw new Error(`${this.name} returned ${vec.length} dimensions, schema expects ${this.dimensions}`)
      }
      out[d.index ?? i] = vec
    })
    return out
  }
}

/**
 * Deterministic bag-of-words embedding for tests and keyless local dev. Retrieval
 * behaves plausibly (shared words score high) without any network call.
 * Never use it in production: it knows nothing about meaning.
 */
export class HashEmbeddings implements EmbeddingProvider {
  readonly name = 'hash'
  constructor(readonly dimensions = 1024) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vec = new Array<number>(this.dimensions).fill(0)
      for (const token of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
        const h = createHash('sha1').update(token).digest()
        const idx = h.readUInt32BE(0) % this.dimensions
        vec[idx] = (vec[idx] ?? 0) + 1
      }
      const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1
      return vec.map((x) => x / norm)
    })
  }
}
