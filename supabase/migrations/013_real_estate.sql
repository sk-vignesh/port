-- Migration 013: Real Estate — area column + portfolio_transaction_units table
-- RealEstateTradeForm already writes to these; this migration unblocks it.

-- Add area column to portfolio_transactions (sq ft for real estate)
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS area INTEGER;

COMMENT ON COLUMN portfolio_transactions.area
  IS 'Built-up/carpet area in square feet (used for real estate transactions)';

-- Create portfolio_transaction_units for fees, stamp duty, brokerage, taxes
CREATE TABLE IF NOT EXISTS portfolio_transaction_units (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES portfolio_transactions(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL,               -- FEE | TAX | BROKERAGE | INTEREST | DIVIDEND
  amount         BIGINT      NOT NULL,               -- × 100 (same BigInt encoding as amount)
  currency_code  TEXT        NOT NULL DEFAULT 'INR',
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ptu_transaction_id
  ON portfolio_transaction_units (transaction_id);

COMMENT ON TABLE  portfolio_transaction_units
  IS 'Fee, tax, stamp duty, and sub-component breakdown for a portfolio transaction.';
COMMENT ON COLUMN portfolio_transaction_units.type
  IS 'Unit type: FEE (stamp duty / registration), TAX, BROKERAGE, INTEREST, DIVIDEND';
