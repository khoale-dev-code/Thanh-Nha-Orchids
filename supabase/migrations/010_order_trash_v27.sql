-- Thanh Nha V27: 30-day order trash for ERRONEOUS, UNPAID, UNFULFILLED orders.
-- Requires 001_initial, 003_family_operations, 005_single_variant_cartons and 008_live_checkout.
-- Apply in Supabase SQL Editor as database owner after a BACKUP.
-- Accounting/tax documents, paid or fulfilled orders MUST NOT be purged on a 30-day schedule.
-- pg_cron runs daily at 02:15 UTC, so purge occurs at the next run after 30 full days.

alter table public.orders add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists deleted_by uuid;
create index if not exists ix_orders_trash_v27 on public.orders(deleted_at) where deleted_at is not null;

-- Orders in the trash are immutable, even if a client still has them cached.
create or replace function public.v27_guard_trashed_orders()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null
     and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception 'Don trong thung rac: khoi phuc truoc khi sua';
  end if;
  return new;
end; $$;
drop trigger if exists v27_guard_trashed_orders on public.orders;
create trigger v27_guard_trashed_orders before update on public.orders
for each row execute function public.v27_guard_trashed_orders();

create or replace function public.trash_order_v27(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_prior_payment boolean := false;
begin
  if not public.is_staff() then raise exception 'Khong co quyen bo don vao thung rac'; end if;
  if p_order_id is null then raise exception 'Thieu ma don'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Khong tim thay don'; end if;
  if v_order.deleted_at is not null then return p_order_id; end if;
  if v_order.payment_status <> 'unpaid'
     or v_order.status not in ('new','confirmed','packing','cancelled')
     or v_order.shipping_provider = 'Bán trực tiếp'
     or coalesce(v_order.tracking_code,'') <> ''
     or coalesce(v_order.shipping_request_state,'idle') <> 'idle'
     or coalesce(v_order.shipping_status,'') <> '' then
    raise exception 'Chi xoa duoc don sai chua thanh toan, chua giao, chua co van don. Don da thanh toan/giao hang can doi soat va luu chung tu';
  end if;
  if exists (select 1 from public.family_bank_transfers where order_id = p_order_id) then
    raise exception 'Don da lien ket doi soat chuyen khoan; khong the xoa';
  end if;
  -- Financial history is authoritative even if current payment_status was reset to unpaid.
  if exists (
    select 1 from public.family_audit_events ae
    where ae.entity_type='orders' and ae.entity_id=p_order_id::text
      and (ae.details #>> '{before,payment}'='paid' or ae.details #>> '{after,payment}'='paid')
  ) then
    raise exception 'Don tung da thanh toan; khong duoc xoa chung tu';
  end if;
  if to_regclass('public.order_item_edits_v26') is not null then
    execute 'select exists(select 1 from public.order_item_edits_v26 where order_id = $1 and (old_payment_status = ''paid'' or new_payment_status = ''paid''))'
      into v_prior_payment using p_order_id;
    if v_prior_payment then raise exception 'Don tung ghi nhan thanh toan; can luu chung tu'; end if;
  end if;

  -- Existing cancellation trigger already restored stock: do not restore twice.
  if v_order.status <> 'cancelled' then
    for v_line in
      select variant_id, sum(quantity)::bigint as qty
      from public.order_items where order_id=p_order_id and variant_id is not null
      group by variant_id order by variant_id
    loop
      -- Row lock serializes with checkout and other adjustments.
      perform 1 from public.product_variants where id=v_line.variant_id for update;
      update public.product_variants
      set stock_quantity = stock_quantity + v_line.qty
      where id=v_line.variant_id and stock_quantity is not null;
    end loop;
  end if;
  update public.orders set deleted_at=clock_timestamp(),deleted_by=auth.uid() where id=p_order_id;
  insert into public.family_audit_events(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'TRASH','orders',p_order_id::text,jsonb_build_object('retention_days',30));
  return p_order_id;
end; $$;
revoke all on function public.trash_order_v27(uuid) from public,anon,authenticated;
grant execute on function public.trash_order_v27(uuid) to authenticated;

create or replace function public.restore_order_v27(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_variant record;
begin
  if not public.is_staff() then raise exception 'Khong co quyen khoi phuc don'; end if;
  if p_order_id is null then raise exception 'Thieu ma don'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.deleted_at is null then raise exception 'Don khong o trong thung rac'; end if;
  if v_order.deleted_at <= now() - interval '30 days' then
    raise exception 'Don da qua 30 ngay, khong duoc khoi phuc';
  end if;
  if v_order.status <> 'cancelled' then
    for v_line in
      select variant_id, sum(quantity)::bigint as qty
      from public.order_items where order_id=p_order_id and variant_id is not null
      group by variant_id order by variant_id
    loop
      select id,stock_quantity,active into v_variant
      from public.product_variants where id=v_line.variant_id for update;
      if not found or not v_variant.active then raise exception 'San pham khong con ban, khong the khoi phuc ton'; end if;
      if v_variant.stock_quantity is not null then
        if v_variant.stock_quantity < v_line.qty then raise exception 'Khong du ton kho de khoi phuc don'; end if;
        update public.product_variants set stock_quantity=stock_quantity-v_line.qty where id=v_line.variant_id;
      end if;
    end loop;
  end if;
  update public.orders set deleted_at=null,deleted_by=null where id=p_order_id;
  insert into public.family_audit_events(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'RESTORE','orders',p_order_id::text,'{}'::jsonb);
  return p_order_id;
end; $$;
revoke all on function public.restore_order_v27(uuid) from public,anon,authenticated;
grant execute on function public.restore_order_v27(uuid) to authenticated;

-- Never expose a trashed order through the public tracking token.
create or replace function public.track_sale(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object('code',code,'status',status,'shipping_status',shipping_status,
    'tracking_code',tracking_code,'updated_at',updated_at,'created_at',created_at)
  into v from public.orders where tracking_token=p_token and deleted_at is null;
  return v;
end; $$;
revoke all on function public.track_sale(uuid) from public;
grant execute on function public.track_sale(uuid) to anon,authenticated;

-- Owner-only cleanup, called by pg_cron. Purges only the reversible mistakes
-- that were UNPAID and UNFULFILLED. Does not purge tax/accounting records.
create or replace function public.purge_order_trash_v27()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_order record;
  v_purged integer := 0;
  v_has_paid_edit boolean := false;
begin
  for v_order in
    select id from public.orders where deleted_at <= now() - interval '30 days'
      and status in ('new','confirmed','packing','cancelled') and payment_status='unpaid'
      and shipping_provider <> 'Bán trực tiếp'
      and coalesce(tracking_code,'') = ''
      and coalesce(shipping_request_state,'idle')='idle'
      and coalesce(shipping_status,'')=''
      and not exists(select 1 from public.family_bank_transfers bt where bt.order_id=orders.id)
      and not exists(select 1 from public.family_audit_events ae
        where ae.entity_type='orders' and ae.entity_id=orders.id::text
        and (ae.details #>> '{before,payment}'='paid' or ae.details #>> '{after,payment}'='paid'))
    order by deleted_at,id limit 200 for update skip locked
  loop
    v_has_paid_edit := false;
    if to_regclass('public.order_item_edits_v26') is not null then
      execute 'select exists(select 1 from public.order_item_edits_v26 where order_id = $1 and (old_payment_status = ''paid'' or new_payment_status = ''paid''))'
        into v_has_paid_edit using v_order.id;
    end if;
    if v_has_paid_edit then continue; end if;
    -- A converted livestream lead must not hold a dangling order foreign key.
    update public.family_livestream_leads set status='ignored',order_id=null
      where order_id=v_order.id and status='converted';
    if to_regclass('public.order_item_edits_v26') is not null then
      execute 'delete from public.order_item_edits_v26 where order_id=$1' using v_order.id;
    end if;
    delete from public.family_audit_events where entity_type='orders' and entity_id=v_order.id::text;
    -- order_items and order_carton_lines have ON DELETE CASCADE.
    delete from public.orders where id=v_order.id and deleted_at <= now()-interval '30 days';
    if found then v_purged := v_purged + 1; end if;
  end loop;
  return v_purged;
end; $$;
revoke all on function public.purge_order_trash_v27() from public,anon,authenticated;
-- Do not grant this destructive function to app users.

-- Fail closed if Cron cannot be installed. Never claim automatic deletion without a scheduled job.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('thanh-nha-trash-purge-v27','15 2 * * *',
  'select public.purge_order_trash_v27();');

-- Verify after applying:
-- select jobname,schedule,active from cron.job where jobname='thanh-nha-trash-purge-v27';
-- select count(*) from public.orders where deleted_at is not null;
-- No historical orders are marked as deleted by this migration.
