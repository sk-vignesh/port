# Phase 2 Research — Smart Security Search & Trade Flow

## Summary
Phase 2 is about removing the biggest friction point: adding a trade for a security the user hasn't tracked before. Currently the flow is broken into multiple disconnected steps. This phase makes it one smooth action.

---

## Current State Analysis

### price-search Edge Function
**File:** `supabase/functions/price-search/index.ts`

- Proxies Yahoo Finance autocomplete: `GET /functions/v1/price-search?q=<query>`
- Returns: `{ symbol, name, exchange, currency, type }`
- Types supported: EQUITY, ETF, MUTUALFUND, CRYPTOCURRENCY  
- Exchange→currency map: NSE/BSE → INR, LSE → GBP, etc.
- No auth required (public market data only)
- **Already called by the rewritten `SecuritySearchInput`** (Wave 3 of Phase 1)

### SecuritySearchInput (post Phase 1)
- Live search via `price-search` Edge Function ✓
- 300ms debounce, loading state ✓
- Returns `SearchResult { symbol, name, sector? }` to caller

**Gap:** `price-search` returns `exchange` and `currency` which `SecuritySearchInput` doesn't pass through in the `SearchResult` type. Phase 2 needs `currency` to auto-populate the trade form.

### QuickTradeButton (FAB)
**File:** `components/QuickTradeButton.tsx`

Current menu items:
- Buy → `/portfolios?action=buy` ← static link, no search
- Sell → `/portfolios?action=sell` ← static link, no search  
- New Portfolio
- Import CSV

**Problem:** The "Buy" link goes to the portfolios list page — no integrated search flow.

### EquityTradeForm
**File:** `components/trade-forms/EquityTradeForm.tsx`

- Has `SecuritySearchInput` embedded - handles security creation inline (find-or-create pattern)
- Creates security record automatically if not found
- Calls `fetch('/api/prices/refresh?id=...')` after trade saved

**Current entry points to EquityTradeForm:**
- Portfolio detail page → "Add Trade" button → `/portfolios/[id]/transactions/new`
- This requires user to know which portfolio → navigate there → then pick security

**Desired entry point (REQ-05):** Search security first → auto-create record → then pick portfolio → record trade.

### URL for new trade
`/portfolios/[id]/transactions/new` — requires portfolio ID in URL. This means the unified flow must:
1. User searches security (anywhere in the app)
2. User selects security
3. User picks portfolio (asset class)
4. Trade form opens pre-populated with the selected security

---

## Required Changes

### 1. Extend SearchResult type with currency + exchange

`components/SecuritySearchInput.tsx` — add `currency` and `exchange` to `SearchResult`:
```ts
export interface SearchResult {
  symbol:    string
  name:      string
  sector?:   string
  exchange?: string   // ← add
  currency?: string   // ← add (from price-search response)
}
```

The `price-search` function already returns these fields — just need to pass them through.

### 2. UnifiedTradeSearch component
New component: `components/UnifiedTradeSearch.tsx`

A modal/drawer that:
1. Shows `SecuritySearchInput` prominently
2. On select → shows portfolio picker (asset class selector)
3. On portfolio select → navigates to `/portfolios/[portfolio_id]/transactions/new?security_id=...&name=...&currency=...`
4. EquityTradeForm already resolves the security by ID from the URL, or creates it

**Or simpler alternative:** Rather than a 2-step modal, modify the QuickTradeButton FAB to open an inline search overlay. On security selection, the system:
- Calls Supabase to find-or-create the security record
- Redirects to portfolio list with `?security_id=...` pre-filled
- User picks the portfolio (asset class) card
- Portfolio detail page opens the trade form pre-populated

**Decision:** Use a 2-step modal approach — cleaner UX, no page redirects until final step.

### 3. QuickTradeButton rewire
Replace the static "Buy" link with a button that opens `UnifiedTradeSearch` modal.

### 4. Portfolio detail page — "Add Trade" button
The existing `Add Trade` button on portfolio detail already works well. Phase 2 enhances this by:
- Pre-loading the last searched security if coming from the UnifiedTradeSearch
- The URL already supports `?security_id=` param (EquityTradeForm reads `urlSecurityId`)

---

## Wave Structure

```
Wave 1 (independent):
  02-01: Extend SearchResult + update price-search response mapping + UnifiedTradeSearch modal

Wave 2 (depends on 02-01):
  02-02: Rewire QuickTradeButton FAB to use UnifiedTradeSearch
       + Add "Search to Trade" entry on Dashboard hero section
```

## RESEARCH COMPLETE
