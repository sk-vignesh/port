/**
 * import-prices.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Reads all 2228 per-symbol CSVs from the Kaggle dataset and upserts rows
 * from Jan 2021 onwards into Supabase price_history table.
 *
 * Usage:
 *   node import-prices.mjs [DATA_FOLDER] [SUPABASE_URL] [SUPABASE_SERVICE_KEY]
 *
 * Or set env vars:
 *   DATA_FOLDER        – path to the folder with RELIANCE.csv, INFY.csv, etc.
 *   SUPABASE_URL       – your project URL
 *   SUPABASE_SERVICE_KEY – service role key (bypasses RLS)
 *
 * Requires:  node 18+   (uses fetch natively)
 * Install:   npm install @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { createReadStream } from 'fs'
import readline from 'readline'

// ── Config ────────────────────────────────────────────────────────────────
const DATA_FOLDER          = process.argv[2] ?? process.env.DATA_FOLDER         ?? 'C:\\Users\\skvig\\Downloads\\data till 2026-Jan'
const SUPABASE_URL         = process.env.SUPABASE_URL        ?? 'https://gspnjzckdlkhidlivrzk.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcG5qemNrZGxraGlkbGl2cnprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE3MDE1MSwiZXhwIjoyMDg5NzQ2MTUxfQ.WFcekWUTMAMc86O2QHQB70yw3e6dTjzL-5GYZ-TJjBM'
const FROM_DATE            = '2021-01-01'
const BATCH_SIZE           = 1000

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_KEY (env or args 3/4)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────
function cleanSymbol(raw) {
  // e.g. "NSE:RELIANCE" → "RELIANCE"
  return raw.replace(/^NSE:/i, '').trim()
}

async function parseCsv(filePath, symbol) {
  const rows = []
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let isHeader = true
  // Expected header: ,datetime,symbol,open,high,low,close,volume,change (%),last day change (%)
  // Column indices (after split on ','): 1=date, 2=symbol, 3=open, 4=high, 5=low, 6=close, 7=volume
  const IDX = { date: 1, sym: 2, open: 3, high: 4, low: 5, close: 6, volume: 7 }

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue }
    const cols = line.split(',')
    if (cols.length < 7) continue

    const date = cols[IDX.date]?.trim()
    if (!date || date < FROM_DATE) continue        // skip old data

    const close = parseFloat(cols[IDX.close])
    if (isNaN(close) || close <= 0) continue       // skip bad prices

    rows.push({
      symbol: symbol,
      date,
      open:   parseFloat(cols[IDX.open])  || null,
      high:   parseFloat(cols[IDX.high])  || null,
      low:    parseFloat(cols[IDX.low])   || null,
      close,
      volume: parseInt(cols[IDX.volume])  || null,
    })
  }

  return rows
}

async function upsertBatch(rows) {
  const { error } = await supabase
    .from('price_history')
    .upsert(rows, { onConflict: 'symbol,date', ignoreDuplicates: true })
  if (error) throw error
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const files = (await readdir(DATA_FOLDER)).filter(f => f.endsWith('.csv'))
  console.log(`📂  Found ${files.length} CSV files in: ${DATA_FOLDER}`)
  console.log(`📅  Importing rows from ${FROM_DATE} onwards\n`)

  let totalRows = 0, totalFiles = 0, errors = 0

  for (let i = 0; i < files.length; i++) {
    const file     = files[i]
    const symbol   = basename(file, '.csv')        // e.g. RELIANCE
    const filePath = join(DATA_FOLDER, file)

    process.stdout.write(`\r[${i+1}/${files.length}] ${symbol.padEnd(20)} rows:${totalRows}`)

    try {
      const rows = await parseCsv(filePath, symbol)
      if (rows.length === 0) continue

      // Batch upsert
      for (let b = 0; b < rows.length; b += BATCH_SIZE) {
        await upsertBatch(rows.slice(b, b + BATCH_SIZE))
      }

      totalRows  += rows.length
      totalFiles += 1
    } catch (err) {
      errors++
      console.error(`\n❌  ${symbol}: ${err.message}`)
    }
  }

  console.log(`\n\n✅  Done!`)
  console.log(`   Files processed:  ${totalFiles}`)
  console.log(`   Rows imported:    ${totalRows.toLocaleString()}`)
  console.log(`   Errors:           ${errors}`)
}

main().catch(err => { console.error(err); process.exit(1) })
