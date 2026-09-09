-- Restore section nodes wiped from org_chart_settings.payload,
-- and copy leftover assignments from org_section_members.

insert into public.org_chart_overrides (company_id, employee_id, override_parent_id)
select distinct m.company_id, m.employee_id, m.section_id
from public.org_section_members m
where not exists (
  select 1
  from public.org_chart_overrides o
  where o.company_id = m.company_id
    and o.employee_id = m.employee_id
);

with members as (
  select override_parent_id as section_id, employee_id
  from public.org_chart_overrides
  where override_parent_id like 'section-%'
  union
  select section_id, employee_id
  from public.org_section_members
  where section_id like 'section-%'
),
cop as (
  select key as parent_id, jsonb_array_elements_text(value) as child_id
  from public.org_chart_settings,
       jsonb_each(coalesce(payload->'childOrderByParent', '{}'::jsonb))
),
nadr as (
  select distinct on (section_id)
    section_id,
    split_part(priamy_nadr, ' ', 1) as inferred_parent
  from (
    select m.section_id, e.priamy_nadr, count(*) as n
    from members m
    join public.iac_employees e on e.os_c = m.employee_id
    where nullif(btrim(e.priamy_nadr), '') is not null
    group by m.section_id, e.priamy_nadr
  ) x
  order by section_id, n desc
),
sections as (
  select
    m.section_id as id,
    coalesce(max(cop.parent_id), max(nadr.inferred_parent)) as parent_id
  from (select distinct section_id from members) m
  left join cop on cop.child_id = m.section_id
  left join nadr on nadr.section_id = m.section_id
  group by m.section_id
),
numbered as (
  select
    id,
    parent_id,
    'Sekcia ' || row_number() over (order by parent_id nulls last, id) as name
  from sections
)
update public.org_chart_settings s
set
  payload = s.payload || jsonb_build_object(
    'sectionGroups',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', n.id,
            'name', n.name,
            'parentId', n.parent_id
          )
          order by n.name
        )
        from numbered n
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
where coalesce(jsonb_typeof(s.payload->'sectionGroups'), 'null') <> 'array'
   or jsonb_array_length(s.payload->'sectionGroups') = 0;
