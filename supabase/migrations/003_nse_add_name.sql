-- Add company name to nse_market_data
ALTER TABLE nse_market_data ADD COLUMN IF NOT EXISTS name TEXT;
