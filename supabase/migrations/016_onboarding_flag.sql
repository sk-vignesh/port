-- Migration 016: Add onboarding_completed flag to user_settings
-- Controls whether the new-user onboarding modal is shown.
-- Default false — existing users will see it once then it's set to true.
-- Set to true immediately for users who already have portfolio data (backfill below).

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_settings.onboarding_completed IS 'True once user has completed the onboarding wizard (or dismissed it after adding first data)';

-- Backfill: mark existing users who already have portfolio transactions as complete
UPDATE user_settings
SET onboarding_completed = true
WHERE user_id IN (
  SELECT DISTINCT p.user_id
  FROM portfolios p
  INNER JOIN portfolio_transactions pt ON pt.portfolio_id = p.id
);
