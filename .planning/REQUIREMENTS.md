# REQUIREMENTS.md — Apna Stocks v1.0

## Milestone 1 Goal
**Web + mobile app that is feature-complete for Indian retail investors** — a user can sign up, add all their investments across every asset class, and see accurate net worth + returns in one place. 

---

## Tier 1 — Must Ship (blocks v1)

### Infrastructure Fixes
- [ ] **REQ-01** Apply migration 009 (`asset_class` on portfolios) in production Supabase
- [ ] **REQ-02** Apply migration 010 (portfolio segments) in production Supabase  
- [ ] **REQ-03** Regenerate Supabase TypeScript types and remove all `unknown` casts
- [ ] **REQ-04** Deploy and smoke-test all 4 Edge Functions (`gains`, `personal-index`, `import-trades`, `price-search`)

### Security Search Flow
- [ ] **REQ-05** "Search NSE → auto-create security record → proceed to trade" — single seamless flow when recording a new trade for a security not yet in the user's list

### Asset Class Correctness
- [ ] **REQ-06** Mutual Funds: NAV-based pricing (AMFI daily NAV feed or BSE MF API); units not shares; folio number field
- [ ] **REQ-07** Fixed Deposits: principal + interest rate + start date + maturity date model; auto-compute current value and projected maturity value
- [ ] **REQ-08** Real Estate + physical Gold: "Manual valuation" field — user sets current value directly rather than requiring a market price

### Core Missing Features
- [ ] **REQ-09** Price alerts: UI to set price targets per watchlist security; notify when target hit (in-app)
- [ ] **REQ-10** Benchmark comparison: Nifty 50 vs personal portfolio return, shown prominently on Dashboard or Gains
- [ ] **REQ-11** Segments: create custom cross-asset groups (e.g. "Retirement bucket", "Emergency fund")
- [ ] **REQ-12** Account ↔ Trade linking: optionally deduct trade amount from linked cash account automatically

---

## Tier 2 — Should Ship (high value, not blockers)

- [ ] **REQ-13** Live NSE security search replacing static `lib/indian-stocks.ts` (14 KB hardcoded list)
- [ ] **REQ-14** Portfolio performance loading states (`loading.tsx` for server-rendered pages)
- [ ] **REQ-15** XIRR / CAGR per holding shown in Holdings + Gains views
- [ ] **REQ-16** Currency support for foreign holdings (USD stocks via GIFT City / international funds)
- [ ] **REQ-17** Multi-broker view: tag a portfolio/account to a broker (Zerodha, Groww, HDFC Sec, etc.)

---

## Tier 3 — Mobile (Flutter)

- [ ] **REQ-18** Flutter app scaffold with Supabase auth integration
- [ ] **REQ-19** Dashboard screen: hero net worth, asset class strip, recent trades
- [ ] **REQ-20** Holdings screen: grouped by asset class, expandable
- [ ] **REQ-21** Gains screen: calling `gains` Edge Function
- [ ] **REQ-22** Transaction entry: per-asset-class trade forms matching web
- [ ] **REQ-23** Market screen: NSE price search + watchlist
- [ ] **REQ-24** Biometric authentication (FaceID / fingerprint)
- [ ] **REQ-25** Offline-capable holdings view (cached last-known state)

---

## Out of Scope for v1

| Item | Reason |
|---|---|
| Tax calculation (STCG/LTCG) | Not a trading platform |
| Broker API / order routing | Read-only tracker only |
| Realtime streaming prices | EOD sufficient for portfolio tracking |
| Crypto tracking | Not priority for Indian retail v1 |
| Social / sharing features | Not in v1 |
| Self-hosted deployment | Vercel + Supabase only |
