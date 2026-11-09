-- V26 - Correct a checkout mistake and reprint the SAME order code.
-- Apply AFTER 001_initial.sql and 005_single_variant_cartons.sql.
-- This migration does not rewrite create_sale, alter prices in the catalog, or touch previously shipped orders.
-- BACK UP your Supabase database before applying any migration.

create table if not exists public.order_item_edits_v26 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  edited_by uuid not null,
  old_items jsonb not null,
  new_items jsonb not null,
  old_total bigint not null,
  new_total bigint not null,
  old_payment_status text not null,
  new_payment_status text not null,
  created_at timestamptz not null default now()
);
create index if not exists ix_order_item_edits_v26_order on public.order_item_edits_v26(order_id,created_at desc);
alter table public.order_item_edits_v26 enable row level security;
revoke all on public.order_item_edits_v26 from public,anon,authenticated;
grant select on public.order_item_edits_v26 to authenticated;
drop policy if exists "family read order item corrections v26" on public.order_item_edits_v26;
create policy "family read order item corrections v26" on public.order_item_edits_v26
 for select to authenticated using ((select public.is_staff()));

create or replace function public.edit_order_items_v26(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_line public.order_items%rowtype;
  v_product record;
  v_variant record;
  v_input jsonb;
  v_work jsonb := '[]'::jsonb;
  v_written jsonb := '[]'::jsonb;
  v_old_items jsonb := '[]'::jsonb;
  v_line_id uuid;
  v_variant_id uuid;
  v_identity text;
  v_seen text[] := array[]::text[];
  v_qty integer;
  v_old_qty integer;
  v_new_qty integer;
  v_unit_price bigint;
  v_unit_cost bigint;
  v_tax_rate numeric;
  v_subtotal bigint := 0;
  v_tax_total bigint := 0;
  v_cost_total bigint := 0;
  v_line_subtotal bigint;
  v_line_tax bigint;
  v_line_cost bigint;
  v_total bigint;
  v_old_total bigint;
  v_after_payment text;
  v_new_stock bigint;
begin
  if not public.is_staff() then raise exception 'Khong co quyen sua don hang'; end if;
  if p_order_id is null or p_expected_updated_at is null then raise exception 'Thieu ma don hoac phien ban don'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Danh sach san pham khong hop le (1-100 dong)';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Khong tim thay don hang'; end if;
  if v_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'Don hang da duoc thay doi tren thiet bi khac. Tai lai hoa don truoc khi sua';
  end if;
  if v_order.status not in ('new','confirmed','packing')
     or v_order.shipping_provider = 'Bán trực tiếp'
     or coalesce(v_order.tracking_code,'') <> ''
     or coalesce(v_order.shipping_request_state,'idle') <> 'idle' then
    raise exception 'Chi sua duoc don moi/chua giao va chua tao van don. Don da giao/ban tai quay can doi soat rieng';
  end if;
  if exists (select 1 from public.order_carton_lines where order_id = p_order_id) then
    raise exception 'Don ban thung khong sua so luong bang cong cu nay';
  end if;

  select coalesce(jsonb_agg(to_jsonb(oi) order by oi.id),'[]'::jsonb)
  into v_old_items from public.order_items oi where oi.order_id = p_order_id;
  if jsonb_array_length(v_old_items)=0 then raise exception 'Don khong co dong hang'; end if;

  -- Validate the complete desired cart and take snapshots of existing sale prices.
  -- Existing lines keep historical unit_price/cost/tax; new lines read today's DB price.
  for v_input in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_input) <> 'object' or coalesce(v_input->>'quantity','') !~ '^[0-9]{1,5}$' then
      raise exception 'Dong hang hoac so luong khong hop le';
    end if;
    v_qty := (v_input->>'quantity')::integer;
    if v_qty < 1 or v_qty > 10000 then raise exception 'Moi dong can 1-10000 san pham'; end if;
    if (v_input ? 'line_id') = (v_input ? 'variant_id') then
      raise exception 'Moi dong phai co line_id HOAC variant_id';
    end if;

    v_line_id := null;
    if v_input ? 'line_id' then
      v_line_id := (v_input->>'line_id')::uuid;
      select * into v_line from public.order_items where id=v_line_id and order_id=p_order_id for update;
      if not found then raise exception 'San pham khong thuoc don dang sua'; end if;
      v_variant_id := v_line.variant_id;
      if v_variant_id is null then raise exception 'Dong hang da mat lien ket kho, khong duoc sua tu dong'; end if;
      v_work := v_work || jsonb_build_array(jsonb_build_object(
        'line_id',v_line_id,'variant_id',v_variant_id,'quantity',v_qty,
        'product_name',v_line.product_name,'variant_label',v_line.variant_label,'sku',v_line.sku,
        'unit_price',v_line.unit_price,'unit_cost',v_line.unit_cost,'tax_rate',v_line.tax_rate
      ));
    else
      v_variant_id := (v_input->>'variant_id')::uuid;
      select pv.*, p.name as product_name, p.tax_rate as product_tax_rate,
             p.active as product_active
      into v_product
      from public.product_variants pv join public.products p on p.id=pv.product_id
      where pv.id = v_variant_id for update of pv;
      if not found or not v_product.active or not v_product.product_active then
        raise exception 'San pham moi khong con duoc ban';
      end if;
      v_work := v_work || jsonb_build_array(jsonb_build_object(
        'variant_id',v_variant_id,'quantity',v_qty,'product_name',v_product.product_name,
        'variant_label',v_product.label,'sku',v_product.sku,'unit_price',v_product.price,
        'unit_cost',v_product.cost_price,'tax_rate',v_product.product_tax_rate
      ));
    end if;
    v_identity := v_variant_id::text;
    if v_identity = any(v_seen) then raise exception 'Mot san pham khong duoc xuat hien nhieu dong trong don'; end if;
    v_seen := array_append(v_seen,v_identity);
    v_unit_price := (v_work->(jsonb_array_length(v_work)-1)->>'unit_price')::bigint;
    v_unit_cost := coalesce((v_work->(jsonb_array_length(v_work)-1)->>'unit_cost')::bigint,0);
    if v_unit_price < 0 or v_unit_cost < 0 then raise exception 'Gia dong hang khong hop le'; end if;
    v_subtotal := v_subtotal + v_unit_price * v_qty;
    v_cost_total := v_cost_total + v_unit_cost * v_qty;
  end loop;

  if v_subtotal < v_order.discount then
    raise exception 'Tong tien hang sau khi sua nho hon giam gia %; can dieu chinh giam gia bang quy trinh rieng',v_order.discount;
  end if;

  -- Reconcile inventory using the DELTA between previous and desired quantities.
  -- Locks variant records, refuses negative stock and never restocks an untracked SKU.
  for v_variant in
    select pv.id,pv.stock_quantity,pv.active,p.active as product_active
    from public.product_variants pv join public.products p on p.id=pv.product_id
    where pv.id in (
      select oi.variant_id from public.order_items oi where oi.order_id=p_order_id
      union
      select (entry.value->>'variant_id')::uuid from jsonb_array_elements(v_work) entry
    )
    order by pv.id for update of pv
  loop
    select coalesce(sum(oi.quantity),0)::integer into v_old_qty
      from public.order_items oi where oi.order_id=p_order_id and oi.variant_id=v_variant.id;
    select coalesce(sum((entry.value->>'quantity')::integer),0)::integer into v_new_qty
      from jsonb_array_elements(v_work) entry where (entry.value->>'variant_id')::uuid=v_variant.id;
    if (not v_variant.active or not v_variant.product_active) and v_new_qty>v_old_qty then
      raise exception 'Khong the tang so luong san pham da ngung ban';
    end if;
    if v_variant.stock_quantity is not null then
      v_new_stock := v_variant.stock_quantity::bigint + v_old_qty - v_new_qty;
      if v_new_stock < 0 or v_new_stock > 2147483647 then
        raise exception 'Ton kho khong du de sua don hang';
      end if;
      update public.product_variants set stock_quantity=v_new_stock where id=v_variant.id;
    end if;
  end loop;

  -- Delete omitted lines, update existing IDs, insert selected new variants.
  delete from public.order_items oi
  where oi.order_id=p_order_id and not exists (
    select 1 from jsonb_array_elements(v_work) entry
    where nullif(entry.value->>'line_id','')::uuid = oi.id
  );

  for v_input in select value from jsonb_array_elements(v_work) loop
    v_qty := (v_input->>'quantity')::integer;
    v_unit_price := (v_input->>'unit_price')::bigint;
    v_unit_cost := coalesce((v_input->>'unit_cost')::bigint,0);
    v_tax_rate := (v_input->>'tax_rate')::numeric;
    v_line_subtotal := v_unit_price * v_qty;
    v_line_cost := v_unit_cost * v_qty;
    v_line_tax := round((v_line_subtotal::numeric -
      v_order.discount::numeric * v_line_subtotal::numeric / greatest(v_subtotal,1)) * v_tax_rate / 100)::bigint;
    v_tax_total := v_tax_total + v_line_tax;
    if v_input ? 'line_id' then
      update public.order_items set quantity=v_qty,line_subtotal=v_line_subtotal,
        line_tax=v_line_tax,line_cost=v_line_cost
      where id=(v_input->>'line_id')::uuid and order_id=p_order_id;
    else
      insert into public.order_items(order_id,variant_id,product_name,variant_label,sku,quantity,
        unit_price,unit_cost,tax_rate,line_subtotal,line_tax,line_cost)
      values(p_order_id,(v_input->>'variant_id')::uuid,v_input->>'product_name',v_input->>'variant_label',
        coalesce(v_input->>'sku',''),v_qty,v_unit_price,
        nullif(v_input->>'unit_cost','')::bigint,v_tax_rate,v_line_subtotal,v_line_tax,v_line_cost);
    end if;
  end loop;

  v_total := v_subtotal - v_order.discount + v_tax_total + v_order.shipping_fee;
  v_old_total := v_order.total;
  v_after_payment := case when v_order.payment_status='paid' and v_total<>v_old_total
    then 'unpaid' else v_order.payment_status end;
  update public.orders set subtotal=v_subtotal,tax_total=v_tax_total,
    cost_total=v_cost_total,total=v_total,payment_status=v_after_payment
  where id=p_order_id;

  select coalesce(jsonb_agg(to_jsonb(oi) order by oi.id),'[]'::jsonb)
  into v_written from public.order_items oi where oi.order_id=p_order_id;
  insert into public.order_item_edits_v26(order_id,edited_by,old_items,new_items,
    old_total,new_total,old_payment_status,new_payment_status)
  values (p_order_id,(select auth.uid()),v_old_items,v_written,
    v_old_total,v_total,v_order.payment_status,v_after_payment);
  return p_order_id;
end;
$$;
revoke all on function public.edit_order_items_v26(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.edit_order_items_v26(uuid,timestamptz,jsonb) to authenticated;
