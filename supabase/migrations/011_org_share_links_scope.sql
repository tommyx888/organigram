-- Scope verejného náhľadu: salaried (SAL) alebo salaried + indirect.
-- Existujúce odkazy ostávajú SAL-only (default).
alter table public.org_share_links
  add column if not exists scope text not null default 'salaried';

alter table public.org_share_links
  drop constraint if exists org_share_links_scope_check;

alter table public.org_share_links
  add constraint org_share_links_scope_check
  check (scope in ('salaried', 'salaried_indirect'));

comment on column public.org_share_links.scope is
  'salaried = iba aktívni SAL; salaried_indirect = SAL + INDIR (bez DIR).';
