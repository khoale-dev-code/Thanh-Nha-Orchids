-- V16 | Customer directory, multiple contact numbers and delivery addresses.
-- Run AFTER 001_initial.sql. Does not delete or automatically merge existing customer records.
-- IMPORTANT: Take a Supabase database backup before applying.

alter table public.customers
  add column if not exists phone_numbers jsonb not null default '[]'::jsonb;
alter table public.customers
  add column if not exists delivery_addresses jsonb not null default '[]'::jsonb;

alter table public.customers drop constraint if exists customers_phone_numbers_array_v16;
alter table public.customers add constraint customers_phone_numbers_array_v16 check (jsonb_typeof(phone_numbers) = 'array');
alter table public.customers drop constraint if exists customers_delivery_addresses_array_v16;
alter table public.customers add constraint customers_delivery_addresses_array_v16 check (jsonb_typeof(delivery_addresses) = 'array');

-- The SQL canonicalization must match normalizeCustomerPhone in customer-directory-v16.ts.
create or replace function public.customer_phone_norm_v16(raw_phone text)
returns text language sql immutable set search_path=public as $$
  select case
    when length(regexp_replace(coalesce(raw_phone,''),'[^0-9]','','g')) between 11 and 12
     and left(regexp_replace(coalesce(raw_phone,''),'[^0-9]','','g'),2) = '84'
    then '0' || substring(regexp_replace(coalesce(raw_phone,''),'[^0-9]','','g') from 3)
    else regexp_replace(coalesce(raw_phone,''),'[^0-9]','','g')
  end;
$$;
revoke all on function public.customer_phone_norm_v16(text) from public;
grant execute on function public.customer_phone_norm_v16(text) to authenticated;

-- Prevent NEW duplicates, also under concurrent writes. Existing duplicates remain for explicit review.
create or replace function public.customer_guard_phones_v16()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate text;
begin
  if not new.active then return new; end if;
  -- Global lock is acceptable for a family shop with modest write volume.
  perform pg_advisory_xact_lock(16673120);
  if tg_op='UPDATE'
     and new.phone is not distinct from old.phone
     and new.phone_numbers is not distinct from old.phone_numbers
     and new.active is not distinct from old.active then
    return new;
  end if;
  for candidate in
    select distinct public.customer_phone_norm_v16(s.value)
    from (select new.phone as value
          union all
          select x->>'value' from jsonb_array_elements(new.phone_numbers) as x) s
    where length(public.customer_phone_norm_v16(s.value)) >= 9
  loop
    if exists (
      select 1 from public.customers existing
      where existing.active and existing.id <> new.id
        and (
          public.customer_phone_norm_v16(existing.phone)=candidate
          or exists (
            select 1 from jsonb_array_elements(existing.phone_numbers) x
            where public.customer_phone_norm_v16(x->>'value')=candidate
          )
        )
    ) then
      raise exception 'CUSTOMER_PHONE_DUPLICATE: số % đã thuộc một hồ sơ khác', candidate using errcode='23505';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.customer_guard_phones_v16() from public;
drop trigger if exists customer_guard_phones_v16 on public.customers;
create trigger customer_guard_phones_v16 before insert or update of phone,phone_numbers,active
on public.customers for each row execute function public.customer_guard_phones_v16();

-- Merge only when a matching phone proves a candidate relationship, after an explicit UI confirmation.
-- Snapshots on existing orders (customer_name, phone, address) remain unchanged.
create or replace function public.merge_customers_v16(p_keep uuid,p_remove uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.customers%rowtype;
declare b public.customers%rowtype;
declare phones jsonb;
declare addresses jsonb;
declare merged_note text;
begin
  if not (select public.is_staff()) then raise exception 'Không có quyền hợp nhất khách hàng';end if;
  if p_keep is null or p_remove is null or p_keep=p_remove then raise exception 'Cần hai hồ sơ khách khác nhau';end if;
  perform pg_advisory_xact_lock(16673120);
  -- Deterministic lock order to avoid deadlocks.
  perform 1 from public.customers where id in(p_keep,p_remove) order by id for update;
  select * into a from public.customers where id=p_keep;
  select * into b from public.customers where id=p_remove;
  if a.id is null or b.id is null or not a.active or not b.active then raise exception 'Hồ sơ không tồn tại hoặc đã lưu trữ';end if;
  if not exists (
    select 1 from (
      select public.customer_phone_norm_v16(a.phone) as n
      union all select public.customer_phone_norm_v16(p->>'value') from jsonb_array_elements(a.phone_numbers) p
    ) aa
    join (
      select public.customer_phone_norm_v16(b.phone) as n
      union all select public.customer_phone_norm_v16(p->>'value') from jsonb_array_elements(b.phone_numbers) p
    ) bb on aa.n=bb.n
    where length(aa.n)>=9
  ) then raise exception 'Hai hồ sơ không có số điện thoại trùng; không tự hợp nhất';end if;

  phones := coalesce(a.phone_numbers,'[]'::jsonb)||coalesce(b.phone_numbers,'[]'::jsonb);
  if length(trim(b.phone))>0 and public.customer_phone_norm_v16(b.phone)<>public.customer_phone_norm_v16(a.phone) then
    phones:=phones||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'label','Số từ hồ sơ cũ','value',b.phone));
  end if;
  addresses:=coalesce(a.delivery_addresses,'[]'::jsonb)||coalesce(b.delivery_addresses,'[]'::jsonb);
  if length(trim(b.address))>0 and lower(trim(b.address))<>lower(trim(a.address)) then
    addresses:=addresses||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'label','Địa chỉ cũ','value',b.address));
  end if;
  merged_note:=trim(concat_ws(' | ',nullif(trim(a.notes),''),
    case when lower(trim(a.name))<>lower(trim(b.name)) then 'Tên khác: '||b.name else null end,
    nullif(trim(b.notes),'')));

  -- Archive first so the duplicate guard does not block moving the merged phones to the kept record.
  update public.customers set active=false where id=p_remove;
  update public.customers set
    phone_numbers=phones,
    delivery_addresses=addresses,
    notes=merged_note
  where id=p_keep;
  -- Preserve invoice snapshots; only relational links change.
  update public.orders set customer_id=p_keep where customer_id=p_remove;
end;
$$;
revoke all on function public.merge_customers_v16(uuid,uuid) from public;
grant execute on function public.merge_customers_v16(uuid,uuid) to authenticated;
