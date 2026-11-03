-- V9 / Phase 1: sell a single product variant by cartons.
-- Run AFTER 001_initial.sql and 002_instore_sales.sql.
-- NOTE: Phase 1 accepts one variant per carton order. Mixed cartons/multi-shipment are future phases.
-- This schema preserves existing stock units (individual plants) and original order lines.

create table if not exists public.order_carton_lines (
  order_id uuid primary key references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  carton_count integer not null check (carton_count between 1 and 100),
  units_per_carton integer not null check (units_per_carton between 1 and 1000),
  price_per_carton bigint not null check (price_per_carton between 1 and 1000000000000),
  reference_unit_price bigint not null check (reference_unit_price >= 0),
  bulk_discount bigint not null check (bulk_discount >= 0),
  created_at timestamptz not null default now(),
  constraint order_carton_quantity_limit check (carton_count * units_per_carton <= 10000)
);

alter table public.order_carton_lines enable row level security;
revoke all on public.order_carton_lines from public, anon, authenticated;
grant select on public.order_carton_lines to authenticated;
drop policy if exists "family read carton lines" on public.order_carton_lines;
create policy "family read carton lines" on public.order_carton_lines for select to authenticated
  using ((select public.is_staff()));

-- One RPC handles price validation, order creation, stock deduction and carton
-- metadata atomically. The client cannot forge the retail reference price.
create or replace function public.create_sale_carton(
  p_request_id uuid,
  p_variant_id uuid,
  p_carton_count integer,
  p_units_per_carton integer,
  p_price_per_carton bigint,
  p_mode text,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_province_code text,
  p_district_code text,
  p_ward_code text,
  p_shipping_fee bigint,
  p_shipping_cost bigint,
  p_discount bigint,
  p_payment_method text,
  p_payment_status text,
  p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_variant record;
  v_order uuid;
  v_qty integer;
  v_list_subtotal bigint;
  v_carton_subtotal bigint;
  v_bulk_discount bigint;
  v_existing record;
  v_meta record;
begin
  if not public.is_staff() then
    raise exception 'Khong co quyen ban theo thung';
  end if;
  if p_request_id is null or p_variant_id is null then
    raise exception 'Thieu ma yeu cau hoac san pham';
  end if;
  if p_mode not in ('instore','delivery') then
    raise exception 'Hinh thuc ban khong hop le';
  end if;
  if p_carton_count is null or p_carton_count not between 1 and 100
     or p_units_per_carton is null or p_units_per_carton not between 1 and 1000
     or p_carton_count * p_units_per_carton > 10000 then
    raise exception 'So thung hoac so cay moi thung khong hop le';
  end if;
  if p_price_per_carton is null or p_price_per_carton <= 0 or p_price_per_carton > 1000000000000
     or p_shipping_fee is null or p_shipping_fee < 0
     or p_shipping_cost is null or p_shipping_cost < 0
     or p_discount is null or p_discount < 0 then
    raise exception 'So tien khong hop le';
  end if;
  v_qty:=p_carton_count * p_units_per_carton;
  v_carton_subtotal:=p_price_per_carton::bigint * p_carton_count::bigint;
  if p_discount > v_carton_subtotal then
    raise exception 'Giam gia vuot tien hang';
  end if;
  if p_mode='instore' and (p_shipping_fee <> 0 or p_shipping_cost <> 0
      or p_payment_status <> 'paid'
      or p_payment_method not in ('Tien mat','Chuyen khoan','Tiền mặt','Chuyển khoản')) then
    raise exception 'Don ban tai quay phai thu du tien va khong co phi ship';
  end if;

  -- Same idempotency key must never create another order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  select id, shipping_provider, status, discount, shipping_fee, shipping_cost, payment_method, payment_status
    into v_existing from public.orders where client_request_id=p_request_id;
  if found then
    select * into v_meta from public.order_carton_lines where order_id=v_existing.id;
    if not found or v_meta.variant_id<>p_variant_id
       or v_meta.carton_count<>p_carton_count or v_meta.units_per_carton<>p_units_per_carton
       or v_meta.price_per_carton<>p_price_per_carton
       or v_existing.discount<>v_meta.bulk_discount + p_discount
       or v_existing.shipping_fee<>p_shipping_fee
       or v_existing.shipping_cost<>p_shipping_cost
       or v_existing.payment_method<>p_payment_method
       or v_existing.payment_status<>p_payment_status
       or v_existing.status='cancelled'
       or (p_mode='instore' and v_existing.shipping_provider<>'Bán trực tiếp')
       or (p_mode='delivery' and v_existing.shipping_provider='Bán trực tiếp') then
      raise exception 'Ma yeu cau da duoc dung voi don hang khac';
    end if;
    return v_existing.id;
  end if;

  select pv.price,pv.stock_quantity,pv.active,p.active as product_active
    into v_variant
    from public.product_variants pv
    join public.products p on p.id=pv.product_id
    where pv.id=p_variant_id
    for update of pv;
  if not found or not v_variant.active or not v_variant.product_active then
    raise exception 'San pham khong con duoc ban';
  end if;
  if v_variant.stock_quantity is not null and v_variant.stock_quantity<v_qty then
    raise exception 'Khong du so cay trong kho';
  end if;
  v_list_subtotal:=v_variant.price::bigint*v_qty::bigint;
  if v_carton_subtotal>v_list_subtotal then
    raise exception 'Gia ban thung khong duoc lon hon gia le tham chieu';
  end if;
  v_bulk_discount:=v_list_subtotal-v_carton_subtotal;

  if p_mode='instore' then
    v_order:=public.create_sale_pos(
      p_request_id,p_customer_id,p_customer_name,p_customer_phone,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id',p_variant_id,'quantity',v_qty)),
      v_bulk_discount+p_discount,p_payment_method,'paid',p_note
    );
  else
    v_order:=public.create_sale(
      p_request_id,p_customer_id,p_customer_name,p_customer_phone,p_customer_address,
      p_province_code,p_district_code,p_ward_code,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('variant_id',p_variant_id,'quantity',v_qty)),
      p_shipping_fee,p_shipping_cost,v_bulk_discount+p_discount,
      p_payment_method,p_payment_status,p_note
    );
  end if;

  insert into public.order_carton_lines(
    order_id,variant_id,carton_count,units_per_carton,price_per_carton,reference_unit_price,bulk_discount
  ) values(
    v_order,p_variant_id,p_carton_count,p_units_per_carton,p_price_per_carton,
    v_variant.price,v_bulk_discount
  );
  return v_order;
end;
$$;

revoke all on function public.create_sale_carton(uuid,uuid,integer,integer,bigint,text,uuid,text,text,text,text,text,text,bigint,bigint,bigint,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_sale_carton(uuid,uuid,integer,integer,bigint,text,uuid,text,text,text,text,text,text,bigint,bigint,bigint,text,text,text)
  to authenticated;
