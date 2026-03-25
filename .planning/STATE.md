# STATE.md — Apna Stocks

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-25)

**Core value:** An Indian investor can see their complete, accurate net worth and returns — across every asset class — in one place, at a glance.

**Current focus:** Phase 1 — Infrastructure & Data Foundation

## Current Status

- **Milestone:** 1 — Feature-Complete for Indian Retail Investors
- **Phase:** 1 of 9
- **Phase status:** Not started — ready to plan

## Phase Tracker

| Phase | Name | Status |
|---|---|---|
| 1 | Infrastructure & Data Foundation | ⬜ Not started |
| 2 | Smart Security Search & Trade Flow | ⬜ Not started |
| 3 | Mutual Fund Support | ⬜ Not started |
| 4 | Fixed Deposits & Debt Instruments | ⬜ Not started |
| 5 | Manual Valuation & Real Assets | ⬜ Not started |
| 6 | Analytics & Benchmarks | ⬜ Not started |
| 7 | Alerts, Notifications & Polish | ⬜ Not started |
| 8 | Mobile: Flutter App (Core) | ⬜ Not started |
| 9 | Mobile: Trade Entry & Market | ⬜ Not started |

## Codebase Map

See: `.planning/codebase/` (mapped 2026-03-25)
- `STACK.md` — Next.js 14 + Supabase + AG Grid + Recharts + TypeScript
- `ARCHITECTURE.md` — App Router, server components, Edge Functions, performance math
- `STRUCTURE.md` — Full directory layout
- `CONVENTIONS.md` — TypeScript style, CSS conventions, amount encoding
- `INTEGRATIONS.md` — Supabase, NSE data, Vercel, Edge Functions
- `TESTING.md` — No tests exist; pure functions in `lib/performance.ts` are prime candidates
- `CONCERNS.md` — Critical: migrations 009+010 unapplied, duplicate buildHoldings, debug files at root

## Key Context

- Web app: functional, UX redesigned, but two migrations unapplied break asset class grouping
- All monetary values: BIGINT × 100 (₹1 = 100)
- All share quantities: BIGINT × 100,000,000 (1 share = 100_000_000)
- Flutter app: planned after web is complete, same Supabase backend
- No tests exist — TypeScript is the only safety net

## Next Action

```
/gsd-plan-phase 1
```
