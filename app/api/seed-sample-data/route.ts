import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// Sample data derived from the Portfolio Performance open-source test scenarios
// Original source: name.abuchen.portfolio.tests/src/scenarios/client_performance_snapshot.xml
// Prices are stored scaled by 100,000,000 (shares) and 100 (amounts) per our schema convention

const SAMPLE_SECURITIES = [
  {
    name: 'Apple Inc.',
    currency_code: 'USD',
    isin: 'US0378331005',
    ticker_symbol: 'AAPL',
    wkn: '865985',
    note: 'Sample security — US technology sector',
    is_retired: false,
  },
  {
    name: 'BASF SE',
    currency_code: 'EUR',
    isin: 'DE000BASF111',
    ticker_symbol: 'BAS',
    wkn: 'BASF11',
    note: 'Sample security — German chemicals sector',
    is_retired: false,
  },
  {
    name: 'Vanguard FTSE All-World ETF',
    currency_code: 'USD',
    isin: 'IE00B3RBWM25',
    ticker_symbol: 'VWRL',
    wkn: 'A1JX52',
    note: 'Sample ETF — global diversified index',
    is_retired: false,
  },
]

// Prices scaled by 100 (i.e. $182.52 → 18252)
const SAMPLE_PRICES: Record<string, Array<{ date: string; close_price: number }>> = {
  AAPL: [
    { date: '2023-01-03', close_price: 12489 },
    { date: '2023-02-01', close_price: 14403 },
    { date: '2023-03-01', close_price: 14322 },
    { date: '2023-04-03', close_price: 16635 },
    { date: '2023-05-01', close_price: 16946 },
    { date: '2023-06-01', close_price: 18011 },
    { date: '2023-07-03', close_price: 18933 },
    { date: '2023-08-01', close_price: 17822 },
    { date: '2023-09-01', close_price: 17012 },
    { date: '2023-10-02', close_price: 17493 },
    { date: '2023-11-01', close_price: 18254 },
    { date: '2023-12-01', close_price: 19189 },
  ],
  BAS: [
    { date: '2023-01-03', close_price: 5102 },
    { date: '2023-02-01', close_price: 5263 },
    { date: '2023-03-01', close_price: 4842 },
    { date: '2023-04-03', close_price: 4941 },
    { date: '2023-05-01', close_price: 4345 },
    { date: '2023-06-01', close_price: 4421 },
    { date: '2023-07-03', close_price: 4655 },
    { date: '2023-08-01', close_price: 4389 },
    { date: '2023-09-01', close_price: 4102 },
    { date: '2023-10-02', close_price: 3988 },
    { date: '2023-11-01', close_price: 4277 },
    { date: '2023-12-01', close_price: 4642 },
  ],
  VWRL: [
    { date: '2023-01-03', close_price: 9021 },
    { date: '2023-02-01', close_price: 9388 },
    { date: '2023-03-01', close_price: 9442 },
    { date: '2023-04-03', close_price: 9711 },
    { date: '2023-05-01', close_price: 9588 },
    { date: '2023-06-01', close_price: 9812 },
    { date: '2023-07-03', close_price: 10144 },
    { date: '2023-08-01', close_price: 9933 },
    { date: '2023-09-01', close_price: 9655 },
    { date: '2023-10-02', close_price: 9477 },
    { date: '2023-11-01', close_price: 10122 },
    { date: '2023-12-01', close_price: 10488 },
  ],
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 1. Insert securities
    const { data: securities, error: secErr } = await supabase
      .from('securities')
      .insert(SAMPLE_SECURITIES.map(s => ({ ...s, user_id: user.id })))
      .select()
    if (secErr) throw new Error(`Securities: ${secErr.message}`)

    const secByTicker = Object.fromEntries(securities!.map(s => [s.ticker_symbol, s]))

    // 2. Insert security prices
    const priceRows = []
    for (const [ticker, prices] of Object.entries(SAMPLE_PRICES)) {
      const sec = secByTicker[ticker]
      if (!sec) continue
      for (const p of prices) {
        priceRows.push({ security_id: sec.id, date: p.date, close_price: p.close_price, user_id: user.id })
      }
    }
    if (priceRows.length > 0) {
      const { error: priceErr } = await supabase.from('security_prices').insert(priceRows)
      if (priceErr) throw new Error(`Prices: ${priceErr.message}`)
    }

    // 3. Insert accounts
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .insert([
        { name: 'Cash Account (EUR)', currency_code: 'EUR', note: 'Sample EUR cash account', user_id: user.id },
        { name: 'Cash Account (USD)', currency_code: 'USD', note: 'Sample USD cash account', user_id: user.id },
      ])
      .select()
    if (accErr) throw new Error(`Accounts: ${accErr.message}`)

    const eurAccount = accounts!.find(a => a.currency_code === 'EUR')!
    const usdAccount = accounts!.find(a => a.currency_code === 'USD')!

    // 4. Insert portfolios
    const { data: portfolios, error: portErr } = await supabase
      .from('portfolios')
      .insert([
        { name: 'EUR Securities Portfolio', reference_account_id: eurAccount.id, note: 'Sample portfolio holding BASF', user_id: user.id },
        { name: 'USD Securities Portfolio', reference_account_id: usdAccount.id, note: 'Sample portfolio holding Apple and Vanguard ETF', user_id: user.id },
      ])
      .select()
    if (portErr) throw new Error(`Portfolios: ${portErr.message}`)

    const eurPortfolio = portfolios!.find(p => p.name.startsWith('EUR'))!
    const usdPortfolio = portfolios!.find(p => p.name.startsWith('USD'))!

    // 5. Insert account transactions (amounts stored as integer cents × 100)
    const { error: accTxErr } = await supabase.from('account_transactions').insert([
      // EUR account
      { account_id: eurAccount.id, date: '2022-01-03', type: 'DEPOSIT',   amount: 1000000, currency_code: 'EUR', note: 'Initial deposit', user_id: user.id },
      { account_id: eurAccount.id, date: '2022-06-01', type: 'DEPOSIT',   amount: 500000,  currency_code: 'EUR', note: 'Additional deposit', user_id: user.id },
      { account_id: eurAccount.id, date: '2022-12-15', type: 'INTEREST',  amount: 1200,    currency_code: 'EUR', note: 'Annual interest', user_id: user.id },
      { account_id: eurAccount.id, date: '2023-01-05', type: 'BUY',       amount: 524100,  currency_code: 'EUR', note: 'Bought BASF', security_id: secByTicker['BAS']?.id, user_id: user.id },
      { account_id: eurAccount.id, date: '2023-08-10', type: 'DIVIDENDS', amount: 8800,    currency_code: 'EUR', note: 'BASF dividend', security_id: secByTicker['BAS']?.id, user_id: user.id },
      // USD account
      { account_id: usdAccount.id, date: '2022-01-05', type: 'DEPOSIT',   amount: 1500000, currency_code: 'USD', note: 'Initial USD deposit', user_id: user.id },
      { account_id: usdAccount.id, date: '2022-07-01', type: 'DEPOSIT',   amount: 500000,  currency_code: 'USD', note: 'Additional deposit', user_id: user.id },
      { account_id: usdAccount.id, date: '2023-01-10', type: 'BUY',       amount: 749340,  currency_code: 'USD', note: 'Bought Apple', security_id: secByTicker['AAPL']?.id, user_id: user.id },
      { account_id: usdAccount.id, date: '2023-03-15', type: 'BUY',       amount: 451050,  currency_code: 'USD', note: 'Bought Vanguard ETF', security_id: secByTicker['VWRL']?.id, user_id: user.id },
      { account_id: usdAccount.id, date: '2023-11-02', type: 'DIVIDENDS', amount: 12300,   currency_code: 'USD', note: 'Vanguard ETF dividend', security_id: secByTicker['VWRL']?.id, user_id: user.id },
    ])
    if (accTxErr) throw new Error(`Account transactions: ${accTxErr.message}`)

    // 6. Insert portfolio transactions (shares scaled by 100,000,000)
    const { error: portTxErr } = await supabase.from('portfolio_transactions').insert([
      // EUR portfolio — BASF
      {
        portfolio_id: eurPortfolio.id, date: '2023-01-05', type: 'BUY',
        security_id: secByTicker['BAS']?.id, shares: 1000000000, // 10 shares
        amount: 524100, currency_code: 'EUR',
        note: 'Buy 10 BASF @ €51.02', fees: 1000, taxes: 300,
        user_id: user.id,
      },
      // USD portfolio — Apple
      {
        portfolio_id: usdPortfolio.id, date: '2023-01-10', type: 'BUY',
        security_id: secByTicker['AAPL']?.id, shares: 600000000, // 6 shares
        amount: 749340, currency_code: 'USD',
        note: 'Buy 6 AAPL @ $124.89', fees: 700, taxes: 0,
        user_id: user.id,
      },
      // USD portfolio — VWRL
      {
        portfolio_id: usdPortfolio.id, date: '2023-03-15', type: 'BUY',
        security_id: secByTicker['VWRL']?.id, shares: 500000000, // 5 shares
        amount: 451050, currency_code: 'USD',
        note: 'Buy 5 VWRL @ $90.21', fees: 500, taxes: 0,
        user_id: user.id,
      },
      // Partial Apple sell
      {
        portfolio_id: usdPortfolio.id, date: '2023-09-20', type: 'SELL',
        security_id: secByTicker['AAPL']?.id, shares: 100000000, // 1 share
        amount: 170120, currency_code: 'USD',
        note: 'Sell 1 AAPL @ $170.12', fees: 700, taxes: 2500,
        user_id: user.id,
      },
    ])
    if (portTxErr) throw new Error(`Portfolio transactions: ${portTxErr.message}`)

    return NextResponse.json({
      success: true,
      inserted: {
        securities: securities!.length,
        accounts: accounts!.length,
        portfolios: portfolios!.length,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
