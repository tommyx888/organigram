-- Nastavenia organigramu – jeden záznam pre celú aplikáciu (jedna firma).
-- Čítanie: všetci prihlásení.
-- Zmeny: iba používatelia s rolou admin.

create table if not exists public.org_chart_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.org_chart_settings enable row level security;

-- Čítanie: každý prihlásený
create policy "org_chart_settings select authenticated"
on public.org_chart_settings
for select
using (auth.uid() is not null);

-- Vkladanie: len admin (kontrola priamo v user_company_roles, bez závislosti na current_user_role())
create policy "org_chart_settings insert admin only"
on public.org_chart_settings
for insert
with check (
  exists (
    select 1 from public.user_company_roles
    where user_id = auth.uid() and role = 'admin'
    limit 1
  )
);

-- Aktualizácia: len admin
create policy "org_chart_settings update admin only"
on public.org_chart_settings
for update
using (
  exists (
    select 1 from public.user_company_roles
    where user_id = auth.uid() and role = 'admin'
    limit 1
  )
)
with check (
  exists (
    select 1 from public.user_company_roles
    where user_id = auth.uid() and role = 'admin'
    limit 1
  )
);
