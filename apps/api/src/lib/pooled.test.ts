import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pooled } from './pooled.js'

test('pooled keeps order and never exceeds the width', async () => {
  let inFlight = 0
  let peak = 0
  const out = await pooled([5, 1, 4, 2, 3], 2, async (n) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, n * 3))
    inFlight--
    return n * 10
  })
  assert.deepEqual(out, [50, 10, 40, 20, 30])
  assert.equal(peak, 2)
  assert.deepEqual(await pooled([], 4, async () => 1), [])
})
