# STACK.md — Technology Stack

## Languages & Runtime
- **TypeScript** (strict mode) — primary language for all application code
- **Node.js** — runtime for Next.js server and edge functions
- **SQL** (PostgreSQL dialect) — Supabase migrations and RPC functions

## Framework
- **Next.js 14** (`^14.2.29`) — App Router, server components, route handlers
  - `app/(app)/` — authenticated app routes with shared layout
  - `app/api/` — API route handlers (REST endpoints)
  - `app/auth/` — authentication pages (login, callback, etc.)
  - Middleware-based session refresh: `middleware.ts`
- **React 18** (`^18.3.1`) — UI rendering, client components

## Styling
- **Vanilla CSS** — `app/globals.css` (19 KB) — full custom design system
  - CSS custom properties for theming (dark/light mode via `data-theme` attribute)
  - Utility classes: `.card`, `.btn`, `.badge`, `.page-header`, `.metric-card`, `.table`, `.grid-2`, etc.
  - No Tailwind used at runtime (installed as devDep but not applied)

## Data Grid
- **AG Grid Community** (`ag-grid-community@^35.1.0`, `ag-grid-react@^35.1.0`)
  - Custom theme via `lib/agGridTheme.ts`
  - Used across: Holdings, Transactions, Gains, Market, Watchlist, Reports grids

## Charts
- **Recharts** (`^3.8.0`) — used in `DashboardCharts.tsx` and `MyIndexChart.tsx`
  - Area charts, bar charts, pie/doughnut charts

## Backend / BaaS
- **Supabase** (`@supabase/supabase-js@^2.45.4`, `@supabase/ssr@^0.5.2`)
  - PostgreSQL database (hosted)
  - Row Level Security (RLS) — all tables secured by `auth.uid()`
  - Auth: email/password
  - Edge Functions (Deno runtime): gains, personal-index, import-trades, price-search
  - Storage: not used
  - Realtime: not used

## Utilities
- **date-fns** (`^4.1.0`) — date formatting and arithmetic
- **lucide-react** (`^0.577.0`) — icon set used in Sidebar navigation
- **xlsx** (`^0.18.5`) — Excel export from AG Grid (Market page)

## Dev Tooling
- **TypeScript** (`^5`) — `tsconfig.json` with strict: false, path alias `@/` → root
- **ESLint** (`^9`) — `eslint-config-next` 16.2.1
- **Vercel** — deployment target (`vercel.json`)

## Configuration
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `next.config.mjs` — minimal (outputFileTracingRoot only)
- `tsconfig.json` — path alias `@/*` maps to project root

## Key npm Scripts
```bash
npm run dev    # next dev (local development)
npm run build  # next build
npm run start  # next start (production)
npm run lint   # eslint
```
