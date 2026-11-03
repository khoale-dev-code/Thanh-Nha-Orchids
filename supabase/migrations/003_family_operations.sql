-- V7: Van hanh gia dinh. Run AFTER 001_initial.sql and (if used) 002_instore_sales.sql.
-- This migration does not change order totals, stock logic, customer RLS or original roles.
-- All cash/hold/lead records are intended for one private family-run shop.

create table if not exists public.family_cash_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('other_income','expense')),
  purpose text not null default 'operation' check(purpose in ('operation','stock_purchase')),
  category text not null check (length(btrim(category)) between 1 and 90),
  amount bigint not null check (amount > 0 and amount <= 999999999999),
  occurred_on date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  note text not null default '' check(length(note) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists family_cash_date on public.family_cash_entries(occurred_on desc);

create table if not exists public.family_reservations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check(length(btrim(customer_name)) between 1 and 150),
  customer_phone text not null default '' check(length(customer_phone) <= 30),
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null check(quantity between 1 and 10000),
  agreed_unit_price bigint not null check(agreed_unit_price >= 0),
  deposit_amount bigint not null default 0 check(deposit_amount >= 0),
  due_on date,
  note text not null default '' check(length(note) <= 1000),
  status text not null default 'held' check(status in ('held','released','fulfilled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_reservation_deposit_limit check(deposit_amount <= agreed_unit_price * quantity)
);
create index if not exists family_holds_status on public.family_reservations(status,due_on);

create table if not exists public.family_bank_transfers (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check(length(btrim(reference)) between 3 and 120),
  amount bigint not null check(amount > 0),
  occurred_at timestamptz not null default now(),
  description text not null default '' check(length(description) <= 500),
  order_id uuid references public.orders(id),
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint family_bank_confirmed_together check ((order_id is null and confirmed_at is null) or (order_id is not null and confirmed_at is not null))
);
create unique index if not exists family_bank_one_match_per_order on public.family_bank_transfers(order_id) where order_id is not null;

create table if not exists public.family_livestream_leads (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('Facebook','TikTok','Khác')),
  source_comment text not null default '' check(length(source_comment) <= 2000),
  customer_name text not null default 'Khách livestream',
  customer_phone text not null default '',
  customer_address text not null default '',
  variant_id uuid not null references public.product_variants(id),
  quantity integer not null default 1 check(quantity between 1 and 10000),
  shipping_fee bigint not null default 0 check(shipping_fee >= 0),
  status text not null default 'pending' check(status in ('pending','converted','ignored')),
  order_id uuid references public.orders(id),
  request_id uuid not null unique default gen_random_uuid(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint family_lead_link_consistency check((status='converted' and order_id is not null) or (status<>'converted' and order_id is null))
);

create table if not exists public.family_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists family_audit_by_date on public.family_audit_events(created_at desc);

-- New family tables: no anonymous access. Original is_staff checks active membership,
-- including the existing 'owner' user. We DO NOT expose auth admin APIs in the browser.
alter table public.family_cash_entries enable row level security;
alter table public.family_reservations enable row level security;
alter table public.family_bank_transfers enable row level security;
alter table public.family_livestream_leads enable row level security;
alter table public.family_audit_events enable row level security;

revoke all on public.family_cash_entries,public.family_reservations,public.family_bank_transfers,public.family_livestream_leads,public.family_audit_events from anon,authenticated;
revoke all on sequence public.family_audit_events_id_seq from anon,authenticated;
grant select,insert on public.family_cash_entries to authenticated;
grant select,insert,update(status) on public.family_reservations to authenticated;
grant select,insert on public.family_bank_transfers to authenticated;
grant select,insert,update(status,customer_name,customer_phone,customer_address,shipping_fee) on public.family_livestream_leads to authenticated;
grant select on public.family_audit_events to authenticated;

create policy "family read cash" on public.family_cash_entries for select to authenticated using ((select public.is_staff()));
create policy "family insert cash" on public.family_cash_entries for insert to authenticated with check ((select public.is_staff()) and created_by=(select auth.uid()));
create policy "family read holds" on public.family_reservations for select to authenticated using ((select public.is_staff()));
create policy "family insert holds" on public.family_reservations for insert to authenticated with check ((select public.is_staff()) and created_by=(select auth.uid()));
create policy "family change hold status" on public.family_reservations for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "family read bank" on public.family_bank_transfers for select to authenticated using ((select public.is_staff()));
create policy "family insert bank" on public.family_bank_transfers for insert to authenticated with check ((select public.is_staff()) and created_by=(select auth.uid()) and order_id is null and confirmed_at is null and confirmed_by is null);
create policy "family read leads" on public.family_livestream_leads for select to authenticated using ((select public.is_staff()));
create policy "family insert leads" on public.family_livestream_leads for insert to authenticated with check ((select public.is_staff()) and created_by=(select auth.uid()) and status='pending' and order_id is null);
create policy "family ignore leads" on public.family_livestream_leads for update to authenticated using ((select public.is_staff()) and status='pending') with check ((select public.is_staff()) and status in ('pending','ignored'));
create policy "family read audit" on public.family_audit_events for select to authenticated using ((select public.is_staff()));

-- Match exactly ONE manually entered bank transfer with ONE unpaid order.
-- No automatic claim of successful payment based only on a QR image.
create or replace function public.family_confirm_bank_transfer(p_transfer_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_transfer public.family_bank_transfers%rowtype; v_order public.orders%rowtype;
begin
 if not public.is_staff() then raise exception 'Khong co quyen doi soat'; end if;
 select * into v_transfer from public.family_bank_transfers where id=p_transfer_id for update;
 if not found or v_transfer.order_id is not null then raise exception 'Giao dich khong kha dung'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.status='cancelled' then raise exception 'Don khong hop le'; end if;
 if v_order.payment_status<>'unpaid' then raise exception 'Don da danh dau thanh toan'; end if;
 if v_order.payment_method not in ('Chuyển khoản','Chuyen khoan') then raise exception 'Don khong phai chuyen khoan'; end if;
 if v_transfer.amount<>v_order.total then raise exception 'So tien giao dich phai bang dung tong don; coc va tra mot phan can theo doi rieng'; end if;
 update public.orders set payment_status='paid' where id=p_order_id;
 update public.family_bank_transfers set order_id=p_order_id,confirmed_at=now(),confirmed_by=auth.uid() where id=p_transfer_id;
end;$$;
revoke all on function public.family_confirm_bank_transfer(uuid,uuid) from public,anon;
grant execute on function public.family_confirm_bank_transfer(uuid,uuid) to authenticated;

-- Idempotent conversion: same lead request_id always returns the original order.
-- The UI calls create_sale with lead.request_id, then links that order here.
create or replace function public.family_finish_livestream_lead(p_lead_id uuid,p_order_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_lead public.family_livestream_leads%rowtype;
begin
 if not public.is_staff() then raise exception 'Khong co quyen'; end if;
 select * into v_lead from public.family_livestream_leads where id=p_lead_id for update;
 if not found then raise exception 'Khong tim thay don livestream'; end if;
 if v_lead.status='converted' and v_lead.order_id=p_order_id then return; end if;
 if v_lead.status<>'pending' then raise exception 'Don livestream da xu ly'; end if;
 if not exists(select 1 from public.orders where id=p_order_id and client_request_id=v_lead.request_id) then
   raise exception 'Don hang khong khop request_id cua livestream';
 end if;
 update public.family_livestream_leads set status='converted',order_id=p_order_id where id=p_lead_id;
end;$$;
revoke all on function public.family_finish_livestream_lead(uuid,uuid) from public,anon;
grant execute on function public.family_finish_livestream_lead(uuid,uuid) to authenticated;

-- Prevent circumventing bank match and lead links from authenticated direct client calls.
-- Important: column-level update grants protect amount/reference/order_id columns.

-- Minimal audit. Never log customer phone/address, bank credentials or full notes.
create or replace function public.family_audit_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old jsonb:='{}'::jsonb;v_new jsonb:='{}'::jsonb;v_entity text;
begin
 v_entity:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id','');
 if tg_table_name='orders' then
  if tg_op='INSERT' then
   v_new:=jsonb_build_object('status',new.status,'payment',new.payment_status,'total',new.total);
  else
   if old.status=new.status and old.payment_status=new.payment_status and old.shipping_status=new.shipping_status and old.tracking_code=new.tracking_code then return new; end if;
   v_old:=jsonb_build_object('status',old.status,'payment',old.payment_status,'shipping',old.shipping_status,'tracking',old.tracking_code);
   v_new:=jsonb_build_object('status',new.status,'payment',new.payment_status,'shipping',new.shipping_status,'tracking',new.tracking_code);
  end if;
 elsif tg_table_name='product_variants' then
  if tg_op='UPDATE' and old.price=new.price and old.cost_price is not distinct from new.cost_price and old.stock_quantity is not distinct from new.stock_quantity then return new; end if;
  v_new:=jsonb_build_object('price',new.price,'cost',new.cost_price,'stock',new.stock_quantity);
  if tg_op='UPDATE' then v_old:=jsonb_build_object('price',old.price,'cost',old.cost_price,'stock',old.stock_quantity); end if;
 elsif tg_table_name='family_cash_entries' then
  v_new:=jsonb_build_object('type',new.entry_type,'purpose',new.purpose,'category',new.category,'amount',new.amount);
 elsif tg_table_name='family_reservations' then
  v_new:=jsonb_build_object('status',new.status,'deposit',new.deposit_amount,'quantity',new.quantity);
  if tg_op='UPDATE' then v_old:=jsonb_build_object('status',old.status); end if;
 elsif tg_table_name='family_bank_transfers' then
  v_new:=jsonb_build_object('amount',new.amount,'matched',new.order_id is not null);
  if tg_op='UPDATE' then v_old:=jsonb_build_object('matched',old.order_id is not null); end if;
 elsif tg_table_name='family_livestream_leads' then
  v_new:=jsonb_build_object('platform',new.platform,'status',new.status);
  if tg_op='UPDATE' then v_old:=jsonb_build_object('status',old.status); end if;
 end if;
 insert into public.family_audit_events(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),tg_op, tg_table_name,v_entity,jsonb_build_object('before',v_old,'after',v_new));
 return new;
end;$$;

drop trigger if exists family_audit_orders on public.orders;
create trigger family_audit_orders after insert or update on public.orders for each row execute function public.family_audit_trigger();
drop trigger if exists family_audit_variants on public.product_variants;
create trigger family_audit_variants after insert or update on public.product_variants for each row execute function public.family_audit_trigger();
drop trigger if exists family_audit_cash on public.family_cash_entries;
create trigger family_audit_cash after insert on public.family_cash_entries for each row execute function public.family_audit_trigger();
drop trigger if exists family_audit_holds on public.family_reservations;
create trigger family_audit_holds after insert or update on public.family_reservations for each row execute function public.family_audit_trigger();
drop trigger if exists family_audit_bank on public.family_bank_transfers;
create trigger family_audit_bank after insert or update on public.family_bank_transfers for each row execute function public.family_audit_trigger();
drop trigger if exists family_audit_leads on public.family_livestream_leads;
create trigger family_audit_leads after insert or update on public.family_livestream_leads for each row execute function public.family_audit_trigger();

-- The report aggregates FULL tables on the server, not just the 500 latest orders
-- downloaded by the dashboard. Deposit balances are deliberately excluded.
create or replace function public.family_profit_monthly(p_year integer)
returns table(month integer,orders_count bigint,sales_revenue bigint,cogs bigint,shipping_cost bigint,sales_tax bigint,other_income bigint,operating_expense bigint,estimated_profit bigint)
language sql stable security definer set search_path='' as $$
 with m as (select generate_series(1,12) as month),
 sales as (
  select extract(month from (o.created_at at time zone 'Asia/Ho_Chi_Minh'))::integer as month,
   count(*)::bigint as orders_count,
   coalesce(sum(o.total-o.tax_total),0)::bigint as revenue,
   coalesce(sum(o.cost_total),0)::bigint as cogs,
   coalesce(sum(o.shipping_cost),0)::bigint as ship,
   coalesce(sum(o.tax_total),0)::bigint as tax
  from public.orders o
  where o.status='delivered' and extract(year from (o.created_at at time zone 'Asia/Ho_Chi_Minh'))::int=p_year
  group by 1
 ), cash as (
  select extract(month from c.occurred_on)::integer as month,
   coalesce(sum(c.amount) filter(where c.entry_type='other_income'),0)::bigint as inc,
   coalesce(sum(c.amount) filter(where c.entry_type='expense' and c.purpose='operation'),0)::bigint as exp
  from public.family_cash_entries c where extract(year from c.occurred_on)::int=p_year group by 1
 )
 select m.month,
  coalesce(s.orders_count,0),coalesce(s.revenue,0),coalesce(s.cogs,0),coalesce(s.ship,0),coalesce(s.tax,0),
  coalesce(c.inc,0),coalesce(c.exp,0),
  (coalesce(s.revenue,0)-coalesce(s.cogs,0)-coalesce(s.ship,0)+coalesce(c.inc,0)-coalesce(c.exp,0))::bigint
 from m left join sales s using(month) left join cash c using(month)
 where public.is_staff() order by m.month;
$$;
revoke all on function public.family_profit_monthly(integer) from public,anon;
grant execute on function public.family_profit_monthly(integer) to authenticated;

-- Protect tracked stock already promised to a customer.
-- NULL stock_quantity means untracked stock and is intentionally soft-hold only.
create or replace function public.family_validate_hold_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_available integer;v_held integer;
begin
 if new.status <> 'held' then return new; end if;
 select pv.stock_quantity into v_available from public.product_variants pv where pv.id=new.variant_id for update;
 if not found then raise exception 'San pham khong ton tai'; end if;
 if v_available is null then return new; end if;
 select coalesce(sum(r.quantity),0)::integer into v_held from public.family_reservations r
 where r.variant_id=new.variant_id and r.status='held' and r.id<>new.id;
 if v_available < v_held + new.quantity then raise exception 'Khong du ton kho de giu cay'; end if;
 return new;
end;$$;
drop trigger if exists family_reservation_stock_guard on public.family_reservations;
create trigger family_reservation_stock_guard before insert or update of status,quantity,variant_id on public.family_reservations
for each row execute function public.family_validate_hold_stock();

create or replace function public.family_block_oversale() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_held integer;
begin
 if new.stock_quantity is null then return new; end if;
 select coalesce(sum(r.quantity),0)::integer into v_held from public.family_reservations r where r.variant_id=new.id and r.status='held';
 if new.stock_quantity < v_held then raise exception 'Ton kho dang duoc giu cho khach. Can giai phong phieu giu truoc khi ban.'; end if;
 return new;
end;$$;
drop trigger if exists family_variant_stock_guard on public.product_variants;
create trigger family_variant_stock_guard before update of stock_quantity on public.product_variants
for each row execute function public.family_block_oversale();
