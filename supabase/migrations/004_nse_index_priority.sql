-- Add index priority column for smart market ordering
-- 1 = Nifty 50, 2 = Bank Nifty, 3 = Nifty IT, NULL = all others
ALTER TABLE nse_market_data ADD COLUMN IF NOT EXISTS index_priority SMALLINT;
CREATE INDEX IF NOT EXISTS idx_nse_market_data_priority ON nse_market_data (date DESC, index_priority NULLS LAST, symbol);
