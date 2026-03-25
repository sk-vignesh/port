-- Migration 015: Fix handle_new_user trigger — add asset_class to default portfolio inserts
-- Migration 009 added asset_class NOT NULL to portfolios, breaking new user signup.
-- This replaces the trigger function to include asset_class for all 4 default portfolios.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_account_id uuid;
begin
  -- Profile row (safe no-op if profiles table doesn't exist)
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Default cash account
  insert into public.accounts (user_id, name, currency_code, note)
  values (new.id, 'Cash INR', 'INR', 'Default cash account')
  returning id into new_account_id;

  -- 4 default portfolios — asset_class required (NOT NULL since migration 009)
  insert into public.portfolios (user_id, name, note, reference_account_id, asset_class)
  values
    (new.id, 'Stocks',       'Equity holdings',               new_account_id, 'EQUITY'),
    (new.id, 'Commodities',  'Commodity holdings (Gold etc.)', new_account_id, 'COMMODITY'),
    (new.id, 'Fixed Income', 'Bonds, FDs, Debt funds',         new_account_id, 'FIXED_INCOME'),
    (new.id, 'Real Estate',  'REITs and property investments', new_account_id, 'REAL_ESTATE');

  return new;
end;
$$;

-- No need to recreate the trigger — CREATE OR REPLACE updates the function in-place.
-- The existing on_auth_user_created trigger will pick up the new function immediately.
