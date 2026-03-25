-- Migration 012: Fixed Income / FD columns
-- These columns are written by FixedIncomeTradeForm (already built) but were
-- missing from the database schema, causing all FD inserts to fail silently.

ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS face_value          BIGINT,        -- principal × 100 (e.g. ₹1L = 10000000)
  ADD COLUMN IF NOT EXISTS coupon_rate         NUMERIC(8,4),  -- decimal % p.a., e.g. 7.5000
  ADD COLUMN IF NOT EXISTS interest_frequency  TEXT;          -- MONTHLY|QUARTERLY|SEMI_ANNUAL|ANNUAL|AT_MATURITY

-- maturity_date may not have been added yet
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS maturity_date       DATE;

COMMENT ON COLUMN portfolio_transactions.face_value          IS 'Principal / face value × 100 (BigInt encoded, same scale as amount)';
COMMENT ON COLUMN portfolio_transactions.coupon_rate         IS 'Annual coupon/interest rate as a percentage, e.g. 7.5 = 7.5% p.a.';
COMMENT ON COLUMN portfolio_transactions.interest_frequency  IS 'Payout frequency: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, AT_MATURITY';
COMMENT ON COLUMN portfolio_transactions.maturity_date       IS 'Maturity/expiry date for FD, Bond, NSC, and commodity contracts';
