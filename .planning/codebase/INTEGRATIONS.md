# INTEGRATIONS.md — External Services & APIs

## Supabase (Primary Backend)
- **URL**: `NEXT_PUBLIC_SUPABASE_URL` (env var)
- **Auth**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (env var)
- **Client libs**: `@supabase/supabase-js` (browser) and `@supabase/ssr` (server-side SSR cookies)
- **Auth method**: Email/password via Supabase Auth
- **Session**: Cookie-based, refreshed in `middleware.ts` on every request
- **RLS**: All tables have Row Level Security — scoped to `auth.uid()`
- **Edge Functions** (Deno, deployed to Supabase):
  | Function | Path | Purpose |
  |---|---|---|
  | `gains` | `supabase/functions/gains/index.ts` | Computes unrealised + realised P&L per security |
  | `personal-index` | `supabase/functions/personal-index/` | TTWROR performance index calculation |
  | `import-trades` | `supabase/functions/import-trades/` | CSV trade import processing |
  | `price-search` | `supabase/functions/price-search/` | Security name/ticker search endpoint |
- **Shared Edge Function code**: `supabase/functions/_shared/` (CORS helpers, performance math)

## NSE Market Data (via `price_history` table)
- **Source**: NSE India (National Stock Exchange) End-of-Day price data
- **Table**: `price_history` — symbol, date, open, high, low, close, prev_close, volume, name, index_priority
- **Fetch mechanism**: GitHub Actions workflow (external, not in this repo) fetches NSE EOD prices and inserts into `price_history`
- **Consumed by**: Market page (AG Grid), Security search, Holdings valuation

## Vercel (Hosting / CDN)
- **Platform**: Vercel (Next.js-native deployment)
- **Config**: `vercel.json` (minimal — just `{ "framework": "nextjs" }`)
- **Environment vars**: Set in Vercel dashboard (mirrors `.env.local`)

## GitHub Actions (Data Pipeline)
- **Purpose**: Automated NSE EOD price fetch — runs nightly
- **Repo**: External repository (not this codebase)
- **Result**: Populates `price_history` table in Supabase

## No Other External APIs
The application does **not** integrate:
- No payment gateway
- No SMS/push notifications
- No third-party analytics
- No email service (beyond Supabase Auth emails)
- No CDN for images beyond Next.js built-in optimization

## Data Storage (Supabase Tables)
| Table | Purpose |
|---|---|
| `user_settings` | Base currency preference per user |
| `securities` | User-defined securities (stocks, ETFs, etc.) |
| `security_prices` | Per-security price history (user-uploaded or feed-based) |
| `security_latest_prices` | Snapshot of latest price per security |
| `accounts` | Cash/brokerage accounts |
| `account_transactions` | Deposits, withdrawals, interest |
| `portfolios` | Asset class buckets (Equity, Commodity, etc.) |
| `portfolio_transactions` | Trades: BUY, SELL, DIVIDEND, etc. |
| `watchlists` | Named watchlists per user |
| `watchlist_securities` | Securities within each watchlist |
| `sip_plans` | Systematic Investment Plan schedules |
| `price_history` | NSE EOD market data (shared, not user-scoped) |
| `segments` | Portfolio segmentation / grouping |
| `api_health` | Health check log for external data pipelines |
