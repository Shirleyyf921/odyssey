/**
 * The image model behind "ask him for a picture". One method: a prompt and
 * the reference images in, the bytes out. Seedream 4.0 on Novita is the one
 * that passed the spike (docs/art-prompts.md); anything with the same shape
 * can replace it.
 */
export interface ImageProvider {
  readonly name: string
  generate(input: { prompt: string; references: string[] }): Promise<{ image: Buffer; contentType: string }>
}

export class ImageProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string
  ) {
    super(message)
  }
}

/** Seedream 4.0 through Novita: synchronous, reference images by URL, one image back by URL. */
export class SeedreamProvider implements ImageProvider {
  readonly name = 'seedream-4.0'

  constructor(
    private readonly apiKey: string,
    private readonly url = 'https://api.novita.ai/v3/seedream-4.0',
    /** 3:4 at 1152×1536: about 850 KB a picture, against 1.7 MB at 1536×2048, and nobody sees the difference on a phone. */
    private readonly size = '1152x1536',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async generate({ prompt, references }: { prompt: string; references: string[] }) {
    // The reference goes as bytes, not as a URL: his hero lives on our own origin, which
    // the model's host cannot always reach (localhost in development, a private domain later).
    const images = await Promise.all(references.map((r) => this.inline(r)))
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, images, size: this.size, watermark: false }),
    })
    if (!res.ok) throw new ImageProviderError(this.name, `${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = (await res.json()) as { images?: unknown[]; data?: unknown[] }
    const first = (body.images ?? body.data ?? [])[0]
    const url = typeof first === 'string' ? first : ((first as { image_url?: string; url?: string } | undefined)?.image_url ?? (first as { url?: string } | undefined)?.url)
    if (!url) throw new ImageProviderError(this.name, 'no image in the response')
    if (!url.startsWith('http')) {
      const b64 = url.split(',').pop() ?? ''
      return { image: Buffer.from(b64, 'base64'), contentType: 'image/png' }
    }
    const img = await this.fetchImpl(url)
    if (!img.ok) throw new ImageProviderError(this.name, `image fetch ${img.status}`)
    return { image: Buffer.from(await img.arrayBuffer()), contentType: img.headers.get('content-type') ?? 'image/png' }
  }

  private inline(url: string) {
    return inlineReference(this.fetchImpl, url)
  }
}

/** A reference URL as a data URI the model can read without fetching anything itself. */
async function inlineReference(fetchImpl: typeof fetch, url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const res = await fetchImpl(url)
  if (!res.ok) throw new ImageProviderError('seedream-4.0', `reference fetch ${res.status}`)
  const type = res.headers.get('content-type') ?? 'image/jpeg'
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
}

/** For tests and keyless development: a fixed picture, and the prompts it was asked for. */
export class ScriptedImageProvider implements ImageProvider {
  readonly name = 'scripted'
  readonly prompts: Array<{ prompt: string; references: string[] }> = []

  constructor(private readonly image = ONE_PIXEL_PNG) {}

  async generate(input: { prompt: string; references: string[] }) {
    this.prompts.push(input)
    return { image: this.image, contentType: 'image/png' }
  }
}

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
