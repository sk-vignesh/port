# CONCERNS.md — Technical Debt & Known Issues

## 🔴 High Priority

### 1. Pending Database Migrations Not Applied
**Files**: `supabase/migrations/009_asset_classes.sql`, `010_portfolio_segments.sql`
**Impact**: The `asset_class` column on `portfolios` is referenced throughout the app (Holdings grouping, Asset Class cards, Dashboard strip) but the migration hasn't been run in production Supabase. All portfolios currently fall back to `EQUITY` rendering, and segment grouping is unavailable.
**Fix**: User must run migrations in Supabase SQL editor.

### 2. No Tests
**Impact**: No automated validation — regressions can only be caught by manual browser testing. The math-heavy `lib/performance.ts` (TTWROR, IRR) has never been unit-tested.
**Fix**: Add Vitest for `lib/performance.ts` unit tests as first priority.

### 3. TypeScript Strict Mode Off + `unknown` Casting
**Files**: `app/(app)/portfolios/page.tsx`, `app/(app)/holdings/page.tsx`, `app/(app)/page.tsx`
**Pattern**: `(portfoliosRaw as unknown as Portfolio[] | null)` — used to escape Supabase generated type mismatch for `asset_class` column added in migration 009.
**Fix**: Run migration 009, regenerate Supabase types (`supabase gen types`), remove casts.

---

## 🟡 Medium Priority

### 4. Duplicate `buildHoldings` Logic
**Files**: `lib/performance.ts` vs `supabase/functions/_shared/performance.ts`
**Issue**: The core `buildHoldings` algorithm is duplicated — one for Next.js (TypeScript), one for Edge Functions (Deno/TypeScript). Any algorithm fix must be applied in both places.
**Fix**: Consider sharing via a published package or a pre-build sync script.

### 5. Leftover Debug / Scratch Files at Root
**Files**: `b.txt`, `build_err.txt`, `build_err2.txt`, `build_err3.txt`, `build_out.txt`, `apply-consolidation.cjs`, `apply-consolidation.mjs`, `import-prices.mjs`, `migrate-prices.mjs`, `probe-connection.mjs`, `run-migration.mjs`
**Issue**: Root directory contains debugging artifacts and one-off migration scripts that should not be in version control.
**Fix**: Delete or move to `scripts/` and add to `.gitignore`.

### 6. Market Watchlist Button — Partial Implementation
**File**: `app/(app)/market/MarketGrid.tsx` (`WatchlistCellRenderer`)
**Issue**: The ⭐ Watch button requires the security to already exist in the `securities` table with a matching `ticker_symbol`. NSE market data rows in `price_history` are not automatically linked to user `securities` records — most users will see `—` (error state) when clicking Watch.
**Fix**: Auto-create a `securities` record if missing, or query by `ticker_symbol` from `price_history.symbol` match.

### 7. No Empty State for Holdings / Gains When Migration Not Applied
**Impact**: If migration 009 hasn't run, `asset_class` is null — the Holdings page groups everything under `EQUITY` even if it's a commodity portfolio. Misleading for the user.

---

## 🟢 Low Priority / Nice to Have

### 8. No Loading States on Server Components
Server component pages (Dashboard, Holdings, Portfolios) render fully on the server then stream — no skeleton/loading UI. This means users see a blank page flash during hydration on slow connections.
**Fix**: Add `loading.tsx` files alongside each page.

### 9. Security Search is Pre-seeded List (Not Live)
**File**: `lib/indian-stocks.ts` (14 KB static list)
**Issue**: The NSE ticker autocomplete in `SecuritySearchInput.tsx` uses a hardcoded list of ~5,000 symbols. New listings or delistings won't be reflected without a manual file update.
**Fix**: Replace with a live query to `price_history` (already used by `price-search` Edge Function).

### 10. No Error Boundary or 404 Page
If a page or API route throws an unexpected error, Next.js shows the generic framework error page. No custom error boundary or `error.tsx` pages are implemented.

### 11. Accounts Not Linked to Holdings
`accounts` (cash accounts) and `portfolios` (investment portfolios) are tracked separately. There's no automatic way to link a trade's cash consideration to an account balance reduction — the user must enter account transactions manually.

### 12. Edge Function `personal-index` Not Surfaced in UI
**File**: `supabase/functions/personal-index/`
The personal portfolio index (benchmark comparison) Edge Function exists but is only used in `MyIndexChart.tsx`. It's not prominently featured or explained to users.

### 13. Plans Page Estimated Invested is Approximate
**File**: `app/(app)/plans/page.tsx`
The "~Invested" figure is calculated as `monthsElapsed × payPerMonth` — a rough approximation assuming every month is equal. It doesn't account for actual transaction records or skipped payments.
