-- Verejné zdieľateľné odkazy na organigram (náhľad pre ľudí mimo organizácie).
-- Odkaz obsahuje token; verejný endpoint vráti iba aktívnych SAL zamestnancov.
create table if not exists public.org_share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique,
  label text not null default 'Verejný náhľad',
  is_enabled boolean not null default true,
  expires_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists org_share_links_token_idx on public.org_share_links (token);
create index if not exists org_share_links_company_idx on public.org_share_links (company_id);

alter table public.org_share_links enable row level security;

-- RLS: iba admin / hr_editor danej company môže spravovať odkazy.
create policy "org_share_links manage by editors"
on public.org_share_links
for all
using (
  company_id = public.current_company_id()
  and public.current_user_role() in ('admin', 'hr_editor')
)
with check (
  company_id = public.current_company_id()
  and public.current_user_role() in ('admin', 'hr_editor')
);

-- Verejné čítanie ide cez service role na serveri (obchádza RLS), tabuľka nie je čitateľná anonymne.
