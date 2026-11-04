-- V22: Manual livestream packing notes and an authenticated LAN print queue.
-- Apply after 003_family_operations.sql; no edits to products, orders or inventory.
create table if not exists public.family_live_notes (
  id uuid primary key,
  note_code text not null unique check(length(note_code) between 8 and 42),
  platform text not null check(platform in ('Facebook','TikTok','Truc tiep','Khac')),
  customer_name text not null check(length(customer_name) between 1 and 120),
  customer_phone text not null default '' check(length(customer_phone) <= 25),
  account_name text not null default '' check(length(account_name) <= 120),
  item_summary text not null default '' check(length(item_summary) <= 240),
  quantity integer not null default 1 check(quantity between 1 and 999),
  packing_note text not null default '' check(length(packing_note) <= 400),
  status text not null default 'pending' check(status in ('pending','packed','cancelled')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists family_live_notes_created_idx on public.family_live_notes(created_at desc);

create table if not exists public.family_live_note_print_jobs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.family_live_notes(id) on delete restrict,
  state text not null default 'queued' check(state in ('queued','printing','sent','error')),
  attempts integer not null default 0 check(attempts between 0 and 20),
  claimed_by uuid,
  claimed_at timestamptz,
  sent_at timestamptz,
  error_hint text not null default '' check(length(error_hint) <= 160),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists family_live_note_jobs_created_idx on public.family_live_note_print_jobs(created_at desc);
create unique index if not exists family_live_note_one_active_job_idx on public.family_live_note_print_jobs(note_id) where state in ('queued','printing');

alter table public.family_live_notes enable row level security;
alter table public.family_live_note_print_jobs enable row level security;
revoke all on public.family_live_notes,public.family_live_note_print_jobs from public,anon,authenticated;
grant select,insert,update(status) on public.family_live_notes to authenticated;
grant select,insert on public.family_live_note_print_jobs to authenticated;

create policy "live note read staff" on public.family_live_notes for select to authenticated
 using ((select public.is_staff()));
create policy "live note insert staff" on public.family_live_notes for insert to authenticated
 with check ((select public.is_staff()) and created_by=(select auth.uid()) and status='pending');
create policy "live note status staff" on public.family_live_notes for update to authenticated
 using ((select public.is_staff()) and status='pending')
 with check ((select public.is_staff()) and status in ('packed','cancelled'));
create policy "live print job read staff" on public.family_live_note_print_jobs for select to authenticated
 using ((select public.is_staff()));
create policy "live print job insert staff" on public.family_live_note_print_jobs for insert to authenticated
 with check (
   (select public.is_staff()) and created_by=(select auth.uid())
   and state='queued' and attempts=0 and claimed_by is null and claimed_at is null and sent_at is null
   and exists(select 1 from public.family_live_notes n where n.id=note_id and n.status<>'cancelled')
 );

-- Claim only NEW jobs. No automatic retry: a connection error can happen after paper was printed.
create or replace function public.family_claim_live_note_job()
returns table (
  job_id uuid, note_code text, platform text, customer_name text,
  customer_phone text, account_name text, item_summary text,
  quantity integer, packing_note text, created_at timestamptz
)
language plpgsql security definer set search_path='' as $$
declare v_job_id uuid;
begin
  if not public.is_staff() then raise exception 'Access denied'; end if;
  select j.id into v_job_id
  from public.family_live_note_print_jobs j
  join public.family_live_notes n on n.id=j.note_id
  where j.state='queued' and n.status<>'cancelled'
  order by j.created_at asc
  for update of j skip locked limit 1;
  if v_job_id is null then return; end if;
  update public.family_live_note_print_jobs j
     set state='printing',attempts=j.attempts+1,claimed_at=now(),claimed_by=auth.uid()
   where j.id=v_job_id;
  return query
    select j.id,n.note_code,n.platform,n.customer_name,n.customer_phone,
           n.account_name,n.item_summary,n.quantity,n.packing_note,n.created_at
    from public.family_live_note_print_jobs j
    join public.family_live_notes n on n.id=j.note_id
    where j.id=v_job_id;
end; $$;

create or replace function public.family_finish_live_note_job(p_job_id uuid,p_success boolean,p_error text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_staff() then raise exception 'Access denied'; end if;
  update public.family_live_note_print_jobs j
  set state=case when p_success then 'sent' else 'error' end,
      sent_at=case when p_success then now() else null end,
      error_hint=case when p_success then '' else left(coalesce(p_error,'Print failed'),160) end
  where j.id=p_job_id and j.state='printing' and j.claimed_by=auth.uid();
  if not found then raise exception 'Job was not claimed by this user'; end if;
end; $$;

revoke all on function public.family_claim_live_note_job() from public,anon;
revoke all on function public.family_finish_live_note_job(uuid,boolean,text) from public,anon;
grant execute on function public.family_claim_live_note_job() to authenticated;
grant execute on function public.family_finish_live_note_job(uuid,boolean,text) to authenticated;
