import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1/unused'
process.env.JWT_SECRET = 'test-only-unused-secret'
const { pool } = await import('../src/db/pool.js')

test('administrative termination of an idle connection is handled without crashing or logging connection details', (t) => {
  const log = t.mock.method(console, 'error', () => {})
  const error = Object.assign(new Error('terminating connection due to administrator command'), {
    code: '57P01',
    client: { password: 'PRIVATE_PASSWORD', connectionString: 'PRIVATE_CONNECTION_STRING' },
  })
  assert.doesNotThrow(() => pool.emit('error', error))
  assert.equal(log.mock.callCount(), 1)
  const output = JSON.stringify(log.mock.calls[0].arguments)
  assert.match(output, /57P01/)
  assert.doesNotMatch(output, /PRIVATE_PASSWORD|PRIVATE_CONNECTION_STRING|client/)
  assert.equal(pool.ending, false)
})

test('disconnects without a PostgreSQL code are handled without logging arbitrary error contents', (t) => {
  const log = t.mock.method(console, 'error', () => {})
  assert.doesNotThrow(() => pool.emit('error', new Error('PRIVATE_CONNECTION_STRING')))
  assert.doesNotThrow(() => pool.emit('error', Object.assign(new Error('disconnect'), { code: 'PRIVATE_CONNECTION_STRING' })))
  assert.equal(log.mock.callCount(), 2)
  for (const call of log.mock.calls) {
    assert.match(JSON.stringify(call.arguments), /unknown/)
    assert.doesNotMatch(JSON.stringify(call.arguments), /PRIVATE_CONNECTION_STRING/)
  }
})
