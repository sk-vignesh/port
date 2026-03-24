-- ============================================================
-- 009_asset_classes.sql
--
-- Adds asset class awareness to portfolios and extends
-- portfolio_transactions with asset-class-specific metadata.
-- ============================================================

-- 1. Add asset_class to portfolios
ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'EQUITY';

-- 2. Tag the 4 default portfolios by name (for existing users)
UPDATE portfolios SET asset_class = 'EQUITY'       WHERE name = 'Stocks';
UPDATE portfolios SET asset_class = 'COMMODITY'    WHERE name = 'Commodities';
UPDATE portfolios SET asset_class = 'FIXED_INCOME' WHERE name = 'Fixed Income';
UPDATE portfolios SET asset_class = 'REAL_ESTATE'  WHERE name = 'Real Estate';

-- 3. Extend portfolio_transactions with optional asset-class metadata
--    All columns nullable — only populated by the relevant asset class form

-- unit_type: what the "shares" column counts (SHARES, GRAMS, TROY_OZ, UNITS, SQFT, SQMT)
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'SHARES';

-- face_value: Fixed Income — bond/FD face value × 100 (e.g. ₹1,000 face = 100000)
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS face_value BIGINT;

-- coupon_rate: Fixed Income — annual coupon rate (e.g. 7.50 = 7.5%)
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS coupon_rate NUMERIC(8, 4);

-- maturity_date: Fixed Income / Commodities (SGBs) — when the instrument matures
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS maturity_date DATE;

-- interest_frequency: Fixed Income — how often interest is paid
-- Values: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, AT_MATURITY
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS interest_frequency TEXT;

-- area: Real Estate — size in sqft or sqm (stored as integer)
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS area INTEGER;

-- 4. Backfill unit_type for all existing transactions
UPDATE portfolio_transactions SET unit_type = 'SHARES' WHERE unit_type IS NULL;
