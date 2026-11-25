-- SEO Hub, redesign step 5: templates (design docs/design/Templates.png + TemplateEditor.png).
-- Run once: Supabase → SQL Editor → New query → paste → Run.
--
-- Safe for HQ's live database:
--   * Only CREATES 3 new tables and seeds the 7 built-in templates. Nothing existing is changed or dropped.
--   * RLS on, no policies (server-only), same as 0001.
--
-- How it's used:
--   * seo_templates: one template per step of Sam's 10 days. industry = null → all industries; or one of
--     waxing_beauty / med_spa / home_services / blank (an industry version, made in the editor).
--   * seo_template_items: the template's lines, in order. kind:
--       pattern = text with variables {service} {city} {st} {state} {brand}, filled per client
--       word    = a word list entry (group: money / faq), e.g. "price"
--       rule    = a rule to follow (shown, never auto-applied to numbers)
--       export  = a file to export (where + settings)
--       text    = free text (e.g. email parts, post topics)
--   * seo_client_templates: what was applied to a client, as a COPY (snapshot). Editing a template later never
--     changes clients it was already applied to.
--   * The 7 built-ins are generic (industry = null). Industry versions are made in the editor, not invented here.

begin;

create table public.seo_templates (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('keyword_research', 'matrix', 'clusters', 'hotspots', 'gbp_posts', 'review_email', 'citation_waves')),
  name         text not null,
  sam_step     smallint not null check (sam_step between 0 and 8),   -- guide step (src/lib/guide.ts): 1 = Day 2 …
  industry     text check (industry in ('waxing_beauty', 'med_spa', 'home_services', 'blank')),
  description  text not null default '',
  built_in     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index seo_templates_builtin_kind on public.seo_templates (kind) where built_in;

create table public.seo_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.seo_templates (id) on delete cascade,
  sort         smallint not null default 0,
  kind         text not null check (kind in ('pattern', 'word', 'rule', 'export', 'text')),
  word_group   text check (word_group in ('money', 'faq')),
  body         text not null check (length(body) between 1 and 500)
);
create index seo_template_items_template on public.seo_template_items (template_id, sort);

create table public.seo_client_templates (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  template_id  uuid references public.seo_templates (id) on delete set null,  -- the copy stays if the template is deleted
  kind         text not null,
  name         text not null,
  snapshot     jsonb not null,            -- the template + items exactly as applied
  applied_at   timestamptz not null default now()
);
create index seo_client_templates_client on public.seo_client_templates (client_id);

create trigger seo_templates_touch before update on public.seo_templates
  for each row execute function public.seo_touch_updated_at();

alter table public.seo_templates        enable row level security;
alter table public.seo_template_items   enable row level security;
alter table public.seo_client_templates enable row level security;

-- ---- The 7 built-in templates (generic, from Sam's playbook + the design) -------------------------
with t as (
  insert into public.seo_templates (kind, name, sam_step, description, built_in) values
    ('keyword_research', 'Keyword research',     1, 'Seed patterns for every service × area, the sources to export and Sam’s keyword rules.', true),
    ('matrix',           '3×3 matrix',           1, 'Home + S1–S3 rows, A1–A3 columns, one primary per cell plus backups.', true),
    ('clusters',         'Clusters',             1, 'One row per page: primary, secondaries, FAQ ideas and a priority.', true),
    ('hotspots',         'SEO hotspots',         4, 'Title, meta, H1 and URL patterns with live character counters.', true),
    ('gbp_posts',        'GBP 13-week posts',    6, 'A quarter of weekly posts: intro, each service, a project, the team, a call to action.', true),
    ('review_email',     'Review request email', 6, 'Thank you, the ask, the review link and QR code, then one follow-up.', true),
    ('citation_waves',   'Citation waves',       7, 'Split the BrightLocal list into 3 waves so each wave gets high, medium and low sites.', true)
  returning id, kind
)
insert into public.seo_template_items (template_id, sort, kind, word_group, body)
select t.id, i.sort, i.item_kind, i.word_group, i.body
from t
join (values
  -- Keyword research
  ('keyword_research', 1,  'pattern', null,    '{service} {city}'),
  ('keyword_research', 2,  'pattern', null,    '{service} {city} {st}'),
  ('keyword_research', 3,  'pattern', null,    '{service} near me'),
  ('keyword_research', 4,  'pattern', null,    '{service} cost'),
  ('keyword_research', 5,  'pattern', null,    'best {service} {city}'),
  ('keyword_research', 6,  'word',    'money', 'price'),
  ('keyword_research', 7,  'word',    'money', 'cost'),
  ('keyword_research', 8,  'word',    'money', 'deals'),
  ('keyword_research', 9,  'word',    'money', 'best'),
  ('keyword_research', 10, 'word',    'faq',   'how long'),
  ('keyword_research', 11, 'word',    'faq',   'vs'),
  ('keyword_research', 12, 'word',    'faq',   'first time'),
  ('keyword_research', 13, 'export',  null,    'Keyword Planner: Discover new keywords, location = A1 (the client''s city), download CSV'),
  ('keyword_research', 14, 'export',  null,    'Semrush Keyword Magic: one per service, database US, Include keywords = the city, export CSV'),
  ('keyword_research', 15, 'rule',    null,    'Volumes exactly as exported: KP ranges stay ranges, never the 50/500 stand-ins'),
  ('keyword_research', 16, 'rule',    null,    'Only exact duplicates are removed; keep sources and cities separate'),
  -- 3×3 matrix
  ('matrix', 1, 'rule', null, 'Rows: Home + S1–S3 (the 3 main service categories). Columns: A1–A3 (the top 3 areas)'),
  ('matrix', 2, 'rule', null, 'One primary keyword per cell, plus backups'),
  ('matrix', 3, 'rule', null, 'Every primary traces to a source (KP or Semrush)'),
  ('matrix', 4, 'rule', null, 'N/A and Pending are allowed; generic "near me" terms aren''t page targets'),
  -- Clusters
  ('clusters', 1, 'rule', null, 'One row per page: primary keyword, secondary keywords, FAQ ideas, priority (High / Medium / Low), why'),
  ('clusters', 2, 'rule', null, 'A keyword sits on one page only'),
  ('clusters', 3, 'rule', null, 'High = the main page of each category with the most local searches; Low = no local search data yet'),
  -- SEO hotspots
  ('hotspots', 1, 'pattern', null, '{service} in {city}, {state} | [Trust signal]'),
  ('hotspots', 2, 'pattern', null, '{service} in {city}, {st}'),
  ('hotspots', 3, 'pattern', null, '/{service}-{city}-{st}/'),
  ('hotspots', 4, 'rule',    null, 'SEO title 50–60 characters; primary phrase near the start; full state name in titles'),
  ('hotspots', 5, 'rule',    null, 'Meta description 150–160 characters, ending with a call to action'),
  ('hotspots', 6, 'rule',    null, 'State abbreviation in URLs; keep sensible existing URLs (a changed URL goes to the redirects queue)'),
  ('hotspots', 7, 'rule',    null, 'Only real facts; [brackets] for anything unconfirmed'),
  -- GBP 13-week posts
  ('gbp_posts', 1, 'text', null, 'Week 1: meet {brand}'),
  ('gbp_posts', 2, 'text', null, 'Next weeks: one post per service ({service} in {city}), area 1 first'),
  ('gbp_posts', 3, 'text', null, 'Then: a real project or appointment, the team, a call to action (book)'),
  ('gbp_posts', 4, 'text', null, 'Repeat the cycle for area 2, 3 until 13 weeks are planned'),
  ('gbp_posts', 5, 'rule', null, 'Image 1200×900, real photos; "Learn more" button to the service page with a UTM link'),
  ('gbp_posts', 6, 'rule', null, 'Next quarter: give the last quarter''s posts so nothing repeats'),
  -- Review request email
  ('review_email', 1, 'text', null, 'Thank you for visiting {brand}'),
  ('review_email', 2, 'text', null, 'The ask: a short review helps others in {city} find us'),
  ('review_email', 3, 'text', null, 'Review link + QR code'),
  ('review_email', 4, 'text', null, 'Tips: mention the service and {city}'),
  ('review_email', 5, 'rule', null, 'One follow-up after 1–3 days, never more; never pay for reviews'),
  ('review_email', 6, 'rule', null, 'Tracker keeps only customer ref, date, channel and result'),
  -- Citation waves
  ('citation_waves', 1, 'rule', null, 'Wave 1 = rows 1, 4, 7…; wave 2 = rows 2, 5, 8…; wave 3 = rows 3, 6, 9…'),
  ('citation_waves', 2, 'rule', null, '~25 sites + the YP network per wave; next wave when the last one is done (~30–40 days)'),
  ('citation_waves', 3, 'rule', null, 'NAP identical everywhere; hide the address for home and service-area businesses'),
  ('citation_waves', 4, 'rule', null, 'Untick listings the client already has (Google, Yelp, Facebook); never buy the directories'' upsells')
) as i(kind, sort, item_kind, word_group, body) on i.kind = t.kind;

commit;
