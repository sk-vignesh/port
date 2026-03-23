-- Per-user broker integrations (Groww, Zerodha, etc.)
-- Credentials are stored with RLS: each user only sees their own row.
CREATE TABLE IF NOT EXISTS user_integrations (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_name TEXT        NOT NULL,          -- 'groww', 'zerodha', etc.
  api_key          TEXT        NOT NULL DEFAULT '',
  api_secret       TEXT        NOT NULL DEFAULT '',
  meta             JSONB,                          -- future: extra per-broker config
  last_synced_at   TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, integration_name)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own integrations"
  ON user_integrations
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
