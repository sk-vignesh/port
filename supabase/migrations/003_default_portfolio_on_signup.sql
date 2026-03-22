-- Migration 003: Auto-create default portfolio and cash account on new user signup
-- Extends (or replaces) the existing handle_new_user trigger to also create defaults.

-- 1. Create or replace the handler function
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_account_id uuid;
  new_portfolio_id uuid;
begin
  -- Insert profile row if it exists in your schema (safe to omit if not)
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Create default Cash INR account
  insert into public.accounts (user_id, name, currency_code, note)
  values (new.id, 'Cash INR', 'INR', 'Default cash account')
  returning id into new_account_id;

  -- Create default Stocks portfolio linked to the cash account
  insert into public.portfolios (user_id, name, note, reference_account_id)
  values (new.id, 'Stocks', 'Default portfolio', new_account_id)
  returning id into new_portfolio_id;

  return new;
end;
$$;

-- 2. Drop old trigger if it exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
