# TESTING.md — Test Structure & Practices

## Current State
**No automated tests exist in this codebase.**

There are no test files, no testing framework installed, and no test scripts in `package.json`. The application relies entirely on:
- Manual verification via the dev server (`npm run dev`)
- TypeScript type checking (`npx tsc --noEmit`) as a basic correctness check
- Visual review in the browser after each change

## What Is Testable
The codebase has a clear separation that makes future testing straightforward:

### Pure Functions (ideal for unit tests)
`lib/performance.ts` — all functions are pure (no I/O, no DB):
- `buildHoldings(txns)` — deterministic from transaction log
- `enrichHoldings(holdings, priceMap)` — deterministic from price map
- `calcTTWROR(subPeriods)` — mathematical
- `calcIRR(cashFlows)` — Newton-Raphson numerical method
- `annualise(rate, days)` — simple math

`lib/format.ts` — pure formatting functions:
- `formatAmount(value, currency)` — deterministic
- `formatDate(dateStr)` — deterministic
- `formatPercent(value)` — deterministic

`lib/assetClasses.ts` — static constants (no testing needed)

### Integration Test Candidates
- API Route Handlers in `app/api/` — can be tested with `fetch()` + mock Supabase
- Edge Functions in `supabase/functions/` — Deno test runner compatible

### E2E Test Candidates
- Onboarding wizard flow (`/onboard`)
- Trade entry (per asset class form)
- Import CSV flow

## Recommended Testing Setup (not yet implemented)
```bash
# Unit tests for lib/performance.ts and lib/format.ts
npm install --save-dev vitest @vitest/coverage-v8

# E2E tests
npm install --save-dev @playwright/test
```

## TypeScript as Lightweight Safety Net
The primary correctness tool in use is TypeScript:
```bash
npx tsc --noEmit   # run before every commit
```
All recent changes have been validated with zero TS errors.

## CI
No CI pipeline is configured in this repository.
The GitHub Actions workflows in the repo relate to NSE price data fetching (external data pipeline), not application testing.
