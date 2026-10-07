create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  custom_item text,
  amount numeric(14, 2) not null check (amount > 0),
  currency_code text not null references public.currencies (code),
  spent_on date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc);
create index if not exists expenses_user_category_idx
  on public.expenses (user_id, category_id);
create index if not exists expenses_user_currency_idx
  on public.expenses (user_id, currency_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.validate_expense_custom_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category_slug text;
begin
  select slug into category_slug
  from public.categories
  where id = new.category_id;

  if category_slug = 'other' and (new.custom_item is null or char_length(trim(new.custom_item)) = 0) then
    raise exception 'A custom item name is required for the Other category';
  end if;

  if category_slug <> 'other' then
    new.custom_item = null;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_validate_custom_item on public.expenses;
create trigger expenses_validate_custom_item
before insert or update on public.expenses
for each row execute function public.validate_expense_custom_item();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.categories (name, slug) values
  ('Transport', 'transport'),
  ('Food', 'food'),
  ('Snacks', 'snacks'),
  ('TOTO', 'toto'),
  ('Tea/Coffee', 'tea-coffee'),
  ('Cinema', 'cinema'),
  ('Drinks/Alcohol', 'drinks-alcohol'),
  ('Cigarette', 'cigarette'),
  ('Other', 'other')
on conflict (slug) do update set name = excluded.name;

insert into public.currencies (code, name, symbol) values
  ('SGD', 'Singapore Dollar', 'S$'),
  ('INR', 'Indian Rupee', '₹'),
  ('USD', 'US Dollar', '$'),
  ('MYR', 'Malaysian Ringgit', 'RM'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('JPY', 'Japanese Yen', '¥'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('AED', 'UAE Dirham', 'د.إ')
on conflict (code) do update set name = excluded.name, symbol = excluded.symbol;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.currencies enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Authenticated users can read categories" on public.categories;
create policy "Authenticated users can read categories"
  on public.categories for select to authenticated using (true);
drop policy if exists "Authenticated users can read currencies" on public.currencies;
create policy "Authenticated users can read currencies"
  on public.currencies for select to authenticated using (true);

drop policy if exists "Users can read their own expenses" on public.expenses;
create policy "Users can read their own expenses"
  on public.expenses for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own expenses" on public.expenses;
create policy "Users can create their own expenses"
  on public.expenses for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can update their own expenses" on public.expenses;
create policy "Users can update their own expenses"
  on public.expenses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can delete their own expenses"
  on public.expenses for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.categories, public.currencies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
