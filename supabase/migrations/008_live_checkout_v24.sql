-- V24: permit editing recipient fields after creating an order with name only.
-- Existing create_sale already accepts empty phone/address; do not alter pricing RPCs.
-- Review and run once in Supabase SQL Editor after a database backup.

alter table public.app_settings alter column default_shipping_fee set default 40000;
update public.app_settings set default_shipping_fee=40000 where id=true and default_shipping_fee=30000;

-- RLS still restricts updates to public.is_staff(). Only contact columns are newly writable.
grant update (customer_name, customer_phone, customer_address, recipient_province_code, recipient_district_code, recipient_ward_code) on public.orders to authenticated;

create or replace function public.v24_guard_delivery_contact()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.shipping_provider <> 'Bán trực tiếp'
     and (old.status in ('shipped','delivered') or old.shipping_request_state in ('submitting','submitted','unknown'))
     and (new.customer_name is distinct from old.customer_name or new.customer_phone is distinct from old.customer_phone or new.customer_address is distinct from old.customer_address) then
    raise exception 'Don da dang giao/da tao van don: khong sua nguoi nhan tu dong';
  end if;
  if new.shipping_provider <> 'Bán trực tiếp'
     and ( (new.status in ('shipped','delivered') and new.status is distinct from old.status)
        or (new.shipping_request_state='submitted' and old.shipping_request_state is distinct from new.shipping_request_state) )
     and (length(btrim(coalesce(new.customer_phone,'')))=0 or length(btrim(coalesce(new.customer_address,'')))=0) then
    raise exception 'Can bo sung so dien thoai va dia chi truoc khi giao hang';
  end if;
  return new;
end;
$$;

drop trigger if exists v24_guard_delivery_contact on public.orders;
create trigger v24_guard_delivery_contact before update on public.orders
for each row execute function public.v24_guard_delivery_contact();
