# ROADMAP.md — Apna Stocks v1.0

## Milestone 1: Feature-Complete for Indian Retail Investors

**Goal:** Web + mobile app fully usable by a non-technical Indian investor to track all their investments in one accurate, beautiful view.

**Phases:** 8 phases (web) + 2 phases (mobile)

---

## Phase 1 — Infrastructure & Data Foundation
*Fix broken foundations before building anything new*

**Deliverables:**
- Apply migrations 009 + 010 in production Supabase
- Regenerate TypeScript types, remove all `unknown` casts
- Deploy and verify all 4 Edge Functions with smoke tests
- Add `loading.tsx` skeleton screens to all server-rendered pages
- Replace hardcoded `lib/indian-stocks.ts` with live `price_history` query in SecuritySearchInput

**Requirements:** REQ-01, REQ-02, REQ-03, REQ-04, REQ-13, REQ-14

---

## Phase 2 — Smart Security Search & Trade Flow
*Remove the biggest friction point: adding a new security to trade*

**Deliverables:**
- "Search NSE symbol/name → auto-create security record → open trade form" — single flow
- Search results pull from `price_history` (live symbols) + user's existing securities
- Auto-populate security name, currency (`INR`), ticker from search result
- Available from "Quick Trade" button and from portfolio detail page

**Requirements:** REQ-05, REQ-13

---

## Phase 3 — Mutual Fund Support
*India's most popular investment vehicle — done properly, not faked*

**Deliverables:**
- New asset class `MUTUAL_FUND` (or sub-type within EQUITY) with folio number field
- Daily NAV feed integration (AMFI open data API — free)
- MF-specific transaction types: SIP instalment, lump sum purchase, redemption, dividend reinvestment
- Holdings page shows MF units, NAV, current value, and XIRR
- Import: support Kuvera/Groww MF statement CSV format

**Requirements:** REQ-06

---

## Phase 4 — Fixed Deposits & Debt Instruments
*Model FDs correctly — principal, rate, term — not as stock buy/sell*

**Deliverables:**
- FD data model: principal, interest rate (% p.a.), start date, maturity date, compounding frequency, bank name
- Auto-compute: current accrued value, projected maturity value, days to maturity
- FD card view: shows "matures in X days" + accrued interest
- Support: FD, RD, PPF, NSC, NPS (all treated as "time deposit" variants)
- Fixed Income portfolio list shows FDs with live accrued value

**Requirements:** REQ-07

---

## Phase 5 — Manual Valuation & Real Assets
*Real Estate and physical Gold need a different model — user sets the value*

**Deliverables:**
- "Current value" override field per portfolio or per holding for non-market-priced assets
- Real Estate: property name, purchase price, area sq ft, city, current estimated value (user-input), rental yield field
- Commodity: physical Gold/Silver — weight in grams/tolas, purity (22K/24K), purchase date, current price auto-fetched from MCX/IBJA or user-set
- Dashboard and Holdings correctly display manual-valued assets alongside market-priced ones

**Requirements:** REQ-08

---

## Phase 6 — Analytics & Benchmarks
*Help investors understand how they are doing relative to the market*

**Deliverables:**
- Nifty 50 benchmark line on the personal index / dashboard chart
- XIRR / CAGR calculation per holding and per portfolio (visible in Holdings + Gains)
- "Best performer" and "worst performer" callout cards on Dashboard
- Segments page: create named buckets spanning multiple portfolios (e.g. "Retirement", "Kids education")
- Account ↔ Trade linking (optional): deduct from linked cash account on trade entry

**Requirements:** REQ-10, REQ-11, REQ-12, REQ-15

---

## Phase 7 — Alerts, Notifications & Polish
*Price alerts + final UX polish before mobile*

**Deliverables:**
- Price alert UI: set target price per watchlist security (above/below)
- In-app alert badge when target is hit (checked on page load from `watch_alerts` table)
- Multi-broker tagging: label each portfolio/account with broker name (display only)
- Clean up root-level debug files (`b.txt`, `build_err*.txt`, migration scripts)
- Full UAT pass across all pages — browser subagent verification

**Requirements:** REQ-09, REQ-16, REQ-17

---

## Phase 8 — Mobile: Flutter App (Core)
*Web API is ready — build the Flutter app screens*

**Deliverables:**
- Flutter project scaffold with Supabase Flutter SDK auth
- Dashboard screen (hero net worth, asset class strip, recent trades)
- Holdings screen (grouped by asset class, expandable rows)
- Gains screen (calls `gains` Edge Function)
- Transaction log screen (Trades / Cash tabs)

**Requirements:** REQ-18, REQ-19, REQ-20, REQ-21, REQ-22

---

## Phase 9 — Mobile: Trade Entry & Market
*Complete the mobile feature set*

**Deliverables:**
- Trade entry screens per asset class (Equity, MF, FD, Commodity, Real Estate)
- Market screen: NSE price search + add to watchlist
- Watchlist screen: price + change display
- Biometric authentication (FaceID / fingerprint)
- Offline-capable holdings view (cached state)
- App Store / Play Store submission prep

**Requirements:** REQ-23, REQ-24, REQ-25

---

## Phase Ordering Rationale

```
Phase 1 (Infrastructure) → must be first — everything breaks without it
Phase 2 (Security Search) → unblocks smooth trade entry for all subsequent phases
Phase 3 (Mutual Funds) → biggest missing asset class for Indian investors
Phase 4 (Fixed Deposits) → second most important — most Indians have FDs
Phase 5 (Manual Valuation) → completes the asset class coverage
Phase 6 (Analytics) → makes the data meaningful / actionable
Phase 7 (Alerts + Polish) → web app ready for real users
Phase 8 + 9 (Mobile) → web is validated first, mobile follows same patterns
```
