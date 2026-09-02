/**
 * Minimal server-sent-events reader for fetch response bodies. Yields the `data:`
 * payload of each event; multi-line data is joined with newlines per the spec.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = parseEvent(chunk)
        if (data !== null) yield data
        boundary = buffer.indexOf('\n\n')
      }
    }
    // A final event without a trailing blank line.
    const tail = parseEvent(buffer)
    if (tail !== null) yield tail
  } finally {
    reader.releaseLock()
  }
}

function parseEvent(chunk: string): string | null {
  const lines = chunk.split('\n')
  const data: string[] = []
  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  return data.length ? data.join('\n') : null
}
