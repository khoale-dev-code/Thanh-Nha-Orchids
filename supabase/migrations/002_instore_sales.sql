-- Vườn Lan Thanh Nhã: bán trực tiếp trực tiếp, tích hợp atomic với create_sale cũ.
-- Áp dụng thủ công trong Supabase SQL Editor SAU 001_initial.sql.
-- Không thay đổi schema, không xóa dữ liệu; dùng trạng thái delivered để báo cáo đúng.

create or replace function public.create_sale_pos(
 p_request_id uuid,
 p_customer_id uuid,
 p_customer_name text,
 p_customer_phone text,
 p_items jsonb,
 p_discount bigint,
 p_payment_method text,
 p_payment_status text,
 p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 v_order_id uuid;
 v_existing record;
begin
 if not public.is_staff() then
  raise exception 'Không có quyền tạo đơn trực tiếp';
 end if;
 if p_request_id is null then raise exception 'Thiếu mã yêu cầu'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
 select id, shipping_provider, status into v_existing
 from public.orders where client_request_id=p_request_id;
 if found and (v_existing.shipping_provider <> 'Bán trực tiếp' or v_existing.status='cancelled') then
  raise exception 'Mã yêu cầu đã được dùng cho đơn hàng khác';
 end if;
 if p_payment_method not in ('Tiền mặt','Chuyển khoản') then
  raise exception 'Chỉ hỗ trợ thanh toán tiền mặt hoặc chuyển khoản trực tiếp';
 end if;
 if p_payment_status <> 'paid' then
  raise exception 'Bán trực tiếp yêu cầu đã nhận đủ tiền';
 end if;

 -- Reuse existing server-side pricing, tax, stock deduction, and idempotency.
 -- All SQL operations run in one database transaction.
 v_order_id := public.create_sale(
   p_request_id,
   p_customer_id,
   coalesce(nullif(btrim(p_customer_name),''),'Khách lẻ'),
   coalesce(p_customer_phone,''),
   '', '', '', '',
   p_items,
   0, 0,
   p_discount,
   p_payment_method,
   'paid',
   coalesce(p_note,'')
 );

 -- Only sale POS orders should be marked completed here.
 -- A request_id that previously created a DELIVERY order must never turn it into POS.
 if exists (
   select 1 from public.orders
   where id=v_order_id and shipping_provider not in ('','Bán trực tiếp')
 ) then
   raise exception 'Mã yêu cầu đã được dùng cho đơn loại khác';
 end if;
 if exists (
   select 1 from public.orders
   where id=v_order_id and (shipping_fee<>0 or shipping_cost<>0 or payment_status<>'paid')
 ) then
   raise exception 'Mã yêu cầu không hợp lệ cho đơn trực tiếp';
 end if;
 update public.orders
 set status='delivered',
     shipping_provider='Bán trực tiếp',
     shipping_status='Đã nhận hàng trực tiếp'
 where id=v_order_id and status<>'cancelled';
 return v_order_id;
end;
$$;

revoke all on function public.create_sale_pos(uuid,uuid,text,text,jsonb,bigint,text,text,text) from public;
grant execute on function public.create_sale_pos(uuid,uuid,text,text,jsonb,bigint,text,text,text) to authenticated;
