-- Migration 008: Watch alerts — conditions stored per watchlist security
-- Users can set price targets, % change alerts, or news keyword triggers

create table if not exists public.watch_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  security_id  uuid not null references public.securities(id) on delete cascade,
  watchlist_id uuid references public.watchlists(id) on delete cascade,

  -- Alert type: PRICE_ABOVE | PRICE_BELOW | CHANGE_PCT_UP | CHANGE_PCT_DOWN | VOLUME_SPIKE
  alert_type   text not null,

  -- Threshold value (price in native units OR percentage, depending on type)
  threshold    numeric(18, 4) not null,

  -- Optional note explaining why user is watching
  note         text,

  is_active    boolean not null default true,
  triggered_at timestamptz,          -- set when the condition was last met
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS
alter table public.watch_alerts enable row level security;
create policy "owner_only" on public.watch_alerts
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Index for fast lookups per security
create index on public.watch_alerts(security_id, is_active);
create index on public.watch_alerts(user_id);

comment on table public.watch_alerts is 'Per-security price/change alert conditions for watchlist items';
comment on column public.watch_alerts.alert_type is 'PRICE_ABOVE | PRICE_BELOW | CHANGE_PCT_UP | CHANGE_PCT_DOWN';
comment on column public.watch_alerts.threshold is 'Price threshold (in display units) or % value depending on alert_type';
