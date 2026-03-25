# ARCHITECTURE.md — System Architecture

## Pattern
**Full-stack Next.js App Router** with Supabase as the backend. Follows a **thin API / thick client** pattern:
- Server Components fetch data directly from Supabase (no intermediate API layer for reads)
- Client Components handle interactivity (tabs, grids, forms, charts)
- API Route Handlers (`app/api/`) handle writes and complex mutations
- Supabase Edge Functions serve as a secondary compute tier (complex calculations, mobile-ready endpoints)

## Layers

```
┌─────────────────────────────────────────────────────┐
│  Browser (React Client Components)                  │
│  - AG Grid tables, Recharts charts, forms           │
│  - State: useState/useCallback (no global store)    │
├─────────────────────────────────────────────────────┤
│  Next.js Server Components + Route Handlers         │
│  - Data fetching: Supabase server client            │
│  - Business logic: lib/performance.ts               │
│  - Auth guard: middleware.ts + layout-level check   │
├─────────────────────────────────────────────────────┤
│  Supabase                                           │
│  - PostgreSQL + RLS (auth.uid() scoping)            │
│  - Edge Functions (Deno) — gains, personal-index    │
│  - Auth (email/password, JWT cookies)               │
└─────────────────────────────────────────────────────┘
```

## Authentication Flow
1. `middleware.ts` — refreshes Supabase session on every request, redirects unauthenticated users to `/auth/login`
2. `app/(app)/layout.tsx` — secondary guard: server-side `auth.getUser()` check, redirect if no user
3. All pages call `supabase.auth.getUser()` at the server component level (no trust in client-passed tokens)

## Data Flow (typical read path)
```
Server Component
  └─ createClient() [lib/supabase/server.ts]
  └─ supabase.from('table').select(...)  ← RLS enforces user scope
  └─ lib/performance.ts (buildHoldings, enrichHoldings, calcTTWROR)
  └─ Render JSX + pass data to Client Component
```

## Performance Math Engine (`lib/performance.ts`)
Core algorithms — all pure functions, no side effects:
- **`buildHoldings(txns)`** — computes current share positions from transaction log (avg-cost method)
- **`enrichHoldings(holdings, priceMap)`** — attaches latest prices, computes gain/gainPct
- **`calcTTWROR(subPeriods)`** — True Time-Weighted Rate of Return (chain-linked)
- **`calcIRR(cashFlows)`** — Internal Rate of Return / money-weighted return (Newton-Raphson)
- **`annualise(rate, days)`** — annualises a return over a date range
- All monetary values: **BIGINT × 100** (e.g., ₹1 = 100)
- All share quantities: **BIGINT × 100,000,000** (1 share = 100_000_000)

## Asset Class Architecture
4 asset classes, each with a dedicated trade form:
| Asset Class | Key | Trade Form |
|---|---|---|
| Stocks & ETFs | `EQUITY` | `components/trade-forms/EquityTradeForm.tsx` |
| Commodities | `COMMODITY` | `components/trade-forms/CommodityTradeForm.tsx` |
| Fixed Income | `FIXED_INCOME` | `components/trade-forms/FixedIncomeTradeForm.tsx` |
| Real Estate | `REAL_ESTATE` | `components/trade-forms/RealEstateTradeForm.tsx` |

Shared metadata: `lib/assetClasses.ts` (icons, labels, list)

## Client/Server Split Pattern
Pages are split into server page + client component when interactivity is needed:
- `app/(app)/transactions/page.tsx` → `TransactionsClient.tsx` (tabs)
- `app/(app)/holdings/page.tsx` → `HoldingsClient.tsx` (expand/collapse groups)
- `app/(app)/gains/page.tsx` — all client (fetches via Edge Function)
- `app/(app)/market/page.tsx` → `MarketGrid.tsx` (AG Grid, virtual scroll)

## Key Entry Points
| Route | File | Pattern |
|---|---|---|
| `/` | `app/(app)/page.tsx` | Server component, hero dashboard |
| `/portfolios` | `app/(app)/portfolios/page.tsx` | Server component, asset class cards |
| `/portfolios/[id]` | `app/(app)/portfolios/[id]/page.tsx` | Detail with trade form |
| `/holdings` | `app/(app)/holdings/page.tsx` | Server → HoldingsClient |
| `/transactions` | `app/(app)/transactions/page.tsx` | Server → TransactionsClient |
| `/gains` | `app/(app)/gains/page.tsx` | Client, calls Edge Function |
| `/market` | `app/(app)/market/page.tsx` | Server preload → MarketGrid |
| `/onboard` | `app/(app)/onboard/page.tsx` | Client wizard, 3 steps |
