# STRUCTURE.md — Directory Layout & Key Locations

## Root
```
portfolio-web/
├── app/                   # Next.js App Router
│   ├── (app)/             # Authenticated app shell (shared layout: Sidebar + TopBar + FAB)
│   │   ├── layout.tsx     # App shell: Sidebar, TopBar, QuickTradeButton
│   │   ├── page.tsx       # Dashboard / home (hero metric + asset class strip)
│   │   ├── gains/         # P&L analysis page (client, fetches Edge Function)
│   │   ├── holdings/      # All holdings grouped by asset class
│   │   │   ├── page.tsx           # Server: data fetching + grouping
│   │   │   └── HoldingsClient.tsx # Client: collapsible groups
│   │   ├── import/        # CSV trade import
│   │   ├── market/        # NSE live market data (AG Grid)
│   │   │   ├── page.tsx       # Server: preload first 500 rows
│   │   │   └── MarketGrid.tsx # Client: AG Grid with virtual page loading
│   │   ├── onboard/       # 3-step onboarding wizard (new users)
│   │   ├── plans/         # SIP plan management with progress bars
│   │   ├── portfolios/    # Asset class list + per-portfolio detail
│   │   │   ├── page.tsx       # Asset class cards with live stats
│   │   │   ├── [id]/          # Portfolio detail + trade entry
│   │   │   └── new/           # Create new portfolio
│   │   ├── reports/       # P&L reports export
│   │   ├── securities/    # Security management (CRUD)
│   │   ├── segments/      # Portfolio segment definitions
│   │   ├── settings/      # User settings (base currency, etc.)
│   │   ├── transactions/  # Trade log with Trades/Cash tabs
│   │   │   ├── page.tsx              # Server: data fetch
│   │   │   └── TransactionsClient.tsx # Client: tab switcher
│   │   └── watchlists/    # Watchlist management
│   ├── api/               # API Route Handlers (mutations + complex reads)
│   │   ├── accounts/
│   │   ├── gains/         # Legacy gains computation (pre-edge-function)
│   │   ├── import/
│   │   ├── market-data/
│   │   ├── portfolios/    # route.ts — POST to create portfolio (used by onboarding)
│   │   ├── securities/
│   │   ├── seed-sample-data/
│   │   ├── sip-plans/
│   │   └── watchlists/
│   ├── auth/              # Login, signup, callback pages
│   ├── globals.css        # Full design system (19 KB, vanilla CSS)
│   └── layout.tsx         # Root layout: ThemeProvider, font preload
├── components/            # Shared React components
│   ├── AppGrid.tsx            # Base AG Grid wrapper
│   ├── DashboardCharts.tsx    # Recharts charts for dashboard
│   ├── MyIndexChart.tsx       # Personal portfolio index chart
│   ├── QuickTradeButton.tsx   # Floating action button (global)
│   ├── SampleDataBanner.tsx   # Load sample data prompt for empty state
│   ├── SecLink.tsx            # Security name link component
│   ├── SecuritySearchInput.tsx # NSE ticker autocomplete
│   ├── Sidebar.tsx            # Main navigation (4 groups)
│   ├── Tooltip.tsx            # Hover tooltip (? badge style)
│   ├── TopBar.tsx             # Top navigation bar with theme toggle
│   ├── WatchlistCards.tsx     # Watchlist security cards
│   ├── grids/                 # AG Grid instances per data type
│   │   ├── HoldingsGrid.tsx
│   │   ├── PortfolioTransactionsGrid.tsx
│   │   ├── AccountTransactionsGrid.tsx
│   │   ├── TransactionsGrid.tsx
│   │   ├── ReportsGrids.tsx
│   │   └── WatchlistGrid.tsx
│   └── trade-forms/           # Asset-class-specific trade entry forms
│       ├── EquityTradeForm.tsx
│       ├── CommodityTradeForm.tsx
│       ├── FixedIncomeTradeForm.tsx
│       └── RealEstateTradeForm.tsx
├── lib/                   # Shared utilities and business logic
│   ├── assetClasses.ts    # Icons, labels, list for 4 asset classes (single source of truth)
│   ├── agGridTheme.ts     # AG Grid custom dark/light theme config
│   ├── format.ts          # Currency, number, date formatters
│   ├── indian-stocks.ts   # NSE stock symbols/names reference list
│   ├── performance.ts     # Core math engine (TTWROR, IRR, holdings, gains)
│   └── supabase/          # Supabase client factories (server vs browser)
│       ├── client.ts      # Browser client (createBrowserClient)
│       └── server.ts      # Server client (createServerClient, cookie-based)
├── supabase/
│   ├── migrations/        # 14 SQL migration files (numbered)
│   └── functions/         # Deno Edge Functions
│       ├── _shared/       # Shared: cors.ts, performance.ts
│       ├── gains/
│       ├── personal-index/
│       ├── import-trades/
│       └── price-search/
├── middleware.ts           # Auth session refresh + redirect guard
├── next.config.mjs
├── tsconfig.json          # path alias: @/ → ./
└── vercel.json
```

## Naming Conventions
- Pages: `page.tsx` (Next.js convention)
- Client interactivity files: `[Feature]Client.tsx` (e.g. `HoldingsClient.tsx`)
- Grid files: `[DataType]Grid.tsx`
- Trade forms: `[AssetClass]TradeForm.tsx`
- Lib utilities: camelCase (e.g. `performance.ts`, `format.ts`)
- CSS classes: kebab-case utility classes (e.g. `metric-card`, `flex-between`)

## Key Config Files
| File | Purpose |
|---|---|
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `tsconfig.json` | `@/` path alias, `strict: false` |
| `next.config.mjs` | outputFileTracingRoot only |
| `vercel.json` | `{ "framework": "nextjs" }` |
| `supabase/config.toml` | Local Supabase dev config |
