# Phase 1 Research — Infrastructure & Data Foundation

## Summary
Phase 1 is entirely about fixing broken foundations — no new user-facing features. The work falls into 4 buckets: database migrations, TypeScript types cleanup, Edge Function verification, and loading states. The scope is clear and well-bounded; all tasks are mechanical but critical.

---

## Bucket 1: Database Migrations (009 + 010)

### Migration 009 — `asset_class` on portfolios
**File:** `supabase/migrations/009_asset_classes.sql`

What it does:
- `ALTER TABLE portfolios ADD COLUMN asset_class TEXT NOT NULL DEFAULT 'EQUITY'`
- Tags existing portfolios by name (Stocks → EQUITY, Commodities → COMMODITY, etc.)
- Adds optional columns to `portfolio_transactions`: `unit_type`, `face_value`, `coupon_rate`, `maturity_date`, `interest_frequency`, `area`

**How to apply:** Run in Supabase SQL Editor (Dashboard → SQL Editor → paste & run)

**Risk:** `NOT NULL DEFAULT 'EQUITY'` is safe — existing rows get EQUITY. No data loss.

### Migration 010 — `classification_id` on portfolios
**File:** `supabase/migrations/010_portfolio_segments.sql`

What it does:
- `ALTER TABLE portfolios ADD COLUMN classification_id UUID REFERENCES classifications(id)`
- Creates index

**Risk:** Depends on `classifications` table existing. Need to check if this table was created in an earlier migration. If not, this migration will fail with a FK error. Must verify first.

**Action required before applying 010:** Run `SELECT * FROM information_schema.tables WHERE table_name = 'classifications';` in Supabase SQL Editor to confirm table exists.

---

## Bucket 2: TypeScript Types Cleanup

### Problem
After applying migration 009, the Supabase-generated TypeScript types in `node_modules` will be stale. Currently the code uses:
```ts
const portfolios = (portfoliosRaw as unknown as Portfolio[]) ?? []
```
This is a workaround for the missing `asset_class` column.

### Fix approach
1. Generate updated types: `npx supabase gen types typescript --project-id gspnjzckdlkhidlivrzk > lib/supabase/database.types.ts`
2. Update all `unknown` casts in: `app/(app)/portfolios/page.tsx`, `app/(app)/holdings/page.tsx`, `app/(app)/page.tsx`

**Alternative (simpler):** Define local interfaces that include `asset_class` and use those instead of generated types. This avoids the supabase CLI dependency.

---

## Bucket 3: Edge Function Verification

### 4 Edge Functions
| Function | Endpoint | Status |
|---|---|---|
| `gains` | `GET /functions/v1/gains` | Exists, needs smoke test |
| `personal-index` | `GET /functions/v1/personal-index` | Exists, needs smoke test |
| `import-trades` | `POST /functions/v1/import-trades` | Exists, needs smoke test |
| `price-search` | `GET /functions/v1/price-search` | Exists, needs smoke test |

### Smoke test approach
Use `curl` with the Supabase anon key to hit each function endpoint and verify it returns a valid JSON response (even if empty array for new users).

### Deployment
If Edge Functions are not deployed, deploy via Supabase CLI:
```bash
npx supabase functions deploy gains --project-ref gspnjzckdlkhidlivrzk
npx supabase functions deploy personal-index --project-ref gspnjzckdlkhidlivrzk
npx supabase functions deploy import-trades --project-ref gspnjzckdlkhidlivrzk
npx supabase functions deploy price-search --project-ref gspnjzckdlkhidlivrzk
```

---

## Bucket 4: Loading States

### Current problem  
Server component pages (Dashboard, Holdings, Portfolios, Gains) render fully server-side then hydrate. On slow connections = blank page flash.

### Fix: Next.js `loading.tsx` files
Next.js App Router convention: a `loading.tsx` file in the same directory as `page.tsx` is automatically used as the Suspense boundary.

**Pages needing loading.tsx:**
- `app/(app)/` (Dashboard)
- `app/(app)/portfolios/`
- `app/(app)/holdings/`
- `app/(app)/transactions/`
- `app/(app)/gains/`
- `app/(app)/plans/`

**Skeleton pattern:** Render grey pulse-animated placeholder divs matching the layout shape.

---

## Bucket 5: SecuritySearchInput — Live Query

### Current state
`SecuritySearchInput.tsx` imports `NSE_STOCKS` from `lib/indian-stocks.ts` — a **hardcoded 14 KB static array** of ~5,000 symbols.

### Problem
- New NSE listings not reflected
- Delistings not reflected  
- Loads 14 KB of JS on every page that uses the component

### Fix
Replace static array with a live query to `price_history` table via the existing `price-search` Edge Function:
- `GET /functions/v1/price-search?q=reliance` → returns matching symbols from `price_history`
- Add debounce (300ms) on input change
- Show loading spinner while fetching
- Cache results client-side for session duration

**Fallback:** If Edge Function is unavailable, fall back to static list.

---

## Implementation Order (within phase)

```
Wave 1 (parallel, no dependencies):
  - Apply migration 009 + verify
  - Smoke test Edge Functions

Wave 2 (depends on 009 applied):
  - Apply migration 010 (needs classifications table check)
  - Remove unknown casts / clean up TypeScript

Wave 3 (independent, frontend):
  - Add loading.tsx skeleton screens
  - Update SecuritySearchInput to use live price-search
```

## RESEARCH COMPLETE
