-- Stály stĺpec pre URL fotky zamestnanca (ukladá sa do Supabase Storage, tu len odkaz).
alter table public.employees
  add column if not exists photo_url text;

-- Bucket pre fotky zamestnancov (verejné čítanie, upload len pre prihlásených).
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- Povoliť prihláseným používateľom nahrávať / prepisovať / mazať v buckete.
drop policy if exists "employee-photos insert" on storage.objects;
create policy "employee-photos insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'employee-photos');

drop policy if exists "employee-photos update" on storage.objects;
create policy "employee-photos update"
on storage.objects for update to authenticated
using (bucket_id = 'employee-photos');

drop policy if exists "employee-photos delete" on storage.objects;
create policy "employee-photos delete"
on storage.objects for delete to authenticated
using (bucket_id = 'employee-photos');
