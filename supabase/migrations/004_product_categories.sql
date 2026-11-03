-- V8: Saved product categories for a single-family orchid store.
-- No destructive change to existing products/category text.
-- Run ONCE in Supabase SQL Editor AFTER 001_initial.sql.
-- Existing category values remain valid: no foreign-key migration required.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 70),
  created_at timestamptz not null default now()
);

create unique index if not exists product_categories_name_ci_idx
  on public.product_categories ((lower(btrim(name))));

insert into public.product_categories(name)
select distinct btrim(category)
from public.products
where nullif(btrim(category),'') is not null
  and char_length(btrim(category)) <= 70
on conflict do nothing;

insert into public.product_categories(name)
values ('Hoa lan'), ('Vật tư'), ('Phụ kiện')
on conflict do nothing;

alter table public.product_categories enable row level security;

drop policy if exists "category_read_family" on public.product_categories;
create policy "category_read_family" on public.product_categories
for select to authenticated using ((select public.is_staff()));

drop policy if exists "category_insert_family" on public.product_categories;
create policy "category_insert_family" on public.product_categories
for insert to authenticated with check ((select public.is_staff()));

revoke all on public.product_categories from anon, authenticated;
grant select, insert on public.product_categories to authenticated;
