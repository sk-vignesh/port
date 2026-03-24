const { Client } = require('pg')
const client = new Client({
  host: 'db.gspnjzckdlkhidlivrzk.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'rAFF!NB@Qjx8rTQ',
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()
  console.log('Connected.\n')

  // Check exactly which columns nse_market_data has
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='nse_market_data' ORDER BY ordinal_position")
  const nseColumns = cols.rows.map(r => r.column_name)
  console.log('nse_market_data columns available:', nseColumns.join(', '))

  // Migrate using only the columns that exist in nse_market_data
  // Base columns always present: symbol, date, open_price, high_price, low_price, close_price, volume, prev_close
  const hasPrevClose    = nseColumns.includes('prev_close')
  const hasIndexPriority = nseColumns.includes('index_priority')
  const hasisin         = nseColumns.includes('isin')

  // Build dynamic SQL based on what columns exist
  const insertCols  = ['symbol', 'date', 'open', 'high', 'low', 'close', 'volume']
  const selectExprs = ['n.symbol', 'n.date', 'n.open_price', 'n.high_price', 'n.low_price', 'n.close_price', 'n.volume']
  const updateParts = ['open=EXCLUDED.open', 'high=EXCLUDED.high', 'low=EXCLUDED.low', 'close=EXCLUDED.close', 'volume=COALESCE(EXCLUDED.volume,price_history.volume)']

  if (hasPrevClose) {
    insertCols.push('prev_close'); selectExprs.push('n.prev_close'); updateParts.push('prev_close=EXCLUDED.prev_close')
  }
  if (hasIndexPriority) {
    insertCols.push('index_priority'); selectExprs.push('n.index_priority'); updateParts.push('index_priority=COALESCE(EXCLUDED.index_priority,price_history.index_priority)')
  }
  if (hasisin) {
    insertCols.push('isin'); selectExprs.push('n.isin'); updateParts.push('isin=COALESCE(EXCLUDED.isin,price_history.isin)')
  }

  const sql = `INSERT INTO price_history (${insertCols.join(',')}) SELECT ${selectExprs.join(',')} FROM nse_market_data n ON CONFLICT (symbol,date) DO UPDATE SET ${updateParts.join(',')}`
  console.log('\nMigrating rows...')
  const res = await client.query(sql)
  console.log('  Merged', res.rowCount, 'rows into price_history.')

  console.log('\nDropping nse_market_data...')
  await client.query('DROP TABLE IF EXISTS nse_market_data')
  console.log('  Done.')

  const ph = await client.query('SELECT COUNT(*) FROM price_history')
  console.log('\n\u2705 price_history total rows:', Number(ph.rows[0].count).toLocaleString())
}

run().catch(e => { console.error('\nERROR:', e.message); process.exitCode = 1 }).finally(() => client.end())
