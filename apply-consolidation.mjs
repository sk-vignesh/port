import pg from 'pg'
const { Client } = pg
const client = new Client({
  host: 'db.gspnjzckdlkhidlivrzk.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'rAFF!NB@Qjx8rTQ',
  ssl: { rejectUnauthorized: false }
})

await client.connect()
console.log('Connected.')

// Step 1: Check if nse_market_data still exists
const check = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nse_market_data') AS e")
if (!check.rows[0].e) {
  console.log('nse_market_data does not exist — already consolidated!')
  const cnt = await client.query('SELECT COUNT(*) FROM price_history')
  console.log('price_history rows:', Number(cnt.rows[0].count).toLocaleString())
  await client.end(); process.exit(0)
}

const nseCount = await client.query('SELECT COUNT(*) FROM nse_market_data')
console.log('nse_market_data rows:', nseCount.rows[0].count)

// Step 2: migrate rows
console.log('Migrating...')
const insertSQL = 'INSERT INTO price_history (symbol,date,open,high,low,close,volume,prev_close,index_priority) SELECT n.symbol,n.date,n.open_price,n.high_price,n.low_price,n.close_price,n.volume,n.prev_close,n.index_priority FROM nse_market_data n ON CONFLICT (symbol,date) DO UPDATE SET open=EXCLUDED.open,high=EXCLUDED.high,low=EXCLUDED.low,close=EXCLUDED.close,volume=COALESCE(EXCLUDED.volume,price_history.volume),prev_close=EXCLUDED.prev_close,index_priority=COALESCE(EXCLUDED.index_priority,price_history.index_priority)'
const res = await client.query(insertSQL)
console.log('Merged rows:', res.rowCount)

// Step 3: drop it
await client.query('DROP TABLE IF EXISTS nse_market_data')
console.log('\u2705 nse_market_data dropped.')

const ph = await client.query('SELECT COUNT(*) FROM price_history')
console.log('\u2705 price_history total rows:', Number(ph.rows[0].count).toLocaleString())

await client.end()
