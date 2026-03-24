-- Migration 007: Add Commodities, Fixed Income, and Real Estate default portfolios
-- + Update the new-user trigger to create all 4 default portfolios on signup

-- 1. Update handle_new_user to create 4 default portfolios
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_account_id uuid;
begin
  -- Profile row
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Default cash account
  insert into public.accounts (user_id, name, currency_code, note)
  values (new.id, 'Cash INR', 'INR', 'Default cash account')
  returning id into new_account_id;

  -- 4 default portfolios
  insert into public.portfolios (user_id, name, note, reference_account_id)
  values
    (new.id, 'Stocks',       'Equity holdings',               new_account_id),
    (new.id, 'Commodities',  'Commodity holdings (Gold etc.)', new_account_id),
    (new.id, 'Fixed Income', 'Bonds, FDs, Debt funds',         new_account_id),
    (new.id, 'Real Estate',  'REITs and property investments', new_account_id);

  return new;
end;
$$;

-- 2. Re-attach trigger (drop first to be safe)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill existing users: insert the 3 missing portfolios for any user
--    who has exactly the original 'Stocks' default but not the new ones.
do $$
declare
  r record;
  ref_acc_id uuid;
begin
  for r in
    select distinct p.user_id
    from public.portfolios p
    where p.name = 'Stocks'
      and not exists (
        select 1 from public.portfolios p2
        where p2.user_id = p.user_id
          and p2.name in ('Commodities', 'Fixed Income', 'Real Estate')
      )
  loop
    -- Find the reference account for this user (first non-retired one)
    select id into ref_acc_id
    from public.accounts
    where user_id = r.user_id and is_retired = false
    order by created_at
    limit 1;

    insert into public.portfolios (user_id, name, note, reference_account_id)
    values
      (r.user_id, 'Commodities',  'Commodity holdings (Gold etc.)', ref_acc_id),
      (r.user_id, 'Fixed Income', 'Bonds, FDs, Debt funds',         ref_acc_id),
      (r.user_id, 'Real Estate',  'REITs and property investments', ref_acc_id)
    on conflict do nothing;
  end loop;
end;
$$;
