-- Price history table for NSE equities
-- One row per symbol per trading day

create table if not exists price_history (
  id          bigserial primary key,
  symbol      text        not null,           -- e.g. RELIANCE
  date        date        not null,
  open        numeric(12,4),
  high        numeric(12,4),
  low         numeric(12,4),
  close       numeric(12,4) not null,
  volume      bigint,
  created_at  timestamptz default now()
);

-- Unique constraint: one row per symbol/date
alter table price_history
  add constraint price_history_symbol_date_key unique (symbol, date);

-- Indexes for common query patterns
create index if not exists price_history_symbol_idx on price_history (symbol);
create index if not exists price_history_date_idx   on price_history (date desc);

-- Enable RLS (read-only for authenticated users — prices are shared data)
alter table price_history enable row level security;

create policy "Anyone can read prices"
  on price_history for select
  using (true);
