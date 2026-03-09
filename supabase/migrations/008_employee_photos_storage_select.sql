-- SELECT pre bucket employee-photos: potrebné pre upsert (kontrola existencie pred update).
-- Bez tejto politiky môže upsert zlyhať alebo iné operácie.
drop policy if exists "employee-photos select" on storage.objects;
create policy "employee-photos select"
on storage.objects for select to authenticated
using (bucket_id = 'employee-photos');
