import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL         = 'https://gspnjzckdlkhidlivrzk.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcG5qemNrZGxraGlkbGl2cnprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE3MDE1MSwiZXhwIjoyMDg5NzQ2MTUxfQ.WFcekWUTMAMc86O2QHQB70yw3e6dTjzL-5GYZ-TJjBM'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const { error } = await sb.from('price_history').select('id').limit(1)

if (!error) {
  console.log('✅  price_history table already exists — ready to import!')
  process.exit(0)
}

if (error.code === 'PGRST204' || error.message?.includes('does not exist') || error.code === '42P01') {
  console.log('⚠️  Table does not exist. Please run this SQL in your Supabase dashboard:')
  console.log('   https://supabase.com/dashboard/project/gspnjzckdlkhidlivrzk/sql/new\n')
  console.log(`-- Paste this:\n`)
  const sql = await readFile(join(__dirname, 'portfolio-web/supabase/migrations/006_price_history.sql'), 'utf8')
  console.log(sql)
  process.exit(1)
} else {
  // Some other error — table may still exist
  console.log(`ℹ️  Got response (code ${error.code}): ${error.message}`)
  console.log('   Proceeding — table likely exists.')
}
