# Apna Stocks

## What This Is

Apna Stocks is a portfolio management platform for Indian retail investors who lack a good tool to track their investments across multiple asset classes in one place. Users can record and monitor Equity (stocks, ETFs), Fixed Income (FDs, Bonds, PPF), Commodities (Gold, Silver), and Real Estate positions alongside NSE live market data, SIP plans, and watchlists. The platform is being built as a web app first, with a Flutter mobile app to follow leveraging the same Supabase backend.

## Core Value

**An Indian investor can see their complete, accurate net worth and returns — across every asset class — in one place, at a glance.**

## Requirements

### Validated

- ✓ User authentication (email/password via Supabase) — existing
- ✓ 4 asset class portfolios (Equity, Commodity, Fixed Income, Real Estate) with dedicated trade forms — existing
- ✓ Holdings view grouped by asset class with current value and gain/loss — existing
- ✓ Gains & P&L page with unrealised + realised split — existing
- ✓ Transaction log with Trades / Cash tab split — existing
- ✓ NSE End-of-Day market data feed via `price_history` table — existing
- ✓ Watchlist management — existing
- ✓ SIP plan tracking — existing
- ✓ CSV trade import — existing
- ✓ 3-step onboarding wizard for new users — existing
- ✓ Global Quick Trade floating action button — existing
- ✓ Contextual tooltips for financial jargon (CMP, Unrealised Gain, etc.) — existing
- ✓ Dark/light theme with full CSS design system — existing
- ✓ Supabase Edge Functions for gains computation (API-first, mobile-ready) — existing

### Active

**Infrastructure (must fix before anything else)**
- [ ] Apply migration 009 (asset_class column on portfolios) — currently falling back silently
- [ ] Apply migration 010 (portfolio segments) — segments feature broken
- [ ] Regenerate Supabase TypeScript types post-migration (remove `unknown` casts)
- [ ] Deploy and verify Edge Functions (gains, personal-index, import-trades, price-search)
- [ ] Smart security search: NSE autocomplete "search → auto-create security → record trade" flow

**Asset Class Correctness**
- [ ] Mutual Funds: NAV-based valuation (not exchange price); connect to NAV data source (AMFI/BSE MF)
- [ ] Fixed Deposits: principal + interest rate + maturity date modelling (not buy/sell price)
- [ ] Real Estate & Physical Gold: manual "current value" override field for non-market-priced assets

**Core UX gaps**
- [ ] Price alerts UI (schema exists in `008_watch_alerts.sql`, no frontend)
- [ ] Portfolio benchmark comparison (Nifty 50 vs personal portfolio) — prominently visible
- [ ] Segments page: group hold positions across portfolios into custom views (e.g., "Retirement", "Short-term")
- [ ] Account ↔ Trade linking: deduct cash from linked account when a trade is recorded
- [ ] Performance: replace hardcoded `lib/indian-stocks.ts` list with live `price_history` query

**Mobile (Flutter)**
- [ ] Flutter app using Supabase Edge Function API (same backend as web)
- [ ] All core screens: Dashboard, Holdings, Gains, Transactions, Trade entry, Market, Watchlist
- [ ] Biometric auth + offline-capable holdings view

### Out of Scope

- Tax calculation (STCG/LTCG) — not a trading platform, tax is out of scope for v1
- Payment gateway / brokerage integration — read-only portfolio tracker, not a broker
- Realtime streaming prices — EOD NSE data is sufficient for portfolio tracking
- Social features (sharing portfolios, leaderboards) — not in v1
- Crypto tracking — not a priority for Indian retail investor v1 focus

## Context

- **Target users:** Indian retail investors, non-technical, typically invested across NSE equities, FDs, Gold, and Mutual Funds via multiple brokers/banks
- **Existing tools gap:** INDmoney/Kuvera/Smallcase are either broker-locked, overly complex, or push products. This app is neutral and self-hosted.
- **Tech stack:** Next.js 14 App Router + Supabase (DB, Auth, Edge Functions) + AG Grid + Recharts. Flutter app planned using same Supabase backend.
- **Codebase state:** Significant UX redesign completed (hero dashboard, asset class grouping, onboarding wizard, FAB). Two migrations (009, 010) unapplied in production — blocking several features.
- **Data:** NSE EOD prices fetched nightly via GitHub Actions into `price_history`. No MF NAV or commodity price feed yet.
- **Planning docs:** `.planning/codebase/` contains full codebase map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS).

## Constraints

- **Tech Stack:** Next.js + Supabase — established, cannot change mid-project
- **Mobile:** Flutter — decided before this milestone; web API must be Edge-Function-first for mobile compatibility
- **Data Sources:** Indian market data only (NSE/BSE/AMFI) — must be free or very low cost
- **Deployment:** Vercel (web) + Supabase (backend) — no self-managed servers
- **No Broker API:** Read-only tracker, no SEBI compliance requirements, no order routing

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Supabase Edge Functions as primary API layer | Mobile app needs same endpoints as web — no separate server | — Pending validation |
| 4 asset class portfolios as top-level objects | Each asset class has different transaction parameters | ✓ Good |
| NSE EOD data via GitHub Actions → price_history | Free, no API keys, sufficient for portfolio valuation | ✓ Good |
| Vanilla CSS over Tailwind | Maximum control over dark/light theme design system | ✓ Good |
| UX-first redesign before feature expansion | App was developer-centric, needed investor-centric UX before growing features | ✓ Good |
| Equity-first, expand to MF/FD properly later | MF/FD require different data models — don't fake it with stock model | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after initialization*
