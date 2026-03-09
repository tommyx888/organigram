do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'hr_editor', 'viewer');
  end if;
end $$;

create table if not exists public.user_company_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

alter table public.user_company_roles enable row level security;

drop policy if exists "users can read own company roles" on public.user_company_roles;
create policy "users can read own company roles"
on public.user_company_roles
for select
using (auth.uid() = user_id);

drop policy if exists "service role can manage company roles" on public.user_company_roles;
create policy "service role can manage company roles"
on public.user_company_roles
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claim_company_id uuid;
  role_company_id uuid;
begin
  begin
    claim_company_id := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'company_id', '')::uuid;
  exception
    when others then
      claim_company_id := null;
  end;

  if claim_company_id is not null then
    return claim_company_id;
  end if;

  select company_id
  into role_company_id
  from public.user_company_roles
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  return role_company_id;
end;
$$;

create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  select role::text
  into current_role
  from public.user_company_roles
  where user_id = auth.uid()
    and company_id = public.current_company_id()
  order by created_at asc
  limit 1;

  return current_role;
end;
$$;
