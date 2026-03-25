-- Migration 011: Mutual Fund Support
-- Adds folio_number to portfolio_transactions for MF folios
-- and amfi_scheme_code to securities for daily NAV fetch

-- Add folio_number to portfolio_transactions
ALTER TABLE portfolio_transactions
  ADD COLUMN IF NOT EXISTS folio_number TEXT;

-- Add amfi_scheme_code to securities (for daily NAV automatic fetch)
ALTER TABLE securities
  ADD COLUMN IF NOT EXISTS amfi_scheme_code TEXT;

-- Index for NAV fetching by scheme code
CREATE INDEX IF NOT EXISTS idx_securities_amfi_scheme_code
  ON securities (amfi_scheme_code)
  WHERE amfi_scheme_code IS NOT NULL;

COMMENT ON COLUMN portfolio_transactions.folio_number    IS 'Mutual fund folio number, e.g. 12345678/12';
COMMENT ON COLUMN securities.amfi_scheme_code            IS 'AMFI scheme code for NAV fetch via api.mfapi.in, e.g. 120503';
