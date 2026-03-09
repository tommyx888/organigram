-- Nastaviť účet tomas.ficek01@gmail.com ako admin (v user_company_roles).
-- Ak používateľ ešte neexistuje v auth.users, migrácia nič nevloží;
-- po prvom prihlásení spustite tento blok znova v SQL Editore alebo znova aplikujte migráciu.

-- Zabezpečiť aspoň jednu company (pre väzbu role).
insert into public.companies (id, code, name)
select uuid_generate_v4(), 'default', 'Default Company'
where not exists (select 1 from public.companies limit 1);

insert into public.user_company_roles (user_id, company_id, role)
select u.id, c.id, 'admin'::public.app_role
from auth.users u
cross join (
  select id from public.companies order by created_at asc limit 1
) c
where lower(u.email) = lower('tomas.ficek01@gmail.com')
on conflict (user_id, company_id) do update set role = 'admin'::public.app_role;
