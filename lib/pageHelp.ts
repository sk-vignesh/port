/**
 * lib/pageHelp.ts — Central config for per-page help drawer content.
 * Import this in PageHelp component and look up content by pageId.
 */

export interface HelpSection {
  heading: string
  text:    string
}

export interface PageHelpContent {
  title:   string
  content: HelpSection[]
}

export const PAGE_HELP: Record<string, PageHelpContent> = {

  dashboard: {
    title: 'Dashboard Guide',
    content: [
      {
        heading: '📊 Portfolio Value',
        text: 'The total current market value of all your holdings across every asset class — updated with the latest available price data.',
      },
      {
        heading: '🏆 Best / Worst Performer',
        text: 'The security with the highest and lowest unrealised gain % based on your purchase price vs current price. Only shown when you have at least 2 priced holdings.',
      },
      {
        heading: '📈 XIRR',
        text: 'Extended Internal Rate of Return — your true annualised return accounting for exactly when you invested each rupee. Unlike simple % return, XIRR correctly handles SIPs and multiple purchases at different times.',
      },
      {
        heading: '🗂 Asset Classes',
        text: 'A breakdown of your portfolio by asset class (Equities, Mutual Funds, Gold, FDs, Real Estate). Click any row to go to that portfolio.',
      },
      {
        heading: '⚡ Quick Trade',
        text: 'The floating button at the bottom-right lets you record a buy or sell from any page without navigating away.',
      },
    ],
  },

  gains: {
    title: 'Gains & P&L Guide',
    content: [
      {
        heading: '📉 Unrealised Gain',
        text: 'Profit or loss on positions you still hold. Formula: (current price × units) − (average cost × units). Negative means the investment is in the red.',
      },
      {
        heading: '✅ Realised Gain',
        text: 'Profit or loss you have already locked in by selling. This counts toward your actual capital gains tax liability.',
      },
      {
        heading: '📊 XIRR',
        text: 'Annualised return from your actual investment dates. Two investments with the same % gain but different holding periods will have very different XIRRs.',
      },
      {
        heading: '📐 CAGR',
        text: 'Compound Annual Growth Rate — how fast your investment has grown per year since your first purchase of that security.',
      },
      {
        heading: '🔍 Search / Sort',
        text: 'Use the search box to filter by stock name or ticker. Click any column header to sort — click again to reverse.',
      },
    ],
  },

  holdings: {
    title: 'All Holdings Guide',
    content: [
      {
        heading: '📋 What is this page?',
        text: 'A consolidated view of every security you own across all portfolios — stocks, mutual funds, gold, and everything else in one sortable table.',
      },
      {
        heading: '💰 Avg Cost',
        text: 'The weighted average price you paid per unit, calculated from all your buy transactions (accounting for partial sells).',
      },
      {
        heading: '📍 CMP',
        text: 'Current Market Price — the latest price we have for this security. For NSE stocks this comes from NSE price history data.',
      },
    ],
  },

  portfolio_detail: {
    title: 'Portfolio Guide',
    content: [
      {
        heading: '📈 Performance Panel',
        text: 'Shows your personal index chart — how the value of this portfolio has changed over time compared to what you invested.',
      },
      {
        heading: '🛒 Buy / Sell',
        text: 'Record a new trade for any security. The search box will find NSE-listed stocks by name or symbol and auto-create the security record if it doesn\'t exist yet.',
      },
      {
        heading: '🏷 Broker Badge',
        text: 'Set the broker for this portfolio (Zerodha, Groww, etc.) in Edit → Broker/Platform. Shows as a purple badge in the header.',
      },
      {
        heading: '📑 FD / Property Cards',
        text: 'Fixed Income portfolios show FD summary cards with accrued value and days to maturity. Real Estate portfolios show property cards with capital gain and rental yield.',
      },
    ],
  },

  watchlists: {
    title: 'Watchlist Guide',
    content: [
      {
        heading: '⭐ What is a Watchlist?',
        text: 'A curated list of securities you want to monitor — useful for tracking stocks you are researching before committing capital.',
      },
      {
        heading: '🔔 Price Alerts',
        text: 'Click "+ Alert" on any security card to set a target: "Price rises above ₹2,500" or "Price falls below ₹1,800". When the condition is met, the Watchlists icon in the sidebar shows a red count badge.',
      },
      {
        heading: '🔴 Badge in Sidebar',
        text: 'The red number on the Watchlists sidebar link shows how many of your alerts have been triggered. Click through to review.',
      },
    ],
  },

  transactions: {
    title: 'Transactions Guide',
    content: [
      {
        heading: '📝 Trade Types',
        text: 'BUY adds to your holding and increases your cost basis. SELL reduces your holding and crystallises a gain or loss. TRANSFER IN/OUT moves holdings between portfolios without a cash impact.',
      },
      {
        heading: '📅 Date matters',
        text: 'The trade date affects your XIRR and holding period calculations (LTCG vs STCG tax treatment). Always use the actual trade date, not today.',
      },
    ],
  },

  taxonomies: {
    title: 'Segments Guide',
    content: [
      {
        heading: '🗂 What are Segments?',
        text: 'A way to tag your securities by sector (Technology, Banking, Healthcare) or market cap (Large Cap, Mid Cap, Small Cap). Used in allocation breakdown charts.',
      },
      {
        heading: '🏷 How to tag',
        text: 'Go to any security\'s detail page → Edit → assign a segment. Once tagged, securities will appear grouped in segment-based allocation views.',
      },
    ],
  },

  reports: {
    title: 'Reports Guide',
    content: [
      {
        heading: '📋 What reports are available?',
        text: 'Capital Gains Report (for tax filing), Portfolio Allocation, Asset Class breakdown, and SIP performance summary.',
      },
    ],
  },

  market: {
    title: 'Market Data Guide',
    content: [
      {
        heading: '📡 Price data source',
        text: 'NSE price history synced daily via the NSE Bhav Copy. Data covers all NSE-listed equities and ETFs.',
      },
    ],
  },

}
