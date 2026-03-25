-- Migration 015 (v2): Fix handle_new_user trigger
-- Root cause: trigger was calling INSERT INTO public.profiles which does not exist.
-- Also adds asset_class to the default portfolio inserts (required since migration 009).
-- This replaces the broken function in-place — no trigger recreation needed.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_account_id uuid;
begin
  -- Default cash account
  insert into public.accounts (user_id, name, currency_code, note)
  values (new.id, 'Cash INR', 'INR', 'Default cash account')
  returning id into new_account_id;

  -- 4 default portfolios — asset_class required (NOT NULL default 'EQUITY' since migration 009)
  insert into public.portfolios (user_id, name, note, reference_account_id, asset_class)
  values
    (new.id, 'Stocks',       'Equity holdings',                new_account_id, 'EQUITY'),
    (new.id, 'Commodities',  'Commodity holdings (Gold etc.)', new_account_id, 'COMMODITY'),
    (new.id, 'Fixed Income', 'Bonds, FDs, Debt funds',         new_account_id, 'FIXED_INCOME'),
    (new.id, 'Real Estate',  'REITs and property investments',  new_account_id, 'REAL_ESTATE');

  return new;
end;
$$;
