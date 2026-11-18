import { Pool } from 'pg'
import { env } from '../config/env.js'

export const pool = new Pool({
  connectionString: env.databaseUrl,
  connectionTimeoutMillis: 10_000,
})

// Idle clients can disconnect outside any request's try/catch. pg removes the
// broken client before this event and opens replacements as needed. Without a
// listener, EventEmitter treats the error as uncaught and terminates Node.
pool.on('error', (error: Error & { code?: string }) => {
  const code = typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code) ? error.code : 'unknown'
  // Never log the full error/client: pg attaches connection details to it.
  console.error(`Database pool lost an idle connection (${code}). New connections will be opened as needed.`)
})
