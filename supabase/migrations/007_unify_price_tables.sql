-- ============================================================
-- 007_unify_price_tables.sql
--
-- Merges nse_market_data INTO price_history.
-- Both tables store NSE OHLCV data — different periods, same shape.
-- price_history (Kaggle, Jan2021-Jan2026) uses: open, high, low, close, volume
-- nse_market_data (Bhavcopy nightly) uses: open_price, high_price, low_price, close_price, prev_close, name, isin, index_priority
--
-- Strategy:
--   1. Add the extra columns from nse_market_data to price_history
--   2. Upsert nse_market_data rows into price_history (renaming columns)
--   3. Drop nse_market_data
-- ============================================================

-- 1. Add new columns to price_history
ALTER TABLE price_history
  ADD COLUMN IF NOT EXISTS prev_close     NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS name           TEXT,
  ADD COLUMN IF NOT EXISTS isin           TEXT,
  ADD COLUMN IF NOT EXISTS index_priority SMALLINT;

-- 2. Add index for index_priority-based market ordering
CREATE INDEX IF NOT EXISTS price_history_priority_idx
  ON price_history (date DESC, index_priority NULLS LAST, symbol);

-- 3. Migrate all nse_market_data rows into price_history
--    Use ON CONFLICT to merge (bhavcopy data wins for overlapping dates since it's official)
INSERT INTO price_history
  (symbol, date, open, high, low, close, volume, prev_close, index_priority)
SELECT
  n.symbol,
  n.date,
  n.open_price,
  n.high_price,
  n.low_price,
  n.close_price,
  n.volume,
  n.prev_close,
  n.index_priority
FROM nse_market_data n
ON CONFLICT (symbol, date) DO UPDATE SET
  open           = EXCLUDED.open,
  high           = EXCLUDED.high,
  low            = EXCLUDED.low,
  close          = EXCLUDED.close,
  volume         = COALESCE(EXCLUDED.volume, price_history.volume),
  prev_close     = EXCLUDED.prev_close,
  index_priority = COALESCE(EXCLUDED.index_priority, price_history.index_priority);

-- 4. Backfill prev_close for Kaggle rows that don't have it yet
--    (set it from the previous day's close within price_history itself)
UPDATE price_history ph
SET prev_close = (
  SELECT close
  FROM   price_history ph2
  WHERE  ph2.symbol = ph.symbol
    AND  ph2.date   < ph.date
  ORDER  BY ph2.date DESC
  LIMIT  1
)
WHERE ph.prev_close IS NULL;

-- 5. Drop old table (and its indexes/policies cascade automatically)
DROP TABLE IF EXISTS nse_market_data;
