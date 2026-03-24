'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Section {
  id: string
  icon: string
  title: string
  content: React.ReactNode
}

const sections: Section[] = [
  {
    id: 'overview',
    icon: '🗺️',
    title: 'System Overview',
    content: (
      <div>
        <p>Apna Stocks is a comprehensive personal investment portfolio tracker. It lets you record, organise, and analyse every type of investment you hold — across equities, commodities, fixed income instruments, and real estate.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          {[
            { icon: '📈', label: 'Equities', desc: 'Stocks, ETFs, Mutual Funds' },
            { icon: '🥇', label: 'Commodities', desc: 'Gold, Silver, Oil, more' },
            { icon: '🏦', label: 'Fixed Income', desc: 'FDs, PPF, Bonds, NSC' },
            { icon: '🏠', label: 'Real Estate', desc: 'Property, Land, REITs' },
          ].map(c => (
            <div key={c.label} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '1.4rem' }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>{c.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: '🏠',
    title: 'Dashboard',
    content: (
      <div>
        <p>The dashboard is your home base — a real-time snapshot of your financial position.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', color: 'var(--color-text-muted)' }}>Widget</th>
              <th style={{ padding: '6px 8px', color: 'var(--color-text-muted)' }}>What it shows</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Total Portfolio Value', 'Sum of current market value across all asset classes'],
              ['P&L (Unrealised)', 'Current value minus total cost basis'],
              ['TTWROR', 'Time-weighted total return — how well you invested, independent of timing'],
              ['Asset Class Breakdown', 'Distribution of value across your holding buckets'],
              ['Recent Transactions', 'Last 10 trades across all portfolios'],
            ].map(([w, d]) => (
              <tr key={w as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{w}</td>
                <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'asset-classes',
    icon: '📊',
    title: 'Asset Classes',
    content: (
      <div>
        <p>Asset classes (previously called &quot;Portfolios&quot;) are the top-level buckets for your investments. Each one has a specific investment type that determines how trades are recorded.</p>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Creating an Asset Class</h4>
        <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>Go to <strong>Asset Classes</strong> in the sidebar → <strong>+ New Asset Class</strong></li>
          <li>Choose the investment type (Equity, Commodity, Fixed Income, Real Estate)</li>
          <li>Optionally link it to a <strong>Segment</strong> for grouping in analysis views</li>
          <li>Set a reference account (optional — debited/credited on each trade)</li>
        </ol>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Transaction Types by Asset Class</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-elevated)' }}>
              {['Asset Class', 'Available Transaction Types'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['📈 Equity', 'Buy · Sell · Dividend · Bonus Shares · Stock Split · Delivery In · Transfer'],
              ['🥇 Commodity', 'Buy · Sell · Coupon/Interest (SGBs) · Maturity'],
              ['🏦 Fixed Income', 'Purchase · Maturity/Redemption · Interest Received · Premature Withdrawal · Reinvest'],
              ['🏠 Real Estate', 'Purchase · Sale · Rental Income · Capital Expense · Mortgage Payment'],
            ].map(([ac, types]) => (
              <tr key={ac as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ac}</td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{types}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'securities',
    icon: '🔍',
    title: 'Securities',
    content: (
      <div>
        <p>Securities are the individual instruments you hold — stocks, ETFs, bonds, gold funds, property records, etc. They live in a master list shared across all your asset classes.</p>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Key Fields</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <tbody>
            {[
              ['Ticker Symbol', 'Used to auto-fetch live prices from Yahoo Finance'],
              ['ISIN / WKN', 'International identifiers for cross-border securities'],
              ['Feed', 'Price data source: YAHOO, MANUAL, or a custom URL'],
              ['Currency', 'The currency the security trades in'],
              ['Events', 'Dividends, stock splits, bonus issues — affect performance calculations'],
              ['Prices', 'Historical price series — used for TTWROR and P&L'],
            ].map(([f, d]) => (
              <tr key={f as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap', width: '35%' }}>{f}</td>
                <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Individual Security Page</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Performance strip: 1M / 3M / 6M / 1Y / 5Y returns</li>
          <li><strong>↑ Buy</strong> and <strong>↓ Sell</strong> shortcuts — pre-fill the trade form</li>
          <li>Full transaction history for that security</li>
          <li>Price history chart and events timeline</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'transactions',
    icon: '💸',
    title: 'Recording Transactions',
    content: (
      <div>
        <p>Each asset class has its own tailored trade form. Open an asset class and click <strong>+ New Trade</strong>.</p>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Equity Trades</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Search for a stock by name or ticker — new securities are auto-created</li>
          <li>Enter shares × price per share → total is computed live</li>
          <li>For <strong>Dividends</strong>: enter the total received amount (no shares needed)</li>
          <li>For <strong>Splits</strong>: enter the new post-split share count</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Commodity Trades</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Select a preset (Physical Gold, SGB, Silver, Oil…) or enter a custom name</li>
          <li>Choose unit type: Grams / Troy oz / Barrels / Kilograms / Lots</li>
          <li>Optionally set a maturity date (important for SGBs)</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Fixed Income Trades</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Select instrument type (FD, PPF, NSC, Bond, G-Sec, EPF, SSY…) + issuer name</li>
          <li>Enter <strong>Principal / Face Value</strong> — not shares × price</li>
          <li>Set <strong>Coupon Rate (%)</strong> and <strong>Interest Frequency</strong></li>
          <li>System computes expected periodic payout live</li>
          <li>Set Maturity Date for bonds and FDs</li>
          <li>For <strong>Interest Received</strong>: just enter the interest amount</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Real Estate Transactions</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Name the property + select type (Apartment, Villa, Plot, Commercial…)</li>
          <li>Record <strong>Purchase</strong>, <strong>Sale</strong>, <strong>Rental Income</strong>, <strong>CapEx</strong>, or <strong>Mortgage Payment</strong></li>
          <li>For purchases: enter stamp duty separately — recorded as a Fee</li>
          <li>Enter built-up area (sqft) → ₹/sqft is calculated automatically</li>
        </ul>

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: '0.85rem' }}>
          <strong>💡 Quick tip:</strong> On any security detail page, click <strong>↑ Buy</strong> or <strong>↓ Sell</strong> to open the trade form with that security and type pre-selected.
        </div>
      </div>
    ),
  },
  {
    id: 'holdings',
    icon: '🗂️',
    title: 'All Holdings',
    content: (
      <div>
        <p>The <strong>All Holdings</strong> page consolidates positions from every active asset class into a single view. It shows:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem', marginTop: 8 }}>
          <li><strong>Shares / Units</strong> — total position size</li>
          <li><strong>Avg Cost</strong> — average cost per share (based on all BUY transactions)</li>
          <li><strong>Invested</strong> — total cost basis</li>
          <li><strong>Market Value</strong> — current value using latest price</li>
          <li><strong>Gain / Loss</strong> — unrealised P&amp;L in base currency</li>
          <li><strong>Return %</strong> — percentage gain on invested capital</li>
        </ul>
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Click any security name to go to its detail page. The grid supports sorting by any column.</p>
      </div>
    ),
  },
  {
    id: 'gains',
    icon: '💰',
    title: 'Gains & P&L',
    content: (
      <div>
        <p>The Gains &amp; P&amp;L page computes realised and unrealised profit/loss across all your portfolios.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: 12 }}>
          <tbody>
            {[
              ['Realised Gain', 'Profit locked in on sold positions: (sell price – avg buy price) × units sold'],
              ['Unrealised Gain', 'Paper profit on open positions: (current price – avg buy price) × units held'],
              ['Total Return', 'Realised + unrealised combined'],
              ['TTWROR', 'Time-Weighted Rate of Return — eliminates the distortion of deposit/withdrawal timing'],
            ].map(([t, d]) => (
              <tr key={t as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, width: '35%', whiteSpace: 'nowrap' }}>{t}</td>
                <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: '0.82rem' }}>
          <strong>💡 Note on scaling:</strong> Amounts are stored internally as integers (×100 scale, e.g. ₹1 = 100). The UI always divides by 100 before display. If you see unusual numbers, ensure prices are set correctly in the security&apos;s price history.
        </div>
      </div>
    ),
  },
  {
    id: 'watchlists',
    icon: '👁️',
    title: 'Watchlists & Alerts',
    content: (
      <div>
        <p>Watchlists let you track securities you&apos;re interested in without owning them. Each security card can have an <strong>alert</strong> attached.</p>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Alert Types</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <tbody>
            {[
              ['Price Above', 'Triggers when the security&apos;s latest price exceeds your target'],
              ['Price Below', 'Triggers when the price drops below your floor'],
              ['% Change', 'Triggers when the price moves by ±X% from baseline'],
            ].map(([t, d]) => (
              <tr key={t as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: 600, width: '35%' }}>{t}</td>
                <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, fontSize: '0.85rem' }}>Set an alert by clicking the <strong>🔔 + Alert</strong> button on any watchlist card. Active alerts are shown with an amber badge.</p>
      </div>
    ),
  },
  {
    id: 'segments',
    icon: '🗃️',
    title: 'Segments (Taxonomies)',
    content: (
      <div>
        <p>Segments let you classify and group your holdings using custom hierarchical dimensions.</p>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Common Segment Taxonomies</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li><strong>Asset Type</strong> — Equity, Debt, Alternate, Cash</li>
          <li><strong>Geography</strong> — India, USA, Europe, Emerging Markets</li>
          <li><strong>Market Cap</strong> — Large Cap, Mid Cap, Small Cap</li>
          <li><strong>Sector</strong> — IT, BFSI, Pharma, Energy, Consumer</li>
          <li><strong>Risk Profile</strong> — Conservative, Moderate, Aggressive</li>
        </ul>

        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>How to use</h4>
        <ol style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Go to <strong>Segments</strong> in the Analysis section</li>
          <li>Click <strong>+ New Segment</strong> → give it a name (e.g. &quot;Geography&quot;)</li>
          <li>Open the segment → add classification nodes (e.g. India, USA, Global)</li>
          <li>When creating an Asset Class, pick a segment to link it</li>
          <li>Assign securities to classifications inside each segment node</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'accounts',
    icon: '🏛️',
    title: 'Accounts',
    content: (
      <div>
        <p>Accounts represent your cash accounts — brokerage accounts, savings accounts, or wallets that fund your investments.</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem', marginTop: 8 }}>
          <li>Create one account per brokerage (e.g. Zerodha, HDFC Securities, Groww)</li>
          <li>Link an account to an Asset Class as its <strong>Reference Account</strong></li>
          <li>Account transactions (deposits, withdrawals, fees) are tracked separately</li>
          <li>Balance is used to compute your overall net worth including cash</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'import',
    icon: '📥',
    title: 'Import',
    content: (
      <div>
        <p>The Import hub lets you bulk-upload historical transactions from broker exports or spreadsheets.</p>
        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Supported Formats</h4>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>CSV files following the Portfolio Performance XML/CSV standard</li>
          <li>Generic CSV with columns: date, ticker, type, shares, price, currency</li>
        </ul>
        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Process</h4>
        <ol style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: '0.85rem' }}>
          <li>Select the target asset class</li>
          <li>Upload your CSV</li>
          <li>Review the preview — securities are matched by ticker or created</li>
          <li>Confirm to bulk-insert all transactions</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'prices',
    icon: '📡',
    title: 'Price Feeds',
    content: (
      <div>
        <p>Prices power your portfolio valuation. Apna Stocks fetches prices automatically for Yahoo Finance-listed securities.</p>
        <h4 style={{ marginTop: 16, marginBottom: 8, fontWeight: 700 }}>Feed Types</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <tbody>
            {[
              ['YAHOO', 'Auto-fetched from Yahoo Finance using the ticker symbol (e.g. RELIANCE.NS, GOLDBEES.NS)'],
              ['MANUAL', 'You enter prices manually via the security\'s "Prices" page — ideal for FDs, property, physical gold'],
              ['Custom URL', 'Advanced — point to any JSON/CSV price API endpoint'],
            ].map(([t, d]) => (
              <tr key={t as string} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: 600, width: '25%', whiteSpace: 'nowrap' }}>{t}</td>
                <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: '0.82rem' }}>
          <strong>💡 NSE/BSE tickers:</strong> Use the Yahoo Finance format — append <code>.NS</code> for NSE (e.g. <code>TCS.NS</code>) or <code>.BO</code> for BSE.
        </div>
      </div>
    ),
  },
  {
    id: 'tips',
    icon: '⚡',
    title: 'Tips & Tricks',
    content: (
      <div>
        <ul style={{ paddingLeft: 0, listStyle: 'none', lineHeight: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { e: '🔗', t: 'Deep-link to Buy/Sell', d: 'From any security detail page, click ↑ Buy or ↓ Sell — the form opens pre-filled with that security and type.' },
            { e: '📐', t: 'Segment first, then create', d: 'Create your Segment taxonomy (Geography, Sector…) before creating Asset Classes — you can link them during creation.' },
            { e: '🏦', t: 'Fixed Income: use maturity dates', d: 'Always enter the maturity date for FDs and bonds — future reports will use this to show upcoming maturities.' },
            { e: '🥇', t: 'Physical gold in grams', d: 'Use the Commodities asset class. Select "Grams" as the unit. Record 24K and 22K separately using the Note field.' },
            { e: '🏠', t: 'Property: record all costs', d: 'Record purchase price + stamp duty/registration as separate entries. This gives accurate cost basis for ROI calculation.' },
            { e: '📊', t: 'Dark / Light mode', d: 'Your theme preference (set in the top-right corner) is honoured on every page. All grids and cards follow the system theme.' },
            { e: '🔄', t: 'Price refresh', d: 'After recording a BUY, prices are auto-refreshed in the background. Manually refresh at any time from the security\'s Prices page.' },
          ].map(tip => (
            <li key={tip.t} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', display: 'flex', gap: 12 }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{tip.e}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2 }}>{tip.t}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{tip.d}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
]

export default function HelpPage() {
  const [active, setActive] = useState('overview')
  const current = sections.find(s => s.id === active)!

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%' }}>
      {/* TOC sidebar */}
      <nav style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        padding: '20px 0',
        position: 'sticky', top: 0,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        background: 'var(--color-bg-elevated)',
      }}>
        <div style={{ padding: '0 14px 12px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
          Help Centre
        </div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 14px', border: 'none', background: active === s.id ? 'var(--color-accent-glow)' : 'transparent',
              color: active === s.id ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
              fontWeight: active === s.id ? 600 : 400,
              fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left',
              borderLeft: active === s.id ? '2px solid var(--color-accent-light)' : '2px solid transparent',
              transition: 'all 0.12s',
            }}>
            <span>{s.icon}</span>
            <span>{s.title}</span>
          </button>
        ))}
        <div style={{ padding: '20px 14px 0', borderTop: '1px solid var(--color-border)', marginTop: 8 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Can&apos;t find something?{' '}
            <Link href="mailto:support@apnastocks.com" style={{ color: 'var(--color-accent-light)' }}>Contact support</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: '2.2rem' }}>{current.icon}</span>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{current.title}</h1>
        </div>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          {current.content}
        </div>

        {/* Prev / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--color-border)' }}>
          {sections.findIndex(s => s.id === active) > 0 ? (
            <button onClick={() => setActive(sections[sections.findIndex(s => s.id === active) - 1].id)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
              ← {sections[sections.findIndex(s => s.id === active) - 1].title}
            </button>
          ) : <span />}
          {sections.findIndex(s => s.id === active) < sections.length - 1 ? (
            <button onClick={() => setActive(sections[sections.findIndex(s => s.id === active) + 1].id)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-input)', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
              {sections[sections.findIndex(s => s.id === active) + 1].title} →
            </button>
          ) : <span />}
        </div>
      </main>
    </div>
  )
}
