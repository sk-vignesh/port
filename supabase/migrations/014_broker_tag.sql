-- Migration 014: Broker tagging — display-only broker_name label on portfolios and accounts
-- No FK enforcement — free text (e.g. "Zerodha", "Groww", "HDFC Securities", "SBI")

ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS broker_name TEXT;
ALTER TABLE accounts   ADD COLUMN IF NOT EXISTS broker_name TEXT;

COMMENT ON COLUMN portfolios.broker_name IS 'Display label for brokerage platform (e.g. Zerodha, Groww, Kite, ICICIDirect)';
COMMENT ON COLUMN accounts.broker_name   IS 'Display label for brokerage or bank account provider';
