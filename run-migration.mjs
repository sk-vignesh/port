// run-migration.mjs
// Connects to Supabase Postgres via the session pooler using the service role JWT
// then applies the price_history migration.

import pg from 'pg'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { Client } = pg

const PROJECT_REF = 'gspnjzckdlkhidlivrzk'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcG5qemNrZGxraGlkbGl2cnprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE3MDE1MSwiZXhwIjoyMDg5NzQ2MTUxfQ.WFcekWUTMAMc86O2QHQB70yw3e6dTjzL-5GYZ-TJjBM'

// Direct DB connection using the provided connection string
const client = new Client({
  host:     'db.gspnjzckdlkhidlivrzk.supabase.co',
  port:     5432,
  database: 'postgres',
  user:     'postgres',
  password: 'rAFF!NB@Qjx8rTQ',
  ssl:      { rejectUnauthorized: false },
})

const sqlPath = join(__dirname, 'supabase', 'migrations', '006_price_history.sql')
const sql     = await readFile(sqlPath, 'utf8')

try {
  console.log('🔌  Connecting...')
  await client.connect()
  console.log('✅  Connected. Running migration...')
  await client.query(sql)
  console.log('✅  Migration applied successfully! price_history table is ready.')
} catch (e) {
  if (e.message.includes('already exists') || e.message.includes('duplicate')) {
    console.log('ℹ️   Table / constraint already exists — migration already applied.')
  } else {
    console.error('❌  Migration failed:', e.message)
    process.exit(1)
  }
} finally {
  await client.end()
}
