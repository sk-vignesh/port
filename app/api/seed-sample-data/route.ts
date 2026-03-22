import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

const SAMPLE_SECURITIES = [
  { name: 'Apple Inc.',              currency_code: 'USD', isin: 'US0378331005', ticker_symbol: 'AAPL', wkn: '865985', note: 'Sample — US technology sector',    is_retired: false },
  { name: 'BASF SE',                 currency_code: 'EUR', isin: 'DE000BASF111', ticker_symbol: 'BAS',  wkn: 'BASF11', note: 'Sample — German chemicals sector', is_retired: false },
  { name: 'Vanguard FTSE All-World', currency_code: 'USD', isin: 'IE00B3RBWM25', ticker_symbol: 'VWRL', wkn: 'A1JX52', note: 'Sample ETF — global index',         is_retired: false },
]

const SAMPLE_PRICES: Record<string, { date: string; value: number }[]> = {
  AAPL: [
    { date: '2023-01-03', value: 12489 }, { date: '2023-02-01', value: 14403 },
    { date: '2023-03-01', value: 14322 }, { date: '2023-04-03', value: 16635 },
    { date: '2023-05-01', value: 16946 }, { date: '2023-06-01', value: 18011 },
    { date: '2023-07-03', value: 18933 }, { date: '2023-08-01', value: 17822 },
    { date: '2023-09-01', value: 17012 }, { date: '2023-10-02', value: 17493 },
    { date: '2023-11-01', value: 18254 }, { date: '2023-12-01', value: 19189 },
  ],
  BAS: [
    { date: '2023-01-03', value: 5102 }, { date: '2023-02-01', value: 5263 },
    { date: '2023-03-01', value: 4842 }, { date: '2023-04-03', value: 4941 },
    { date: '2023-05-01', value: 4345 }, { date: '2023-06-01', value: 4421 },
    { date: '2023-07-03', value: 4655 }, { date: '2023-08-01', value: 4389 },
    { date: '2023-09-01', value: 4102 }, { date: '2023-10-02', value: 3988 },
    { date: '2023-11-01', value: 4277 }, { date: '2023-12-01', value: 4642 },
  ],
  VWRL: [
    { date: '2023-01-03', value: 9021 }, { date: '2023-02-01', value: 9388 },
    { date: '2023-03-01', value: 9442 }, { date: '2023-04-03', value: 9711 },
    { date: '2023-05-01', value: 9588 }, { date: '2023-06-01', value: 9812 },
    { date: '2023-07-03', value: 10144 }, { date: '2023-08-01', value: 9933 },
    { date: '2023-09-01', value: 9655 }, { date: '2023-10-02', value: 9477 },
    { date: '2023-11-01', value: 10122 }, { date: '2023-12-01', value: 10488 },
  ],
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 1. Securities (user_id is on this table)
    const { data: securities, error: secErr } = await supabase
      .from('securities')
      .insert(SAMPLE_SECURITIES.map(s => ({ ...s, user_id: user.id })))
      .select()
    if (secErr) throw new Error(`Securities: ${secErr.message}`)

    const byTicker = Object.fromEntries(securities!.map(s => [s.ticker_symbol, s]))

    // 2. Security prices (no user_id — owned via security FK)
    const priceRows = Object.entries(SAMPLE_PRICES).flatMap(([ticker, prices]) =>
      prices.map(p => ({ security_id: byTicker[ticker]?.id, date: p.date, value: p.value }))
        .filter(r => r.security_id)
    )
    if (priceRows.length) {
      const { error: priceErr } = await supabase.from('security_prices').insert(priceRows)
      if (priceErr) throw new Error(`Prices: ${priceErr.message}`)
    }

    // 3. Accounts (user_id is on this table)
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .insert([
        { name: 'Cash Account (EUR)', currency_code: 'EUR', note: 'Sample EUR cash account', user_id: user.id },
        { name: 'Cash Account (USD)', currency_code: 'USD', note: 'Sample USD cash account', user_id: user.id },
      ])
      .select()
    if (accErr) throw new Error(`Accounts: ${accErr.message}`)

    const eurAcc = accounts!.find(a => a.currency_code === 'EUR')!
    const usdAcc = accounts!.find(a => a.currency_code === 'USD')!

    // 4. Portfolios (user_id is on this table)
    const { data: portfolios, error: portErr } = await supabase
      .from('portfolios')
      .insert([
        { name: 'EUR Portfolio', reference_account_id: eurAcc.id, note: 'Sample EUR portfolio — BASF', user_id: user.id },
        { name: 'USD Portfolio', reference_account_id: usdAcc.id, note: 'Sample USD portfolio — Apple & VWRL', user_id: user.id },
      ])
      .select()
    if (portErr) throw new Error(`Portfolios: ${portErr.message}`)

    const eurPort = portfolios!.find(p => p.name.startsWith('EUR'))!
    const usdPort = portfolios!.find(p => p.name.startsWith('USD'))!

    // 5. Account transactions (NO user_id — owned via account_id FK)
    const { error: accTxErr } = await supabase.from('account_transactions').insert([
      { account_id: eurAcc.id, date: '2022-01-03', type: 'DEPOSIT',   amount: 1000000, shares: 0, currency_code: 'EUR', note: 'Initial deposit' },
      { account_id: eurAcc.id, date: '2022-06-01', type: 'DEPOSIT',   amount: 500000,  shares: 0, currency_code: 'EUR', note: 'Top-up' },
      { account_id: eurAcc.id, date: '2022-12-15', type: 'INTEREST',  amount: 1200,    shares: 0, currency_code: 'EUR', note: 'Annual interest' },
      { account_id: eurAcc.id, date: '2023-01-05', type: 'BUY',       amount: 524100,  shares: 0, currency_code: 'EUR', note: 'Bought BASF', security_id: byTicker['BAS']?.id },
      { account_id: eurAcc.id, date: '2023-08-10', type: 'DIVIDENDS', amount: 8800,    shares: 0, currency_code: 'EUR', note: 'BASF dividend', security_id: byTicker['BAS']?.id },
      { account_id: usdAcc.id, date: '2022-01-05', type: 'DEPOSIT',   amount: 1500000, shares: 0, currency_code: 'USD', note: 'Initial deposit' },
      { account_id: usdAcc.id, date: '2022-07-01', type: 'DEPOSIT',   amount: 500000,  shares: 0, currency_code: 'USD', note: 'Top-up' },
      { account_id: usdAcc.id, date: '2023-01-10', type: 'BUY',       amount: 749340,  shares: 0, currency_code: 'USD', note: 'Bought Apple', security_id: byTicker['AAPL']?.id },
      { account_id: usdAcc.id, date: '2023-03-15', type: 'BUY',       amount: 451050,  shares: 0, currency_code: 'USD', note: 'Bought VWRL', security_id: byTicker['VWRL']?.id },
      { account_id: usdAcc.id, date: '2023-11-02', type: 'DIVIDENDS', amount: 12300,   shares: 0, currency_code: 'USD', note: 'VWRL dividend', security_id: byTicker['VWRL']?.id },
    ])
    if (accTxErr) throw new Error(`Account transactions: ${accTxErr.message}`)

    // 6. Portfolio transactions (NO user_id — owned via portfolio_id FK)
    const { error: portTxErr } = await supabase.from('portfolio_transactions').insert([
      { portfolio_id: eurPort.id, date: '2023-01-05', type: 'BUY',  security_id: byTicker['BAS']?.id,  shares: 1000000000, amount: 524100, currency_code: 'EUR', note: 'Buy 10 BASF @ €51.02' },
      { portfolio_id: usdPort.id, date: '2023-01-10', type: 'BUY',  security_id: byTicker['AAPL']?.id, shares: 600000000,  amount: 749340, currency_code: 'USD', note: 'Buy 6 AAPL @ $124.89' },
      { portfolio_id: usdPort.id, date: '2023-03-15', type: 'BUY',  security_id: byTicker['VWRL']?.id, shares: 500000000,  amount: 451050, currency_code: 'USD', note: 'Buy 5 VWRL @ $90.21' },
      { portfolio_id: usdPort.id, date: '2023-09-20', type: 'SELL', security_id: byTicker['AAPL']?.id, shares: 100000000,  amount: 170120, currency_code: 'USD', note: 'Sell 1 AAPL @ $170.12' },
    ])
    if (portTxErr) throw new Error(`Portfolio transactions: ${portTxErr.message}`)

    return NextResponse.json({
      success: true,
      inserted: { securities: securities!.length, accounts: accounts!.length, portfolios: portfolios!.length },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
