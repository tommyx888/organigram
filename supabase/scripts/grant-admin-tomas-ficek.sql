-- Spustiť v Supabase Dashboard → SQL Editor (po prihlásení účtu tomas.ficek01@gmail.com).
-- Nastaví tomas.ficek01@gmail.com ako admin a pridá ho do prvej company.
-- Po spustení sa odhlás a znova prihlás, alebo obnov stránku (F5).

-- 1) Zabezpečiť aspoň jednu company
insert into public.companies (id, code, name)
select uuid_generate_v4(), 'default', 'Default Company'
where not exists (select 1 from public.companies limit 1);

-- 2) Pridať / aktualizovať rolu admin pre daný email
insert into public.user_company_roles (user_id, company_id, role)
select u.id, c.id, 'admin'::public.app_role
from auth.users u
cross join (select id from public.companies order by created_at asc limit 1) c
where lower(u.email) = lower('tomas.ficek01@gmail.com')
on conflict (user_id, company_id) do update set role = 'admin'::public.app_role;

-- 3) Kontrola (mal by byť 1 riadok)
-- select u.email, ucr.role, c.name
-- from auth.users u
-- join public.user_company_roles ucr on ucr.user_id = u.id
-- join public.companies c on c.id = ucr.company_id
-- where lower(u.email) = lower('tomas.ficek01@gmail.com');
