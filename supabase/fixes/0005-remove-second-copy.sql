-- Fix: 0005 ran twice, so there are 2 identical sets of the 7 "Waxing & beauty salon" templates (14 instead of 7).
-- This removes the NEWER set and keeps the first one. Their lines go with them (on delete cascade).
-- Safe: only touches templates with industry = 'waxing_beauty' that are not built in, only the extra copy of each
-- kind, and never one that was applied to a client (none are, Nov 25). Generic templates are not touched.
-- Run in Supabase → SQL Editor. Safe to re-run: when there's only one set left it deletes nothing.

-- 1. Look first (read-only): which rows would go?
select t.id, t.kind, t.name, t.created_at
from public.seo_templates t
where t.industry = 'waxing_beauty'
  and not t.built_in
  and t.id not in (
    select distinct on (kind) id
    from public.seo_templates
    where industry = 'waxing_beauty' and not built_in
    order by kind, created_at, id          -- keep the oldest of each kind
  )
  and not exists (select 1 from public.seo_client_templates c where c.template_id = t.id)
order by t.kind;

-- 2. Then delete them (run this part after checking step 1 shows 7 rows).
begin;
delete from public.seo_templates t
where t.industry = 'waxing_beauty'
  and not t.built_in
  and t.id not in (
    select distinct on (kind) id
    from public.seo_templates
    where industry = 'waxing_beauty' and not built_in
    order by kind, created_at, id
  )
  and not exists (select 1 from public.seo_client_templates c where c.template_id = t.id);
commit;

-- 3. Check (read-only): expect 14 templates (7 generic + 7 waxing) and one of each kind per industry.
select coalesce(industry, 'all') as industry, kind, count(*) from public.seo_templates group by 1, 2 order by 1, 2;
