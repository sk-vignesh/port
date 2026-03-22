-- Security Events table (dividends, splits, spin-offs, rights issues etc.)
create table if not exists public.security_events (
  id          uuid primary key default gen_random_uuid(),
  security_id uuid not null references public.securities(id) on delete cascade,
  date        date not null,
  type        text not null,           -- DIVIDEND, SPLIT, SPIN_OFF, RIGHTS, NOTE
  details     jsonb not null default '{}', -- e.g. {amount:150, ratio:"2:1", currency:"INR"}
  note        text,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup per security
create index if not exists security_events_security_id_idx on public.security_events(security_id, date desc);

-- Row Level Security
alter table public.security_events enable row level security;

-- Users can only access events for securities they own
create policy "security_events_owner" on public.security_events
  using (
    exists (
      select 1 from public.securities s
      where s.id = security_events.security_id
        and s.user_id = auth.uid()
    )
  );
