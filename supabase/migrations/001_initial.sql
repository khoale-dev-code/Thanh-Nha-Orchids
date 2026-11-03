-- Vườn Lan Thanh Nhã: schema cho 1 cửa hàng; không phải mô hình multi-tenant.
-- Chạy trong Supabase SQL Editor, sau đó thêm chủ cửa hàng vào app_members theo docs.
create extension if not exists pgcrypto;

create table if not exists public.app_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'staff' check (role in ('owner','staff')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_members where user_id=(select auth.uid()) and active=true);
$$;

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 160),
 description text not null default '', category text not null default 'Hoa lan',
 tax_rate numeric(5,2) not null default 0 check(tax_rate between 0 and 100),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 label text not null, color text not null default '', size text not null default '', sku text not null default '',
 price bigint not null check(price>=0), cost_price bigint check(cost_price>=0),
 stock_quantity integer check(stock_quantity>=0), weight_grams integer not null default 500 check(weight_grams>0),
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name))>=1),phone text not null default '',
 address text not null default '',province_code text not null default '',district_code text not null default '',ward_code text not null default '',
 notes text not null default '', active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.app_settings (
 id boolean primary key default true check(id), shop_name text not null default 'Vườn Lan Thanh Nhã',
 shop_phone text not null default '',shop_address text not null default '', bank_id text not null default '',bank_account text not null default '',bank_owner text not null default '',
 default_shipping_fee bigint not null default 30000 check(default_shipping_fee>=0),invoice_note text not null default 'Cảm ơn quý khách!'
);
insert into public.app_settings (id) values (true) on conflict(id) do nothing;

create sequence if not exists public.order_code_seq;
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),client_request_id uuid unique not null,
 code text unique not null default ('TN-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYMMDD') || '-' || lpad(nextval('public.order_code_seq')::text,5,'0')),
 customer_id uuid references public.customers(id),customer_name text not null default 'Khách lẻ',customer_phone text not null default '',customer_address text not null default '',
 recipient_province_code text not null default '',recipient_district_code text not null default '',recipient_ward_code text not null default '',
 tracking_token uuid unique not null default gen_random_uuid(),
 status text not null default 'new' check(status in ('new','confirmed','packing','shipped','delivered','cancelled')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid')),
 payment_method text not null default 'Chuyển khoản',
 shipping_provider text not null default '',shipping_status text not null default '', tracking_code text not null default '',
 shipping_request_state text not null default 'idle',note text not null default '',
 shipping_fee bigint not null default 0 check(shipping_fee>=0),shipping_cost bigint not null default 0 check(shipping_cost>=0),
 discount bigint not null default 0 check(discount>=0),subtotal bigint not null default 0 check(subtotal>=0),
 tax_total bigint not null default 0 check(tax_total>=0),total bigint not null default 0 check(total>=0),cost_total bigint not null default 0 check(cost_total>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 variant_id uuid references public.product_variants(id),product_name text not null,variant_label text not null,
 sku text not null default '',quantity integer not null check(quantity>0),unit_price bigint not null check(unit_price>=0),
 unit_cost bigint, tax_rate numeric(5,2) not null default 0,
 line_subtotal bigint not null,line_tax bigint not null,line_cost bigint not null
);

create index if not exists ix_products_active on public.products(active,name);
create index if not exists ix_variants_product on public.product_variants(product_id,active);
create index if not exists ix_customers_phone on public.customers(phone);
create index if not exists ix_customers_name on public.customers(name);
create index if not exists ix_orders_created on public.orders(created_at desc);
create index if not exists ix_orders_customer_created on public.orders(customer_id,created_at desc);
create index if not exists ix_orders_status_created on public.orders(status,created_at desc);
create index if not exists ix_items_order on public.order_items(order_id);

create or replace function public.bump_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now();return new; end;$$;
create trigger products_updated before update on public.products for each row execute function public.bump_updated_at();
create trigger customers_updated before update on public.customers for each row execute function public.bump_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.bump_updated_at();

-- RLS + column-level privileges: tài khoản không được tự sửa tổng tiền/hàng đã chốt.
alter table public.app_members enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.app_settings enable row level security;

create policy "staff own membership" on public.app_members for select to authenticated using(user_id=(select auth.uid()));
create policy "staff read products" on public.products for select to authenticated using((select public.is_staff()));
create policy "staff create products" on public.products for insert to authenticated with check((select public.is_staff()));
create policy "staff update products" on public.products for update to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "staff read variants" on public.product_variants for select to authenticated using((select public.is_staff()));
create policy "staff create variants" on public.product_variants for insert to authenticated with check((select public.is_staff()));
create policy "staff update variants" on public.product_variants for update to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "staff read customers" on public.customers for select to authenticated using((select public.is_staff()));
create policy "staff create customers" on public.customers for insert to authenticated with check((select public.is_staff()));
create policy "staff update customers" on public.customers for update to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "staff read orders" on public.orders for select to authenticated using((select public.is_staff()));
create policy "staff change order workflow" on public.orders for update to authenticated using((select public.is_staff())) with check((select public.is_staff()));
create policy "staff read order lines" on public.order_items for select to authenticated using((select public.is_staff()));
create policy "staff read settings" on public.app_settings for select to authenticated using((select public.is_staff()));
create policy "staff edit settings" on public.app_settings for update to authenticated using((select public.is_staff())) with check((select public.is_staff()));

revoke all on public.app_members, public.products, public.product_variants, public.customers, public.orders, public.order_items, public.app_settings from anon,authenticated;
grant select on public.app_members,public.products,public.product_variants,public.customers,public.orders,public.order_items,public.app_settings to authenticated;
grant insert,update on public.products,public.product_variants,public.customers to authenticated;
grant update on public.app_settings to authenticated;
grant update(status,payment_status,shipping_provider,shipping_status,tracking_code,shipping_request_state) on public.orders to authenticated;
grant usage on schema public to anon,authenticated;

-- Chốt đơn là transaction nguyên tử: giá, thuế, vốn lấy từ DB, không tin giá từ trình duyệt.
create or replace function public.create_sale(
 p_request_id uuid,p_customer_id uuid,p_customer_name text,p_customer_phone text,p_customer_address text,
 p_province_code text,p_district_code text,p_ward_code text,p_items jsonb,
 p_shipping_fee bigint,p_shipping_cost bigint,p_discount bigint,p_payment_method text,p_payment_status text,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_existing uuid;v_item jsonb;v_variant record;v_quantity integer;v_line bigint;v_tax bigint;
 v_subtotal bigint:=0;v_tax_total bigint:=0;v_cost bigint:=0;v_count integer:=0;
begin
 if not public.is_staff() then raise exception 'Không có quyền tạo đơn hàng';end if;
 if p_request_id is null then raise exception 'Thiếu request id';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
 select id into v_existing from public.orders where client_request_id=p_request_id;
 if v_existing is not null then return v_existing;end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ';end if;
 if coalesce(p_shipping_fee,-1)<0 or coalesce(p_shipping_cost,-1)<0 or coalesce(p_discount,-1)<0 then raise exception 'Số tiền không hợp lệ';end if;
 if p_payment_status not in ('unpaid','paid') then raise exception 'Trạng thái thanh toán không hợp lệ';end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_count:=v_count+1;
   if (v_item->>'quantity') is null or (v_item->>'quantity') !~ '^\d{1,5}$' then raise exception 'Số lượng không hợp lệ';end if;
   v_quantity:=(v_item->>'quantity')::integer;
   if v_quantity<1 or v_quantity>10000 then raise exception 'Số lượng không hợp lệ';end if;
   select pv.*,p.name as product_name,p.tax_rate,p.active as product_active
   into v_variant from public.product_variants pv join public.products p on p.id=pv.product_id
   where pv.id=(v_item->>'variant_id')::uuid for update of pv;
   if not found or not v_variant.active or not v_variant.product_active then raise exception 'Có sản phẩm không khả dụng';end if;
   if v_variant.stock_quantity is not null and v_variant.stock_quantity<v_quantity then raise exception 'Không đủ tồn kho cho %',v_variant.product_name;end if;
   v_subtotal:=v_subtotal+v_variant.price*v_quantity;
   v_cost:=v_cost+coalesce(v_variant.cost_price,0)*v_quantity;
 end loop;
 if p_discount>v_subtotal then raise exception 'Giảm giá vượt tiền hàng';end if;
 -- Thuế tính trên giá đã giảm: phân bổ discount tương ứng giá từng dòng.
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_quantity:=(v_item->>'quantity')::integer;
   select pv.price,p.tax_rate into v_variant from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(v_item->>'variant_id')::uuid;
   v_line:=v_variant.price*v_quantity;
   v_tax_total:=v_tax_total+round(((v_line-p_discount*v_line/greatest(v_subtotal,1))*v_variant.tax_rate/100.0))::bigint;
 end loop;
 insert into public.orders(client_request_id,customer_id,customer_name,customer_phone,customer_address,
 recipient_province_code,recipient_district_code,recipient_ward_code,shipping_fee,shipping_cost,discount,payment_method,payment_status,note,subtotal,tax_total,total,cost_total)
 values(p_request_id,p_customer_id,coalesce(nullif(trim(p_customer_name),''),'Khách lẻ'),coalesce(p_customer_phone,''),coalesce(p_customer_address,''),
 coalesce(p_province_code,''),coalesce(p_district_code,''),coalesce(p_ward_code,''),p_shipping_fee,p_shipping_cost,p_discount,p_payment_method,p_payment_status,coalesce(p_note,''),
 v_subtotal,v_tax_total,v_subtotal-p_discount+v_tax_total+p_shipping_fee,v_cost) returning id into v_id;
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_quantity:=(v_item->>'quantity')::integer;
   select pv.*,p.name as product_name,p.tax_rate into v_variant from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=(v_item->>'variant_id')::uuid for update of pv;
   v_line:=v_variant.price*v_quantity;
   v_tax:=round(((v_line-p_discount*v_line/greatest(v_subtotal,1))*v_variant.tax_rate/100.0))::bigint;
   insert into public.order_items(order_id,variant_id,product_name,variant_label,sku,quantity,unit_price,unit_cost,tax_rate,line_subtotal,line_tax,line_cost)
   values(v_id,v_variant.id,v_variant.product_name,v_variant.label,v_variant.sku,v_quantity,v_variant.price,v_variant.cost_price,v_variant.tax_rate,v_line,v_tax,coalesce(v_variant.cost_price,0)*v_quantity);
   if v_variant.stock_quantity is not null then update public.product_variants set stock_quantity=stock_quantity-v_quantity where id=v_variant.id;end if;
 end loop;
 return v_id;
end;$$;
revoke all on function public.create_sale(uuid,uuid,text,text,text,text,text,text,jsonb,bigint,bigint,bigint,text,text,text) from public;
grant execute on function public.create_sale(uuid,uuid,text,text,text,text,text,text,jsonb,bigint,bigint,bigint,text,text,text) to authenticated;

-- Hủy đơn hoàn tồn kho đúng một lần. Không mở lại đơn đã hủy để tránh tính tồn sai.
create or replace function public.on_order_cancel() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Không thể mở lại đơn đã hủy';end if;
 if new.status='cancelled' and old.status<>'cancelled' then
  for r in select variant_id,quantity from public.order_items where order_id=new.id and variant_id is not null loop
   update public.product_variants set stock_quantity=stock_quantity+r.quantity where id=r.variant_id and stock_quantity is not null;
  end loop;
 end if;
 return new;
end;$$;
create trigger orders_cancel_restore before update of status on public.orders for each row execute function public.on_order_cancel();

-- Tracking công khai: token bí mật khó đoán, không bao giờ trả về số ĐT/địa chỉ khách.
create or replace function public.track_sale(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object('code',code,'status',status,'shipping_status',shipping_status,'tracking_code',tracking_code,'updated_at',updated_at,'created_at',created_at)
 into v from public.orders where tracking_token=p_token;
 return v;
end;$$;
revoke all on function public.track_sale(uuid) from public;
grant execute on function public.track_sale(uuid) to anon,authenticated;

-- Báo cáo SQL tổng hợp hàng ngày, không tải hàng ngàn đơn xuống trình duyệt.
create or replace function public.report_daily(p_from date,p_to date)
returns table(day date,order_count bigint,revenue bigint,cogs bigint,shipping_cost bigint,tax_total bigint,profit bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Không có quyền xem báo cáo';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Khoảng thời gian không hợp lệ';end if;
 return query select (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date,count(*)::bigint,
 sum(o.total-o.tax_total)::bigint,sum(o.cost_total)::bigint,sum(o.shipping_cost)::bigint,sum(o.tax_total)::bigint,
 sum(o.total-o.tax_total-o.cost_total-o.shipping_cost)::bigint
 from public.orders o where o.status='delivered' and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
 group by 1 order by 1;
end;$$;
revoke all on function public.report_daily(date,date) from public;
grant execute on function public.report_daily(date,date) to authenticated;

-- Quyền thực thi function nội bộ, không công khai cho khách nặc danh.
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
