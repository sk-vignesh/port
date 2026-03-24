import pg from 'pg'
const { Client } = pg
const client = new Client({
  host: 'db.gspnjzckdlkhidlivrzk.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: 'rAFF!NB@Qjx8rTQ',
  ssl: { rejectUnauthorized: false }
})
await client.connect()
const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'nse_market_data' ORDER BY ordinal_position
`)
console.log('nse_market_data columns:', cols.rows.map(r => r.column_name).join(', '))
await client.end()
