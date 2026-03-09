-- Tabuľka len na odkaz na fotku podľa zamestnanca (employee_id = os_c z iac_employees).
-- Načítavanie z iac_employees potom joinuje túto tabuľku a zobrazí photo_url.
create table if not exists public.employee_photo_urls (
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id text not null,
  photo_url text not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, employee_id)
);

alter table public.employee_photo_urls enable row level security;

-- RLS: používateľ vidí / mení len záznamy svojej company
create policy "employee_photo_urls company isolation"
on public.employee_photo_urls
for all
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

-- Service role (načítavanie záznamov na serveri) potrebuje čítať – použije sa service role, ktorá RLS obchádza
