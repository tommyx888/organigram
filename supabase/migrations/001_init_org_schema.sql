create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'position_type') then
    create type public.position_type as enum ('salaried', 'indirect', 'direct');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'snapshot_status') then
    create type public.snapshot_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  parent_department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.positions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  code text not null,
  title text not null,
  position_type public.position_type not null,
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists public.employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id text not null,
  full_name text not null,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  manager_employee_id text,
  active_flag boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id)
);

create table if not exists public.org_snapshots (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  version integer not null,
  status public.snapshot_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (company_id, version)
);

create table if not exists public.org_edges (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid not null references public.org_snapshots(id) on delete cascade,
  parent_employee_id text not null,
  child_employee_id text not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, parent_employee_id, child_employee_id)
);

create table if not exists public.display_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  which_fields_visible jsonb not null default '{}'::jsonb,
  color_rules jsonb not null default '{}'::jsonb,
  layout_type text not null default 'classic_hierarchy',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid,
  actor_id uuid,
  entity_name text not null,
  entity_id text not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
