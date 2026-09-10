/**
 * Map with at most `width` promises in flight. Results keep input order. Used
 * wherever a submission fans out into many small model calls: a burst of thirty
 * at once is what turns a 700ms model into a 3s timeout.
 */
export async function pooled<T, R>(items: readonly T[], width: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker))
  return results
}
