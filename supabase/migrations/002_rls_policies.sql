-- Defensive compatibility for databases that already had older table versions.
alter table if exists public.departments add column if not exists company_id uuid;
alter table if exists public.positions add column if not exists company_id uuid;
alter table if exists public.employees add column if not exists company_id uuid;
alter table if exists public.org_snapshots add column if not exists company_id uuid;
alter table if exists public.display_profiles add column if not exists company_id uuid;
alter table if exists public.audit_events add column if not exists company_id uuid;

alter table public.companies enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.org_snapshots enable row level security;
alter table public.org_edges enable row level security;
alter table public.display_profiles enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'company_id', '')::uuid;
$$;

drop policy if exists "company isolation companies" on public.companies;
create policy "company isolation companies"
on public.companies
for all
using (id = public.current_company_id())
with check (id = public.current_company_id());

drop policy if exists "company isolation departments" on public.departments;
create policy "company isolation departments"
on public.departments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation positions" on public.positions;
create policy "company isolation positions"
on public.positions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation employees" on public.employees;
create policy "company isolation employees"
on public.employees
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation snapshots" on public.org_snapshots;
create policy "company isolation snapshots"
on public.org_snapshots
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation edges" on public.org_edges;
create policy "company isolation edges"
on public.org_edges
for all
using (
  exists (
    select 1
    from public.org_snapshots snapshot
    where snapshot.id = org_edges.snapshot_id
      and snapshot.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.org_snapshots snapshot
    where snapshot.id = org_edges.snapshot_id
      and snapshot.company_id = public.current_company_id()
  )
);

drop policy if exists "company isolation display profiles" on public.display_profiles;
create policy "company isolation display profiles"
on public.display_profiles
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation audit events" on public.audit_events;
create policy "company isolation audit events"
on public.audit_events
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());
