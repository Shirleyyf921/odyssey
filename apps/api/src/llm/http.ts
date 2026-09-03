/**
 * fetch with a short retry on connection-level failures (reset during TLS,
 * DNS blips, the proxy dropping the socket). HTTP error statuses are not
 * retried here; callers decide what a 4xx/5xx means.
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  attempts = 3
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchImpl(input, init)
    } catch (err) {
      lastErr = err
      if (init.signal?.aborted || i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 400 * 2 ** i))
    }
  }
  throw lastErr
}
