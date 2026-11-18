import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from './pool.js'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql')

async function migrate(): Promise<void> {
  try {
    const schema = readFileSync(schemaPath, 'utf-8')
    await pool.query(schema)
    console.log('Migration applied successfully.')
  } finally {
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})
