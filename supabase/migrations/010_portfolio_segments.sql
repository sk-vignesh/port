-- ============================================================
-- 010_portfolio_segments.sql
--
-- Allows a portfolio (asset class) to be linked to a
-- taxonomy classification (segment) for grouping/filtering.
-- ============================================================

ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS classification_id UUID REFERENCES classifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolios_classification ON portfolios(classification_id);
