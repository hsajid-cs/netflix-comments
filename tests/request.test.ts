import assert from 'node:assert/strict'
import { test } from 'node:test'
import { requestJson } from '../src/background/request.ts'

const url = 'http://localhost:3000/test'

test('returns JSON and forwards request headers', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer example')
    assert.ok(init.signal instanceof AbortSignal)
    return Response.json({ id: 'comment' })
  })
  assert.deepEqual(await requestJson(url, { headers: { Authorization: 'Bearer example' } }), {
    ok: true, data: { id: 'comment' },
  })
})

test('clears a rejected session and preserves the backend error message', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Session expired' } }, { status: 401 }))
  let cleared = false
  assert.deepEqual(await requestJson(url, {}, { onUnauthorized: async () => { cleared = true } }), {
    ok: false, error: 'Session expired',
  })
  assert.equal(cleared, true)
})

test('handles proxy HTML errors without crashing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Bad gateway</html>', { status: 502 }))
  assert.deepEqual(await requestJson(url), { ok: false, error: 'Request failed (502)' })
})

test('rejects malformed successful responses instead of reporting null data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('not json'))
  const result = await requestJson(url)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /invalid response/)
})

test('supports empty successful responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }))
  assert.deepEqual(await requestJson(url), { ok: true, data: null })
})

test('reports connection failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
  const result = await requestJson(url)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /Could not reach/)
})

test('aborts a stalled request and returns a retryable error', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
  }))
  const result = await requestJson(url, {}, { timeoutMs: 10 })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /took too long/)
})

test('also aborts when headers arrive but the JSON body stalls', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => ({
    status: 200, ok: true,
    json: () => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
    }),
  }))
  const result = await requestJson(url, {}, { timeoutMs: 10 })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /took too long/)
})
