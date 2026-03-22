-- NSE daily bhav copy — all EQ segment securities
-- Populated nightly by scripts/fetch_nse_prices.py via GitHub Actions
-- Primary lookup: (symbol, date). Most queries filter on date = latest.

CREATE TABLE IF NOT EXISTS nse_market_data (
  symbol       TEXT           NOT NULL,
  date         DATE           NOT NULL,
  open_price   NUMERIC(14, 2),
  high_price   NUMERIC(14, 2),
  low_price    NUMERIC(14, 2),
  close_price  NUMERIC(14, 2) NOT NULL,
  prev_close   NUMERIC(14, 2),
  volume       BIGINT,
  isin         TEXT,
  PRIMARY KEY (symbol, date)
);

-- Fast lookup by date (for "latest date" queries)
CREATE INDEX IF NOT EXISTS idx_nse_market_data_date
  ON nse_market_data (date DESC);

-- Fast lookup by symbol (for individual stock history)
CREATE INDEX IF NOT EXISTS idx_nse_market_data_symbol
  ON nse_market_data (symbol, date DESC);

-- No RLS — this is market reference data (not user-owned).
-- All authenticated users can read; only service-role can write.
ALTER TABLE nse_market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read NSE market data"
  ON nse_market_data FOR SELECT
  TO authenticated
  USING (true);
