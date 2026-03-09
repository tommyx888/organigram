do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_description_status') then
    create type public.job_description_status as enum ('draft', 'review', 'approved', 'effective', 'archived');
  end if;
end $$;

create table if not exists public.job_descriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  document_key text not null,
  status public.job_description_status not null default 'draft',
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  unique (company_id, document_key),
  unique (position_id)
);

create table if not exists public.job_description_versions (
  id uuid primary key default uuid_generate_v4(),
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  version_no integer not null,
  content_json jsonb not null default '{}'::jsonb,
  approved_by uuid,
  effective_from date,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (job_description_id, version_no)
);

create table if not exists public.employee_position_assignments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now()
);

alter table public.job_descriptions enable row level security;
alter table public.job_description_versions enable row level security;
alter table public.employee_position_assignments enable row level security;

drop policy if exists "company isolation job descriptions" on public.job_descriptions;
create policy "company isolation job descriptions"
on public.job_descriptions
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "company isolation job description versions" on public.job_description_versions;
create policy "company isolation job description versions"
on public.job_description_versions
for all
using (
  exists (
    select 1
    from public.job_descriptions jd
    where jd.id = job_description_versions.job_description_id
      and jd.company_id = public.current_company_id()
  )
)
with check (
  exists (
    select 1
    from public.job_descriptions jd
    where jd.id = job_description_versions.job_description_id
      and jd.company_id = public.current_company_id()
  )
);

drop policy if exists "company isolation employee position assignments" on public.employee_position_assignments;
create policy "company isolation employee position assignments"
on public.employee_position_assignments
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());
