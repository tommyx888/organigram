-- Nastavenia verejného exportu: ktoré oddelenia a aké polia na kartách.
alter table public.org_share_links
  add column if not exists export_departments jsonb;

alter table public.org_share_links
  add column if not exists card_fields jsonb;

comment on column public.org_share_links.export_departments is
  'null = všetky; pole kódov stredísk + __leadership__ pre vedenie.';

comment on column public.org_share_links.card_fields is
  'Ktoré údaje zobraziť na kartách: photo, name, position, department, typeLabel.';
