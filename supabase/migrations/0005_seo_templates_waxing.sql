-- SEO Hub, redesign step 5: the "Waxing & beauty salon" industry version of the 7 templates (Angel, Nov 25).
-- Run once, after 0004: Supabase → SQL Editor → New query → paste → Run.
--
-- Safe for HQ's live database:
--   * Widens one check on seo_template_items (a table made in 0004, no client data) to allow a 'service' word group.
--   * ADDS 7 templates (industry = waxing_beauty) + their lines. Nothing existing is changed or deleted.
--
-- What the industry version is:
--   * A copy of each generic built-in template (same lines), plus:
--   * FAQ word "aftercare".
--   * Money words found in Anassa's real keywords (Nov 25 count): prices (4), specials (1), how much (1)
--     on top of the generic price / cost / deals / best (all found too).
--   * Service words: service terms that appear in Anassa's real keywords (count in brackets). Nothing invented.

begin;

alter table public.seo_template_items drop constraint seo_template_items_word_group_check;
alter table public.seo_template_items add constraint seo_template_items_word_group_check check (word_group in ('money', 'faq', 'service'));

with copies as (
  insert into public.seo_templates (kind, name, sam_step, industry, description, built_in)
  select kind, name || ' · Waxing & beauty salon', sam_step, 'waxing_beauty', description, false
  from public.seo_templates
  where built_in
  returning id, kind
),
-- 1. every generic line, copied
copied as (
  insert into public.seo_template_items (template_id, sort, kind, word_group, body)
  select c.id, i.sort, i.kind, i.word_group, i.body
  from copies c
  join public.seo_templates g on g.kind = c.kind and g.built_in
  join public.seo_template_items i on i.template_id = g.id
  returning template_id
)
-- 2. the waxing extras (keyword research only)
insert into public.seo_template_items (template_id, sort, kind, word_group, body)
select c.id, x.sort, 'word', x.word_group, x.body
from copies c
join (values
  (101, 'faq',     'aftercare'),
  (110, 'money',   'prices'),        -- 4 keywords
  (111, 'money',   'specials'),      -- 1
  (112, 'money',   'how much'),      -- 1
  (120, 'service', 'brazilian'),     -- 50
  (121, 'service', 'bikini'),        -- 31
  (122, 'service', 'bikini line'),   -- 3
  (123, 'service', 'full bikini'),   -- 3
  (124, 'service', 'brow lamination'),     -- 12
  (125, 'service', 'eyebrow lamination'),  -- 8
  (126, 'service', 'eyebrow tinting'),     -- 6
  (127, 'service', 'eyebrow tint'),        -- 5
  (128, 'service', 'brow tint'),           -- 4
  (129, 'service', 'eyebrow waxing'),      -- 9
  (130, 'service', 'brow wax'),            -- 7
  (131, 'service', 'facial waxing'),       -- 3
  (132, 'service', 'face waxing'),         -- 3
  (133, 'service', 'upper lip'),           -- 3
  (134, 'service', 'lip wax'),             -- 4
  (135, 'service', 'chin'),                -- 1
  (136, 'service', 'nose'),                -- 1
  (137, 'service', 'neck'),                -- 1
  (138, 'service', 'body waxing'),         -- 7
  (139, 'service', 'body wax'),            -- 12
  (140, 'service', 'leg waxing'),          -- 5
  (141, 'service', 'leg wax'),             -- 8
  (142, 'service', 'arm waxing'),          -- 1
  (143, 'service', 'back waxing'),         -- 1
  (144, 'service', 'underarm waxing'),     -- 1
  (145, 'service', 'armpit')               -- 1
) as x(sort, word_group, body) on c.kind = 'keyword_research';

commit;
