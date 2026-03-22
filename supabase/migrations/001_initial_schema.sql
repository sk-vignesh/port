-- ============================================================
-- Portfolio Performance Web App - Initial Schema
-- All amounts stored as BIGINT scaled by 100 (1 EUR = 100)
-- Shares stored as BIGINT scaled by 100,000,000 (1 share = 100_000_000)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USER SETTINGS
-- ============================================================
CREATE TABLE user_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_currency  TEXT NOT NULL DEFAULT 'EUR',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own settings" ON user_settings
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SECURITIES
-- ============================================================
CREATE TABLE securities (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  currency_code        TEXT NOT NULL DEFAULT 'EUR',
  target_currency_code TEXT,
  isin                 TEXT,
  ticker_symbol        TEXT,
  wkn                  TEXT,
  note                 TEXT,
  feed                 TEXT,
  feed_url             TEXT,
  latest_feed          TEXT,
  latest_feed_url      TEXT,
  is_retired           BOOLEAN NOT NULL DEFAULT FALSE,
  calendar             TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own securities" ON securities
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_securities_user_id ON securities(user_id);

-- ============================================================
-- SECURITY PRICE HISTORY
-- ============================================================
CREATE TABLE security_prices (
  id          BIGSERIAL PRIMARY KEY,
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  value       BIGINT NOT NULL, -- scaled by 100
  UNIQUE(security_id, date)
);
ALTER TABLE security_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD prices of own securities" ON security_prices
  USING (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()))
  WITH CHECK (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()));
CREATE INDEX idx_security_prices_security_date ON security_prices(security_id, date DESC);

-- ============================================================
-- SECURITY LATEST PRICES
-- ============================================================
CREATE TABLE security_latest_prices (
  security_id     UUID PRIMARY KEY REFERENCES securities(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  value           BIGINT NOT NULL,
  high            BIGINT,
  low             BIGINT,
  volume          BIGINT,
  previous_close  BIGINT
);
ALTER TABLE security_latest_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD latest prices of own securities" ON security_latest_prices
  USING (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()))
  WITH CHECK (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()));

-- ============================================================
-- SECURITY EVENTS (dividends, splits, notes)
-- ============================================================
CREATE TABLE security_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  type        TEXT NOT NULL, -- 'DIVIDEND', 'SPLIT', 'NOTE'
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD events of own securities" ON security_events
  USING (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()))
  WITH CHECK (security_id IN (SELECT id FROM securities WHERE user_id = auth.uid()));
CREATE INDEX idx_security_events_security ON security_events(security_id, date DESC);

-- ============================================================
-- ACCOUNTS (cash/brokerage accounts)
-- ============================================================
CREATE TABLE accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  note          TEXT,
  is_retired    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own accounts" ON accounts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- ============================================================
-- PORTFOLIOS (securities depots)
-- ============================================================
CREATE TABLE portfolios (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  note                 TEXT,
  is_retired           BOOLEAN NOT NULL DEFAULT FALSE,
  reference_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own portfolios" ON portfolios
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);

-- ============================================================
-- ACCOUNT TRANSACTIONS
-- ============================================================
CREATE TABLE account_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- DEPOSIT,REMOVAL,INTEREST,INTEREST_CHARGE,DIVIDENDS,FEES,FEES_REFUND,TAXES,TAX_REFUND,BUY,SELL,TRANSFER_IN,TRANSFER_OUT
  date          TIMESTAMPTZ NOT NULL,
  currency_code TEXT NOT NULL,
  amount        BIGINT NOT NULL, -- scaled by 100
  shares        BIGINT NOT NULL DEFAULT 0, -- scaled by 100_000_000
  security_id   UUID REFERENCES securities(id) ON DELETE SET NULL,
  note          TEXT,
  source        TEXT,
  ex_date       TIMESTAMPTZ,
  -- For cross-entries (buy/sell pair): links to the partner transaction
  cross_portfolio_transaction_id UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own account transactions" ON account_transactions
  USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()));
CREATE INDEX idx_acct_txn_account ON account_transactions(account_id, date DESC);
CREATE INDEX idx_acct_txn_security ON account_transactions(security_id);

-- ============================================================
-- ACCOUNT TRANSACTION UNITS (taxes / fees breakdown)
-- ============================================================
CREATE TABLE account_transaction_units (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id     UUID NOT NULL REFERENCES account_transactions(id) ON DELETE CASCADE,
  type               TEXT NOT NULL, -- GROSS_VALUE, TAX, FEE
  amount             BIGINT NOT NULL,
  currency_code      TEXT NOT NULL,
  forex_amount       BIGINT,
  forex_currency_code TEXT,
  exchange_rate      NUMERIC(20, 10)
);
ALTER TABLE account_transaction_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own acct txn units" ON account_transaction_units
  USING (transaction_id IN (
    SELECT id FROM account_transactions
    WHERE account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  ))
  WITH CHECK (transaction_id IN (
    SELECT id FROM account_transactions
    WHERE account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  ));

-- ============================================================
-- PORTFOLIO TRANSACTIONS (securities depot)
-- ============================================================
CREATE TABLE portfolio_transactions (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id                  UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  type                          TEXT NOT NULL, -- BUY,SELL,TRANSFER_IN,TRANSFER_OUT,DELIVERY_INBOUND,DELIVERY_OUTBOUND
  date                          TIMESTAMPTZ NOT NULL,
  currency_code                 TEXT NOT NULL,
  amount                        BIGINT NOT NULL, -- scaled by 100
  shares                        BIGINT NOT NULL, -- scaled by 100_000_000
  security_id                   UUID NOT NULL REFERENCES securities(id) ON DELETE RESTRICT,
  note                          TEXT,
  source                        TEXT,
  cross_account_transaction_id  UUID REFERENCES account_transactions(id) ON DELETE SET NULL,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own portfolio transactions" ON portfolio_transactions
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE INDEX idx_port_txn_portfolio ON portfolio_transactions(portfolio_id, date DESC);
CREATE INDEX idx_port_txn_security ON portfolio_transactions(security_id);

-- ============================================================
-- PORTFOLIO TRANSACTION UNITS
-- ============================================================
CREATE TABLE portfolio_transaction_units (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id      UUID NOT NULL REFERENCES portfolio_transactions(id) ON DELETE CASCADE,
  type                TEXT NOT NULL, -- GROSS_VALUE, TAX, FEE
  amount              BIGINT NOT NULL,
  currency_code       TEXT NOT NULL,
  forex_amount        BIGINT,
  forex_currency_code TEXT,
  exchange_rate       NUMERIC(20, 10)
);
ALTER TABLE portfolio_transaction_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own port txn units" ON portfolio_transaction_units
  USING (transaction_id IN (
    SELECT id FROM portfolio_transactions
    WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  ))
  WITH CHECK (transaction_id IN (
    SELECT id FROM portfolio_transactions
    WHERE portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid())
  ));

-- ============================================================
-- WATCHLISTS
-- ============================================================
CREATE TABLE watchlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own watchlists" ON watchlists
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE watchlist_securities (
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  security_id  UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  sort_order   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (watchlist_id, security_id)
);
ALTER TABLE watchlist_securities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own watchlist securities" ON watchlist_securities
  USING (watchlist_id IN (SELECT id FROM watchlists WHERE user_id = auth.uid()))
  WITH CHECK (watchlist_id IN (SELECT id FROM watchlists WHERE user_id = auth.uid()));

-- ============================================================
-- INVESTMENT PLANS (savings plans)
-- ============================================================
CREATE TABLE investment_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  security_id   UUID REFERENCES securities(id) ON DELETE SET NULL,
  portfolio_id  UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  account_id    UUID REFERENCES accounts(id) ON DELETE SET NULL,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  amount        BIGINT NOT NULL DEFAULT 0,
  fees          BIGINT NOT NULL DEFAULT 0,
  auto_generate BOOLEAN NOT NULL DEFAULT FALSE,
  plan_type     TEXT NOT NULL DEFAULT 'PURCHASE', -- PURCHASE, SAVINGS
  interval      TEXT NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, WEEKLY, BIWEEKLY
  start_date    DATE NOT NULL,
  end_date      DATE,
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE investment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own investment plans" ON investment_plans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TAXONOMIES
-- ============================================================
CREATE TABLE taxonomies (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE taxonomies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own taxonomies" ON taxonomies
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE classifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  taxonomy_id UUID NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES classifications(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#4f8ef7',
  sort_order  INT NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own classifications" ON classifications
  USING (taxonomy_id IN (SELECT id FROM taxonomies WHERE user_id = auth.uid()))
  WITH CHECK (taxonomy_id IN (SELECT id FROM taxonomies WHERE user_id = auth.uid()));

CREATE TABLE classification_assignments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classification_id       UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
  investment_vehicle_type TEXT NOT NULL, -- 'SECURITY' or 'ACCOUNT'
  investment_vehicle_id   UUID NOT NULL,
  weight                  INT NOT NULL DEFAULT 100 -- out of 100
);
ALTER TABLE classification_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own classification assignments" ON classification_assignments
  USING (classification_id IN (
    SELECT c.id FROM classifications c
    JOIN taxonomies t ON c.taxonomy_id = t.id
    WHERE t.user_id = auth.uid()
  ))
  WITH CHECK (classification_id IN (
    SELECT c.id FROM classifications c
    JOIN taxonomies t ON c.taxonomy_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- ============================================================
-- TRIGGER: auto-create user_settings row on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
