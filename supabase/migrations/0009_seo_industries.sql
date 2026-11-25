-- SEO Hub: industries become a list Angel adds to from Templates (instead of a fixed check), plus brand words.
--   seo_industries        = one row per industry (key, label, hint). The 4 current ones are added as built-ins.
--   seo_clients.industry  \  the fixed CHECK lists are replaced by a foreign key to seo_industries(key):
--   seo_templates.industry/  any industry in the list is allowed; one that's in use can't be deleted.
--   seo_clients.brand_words = the client's own brand words (e.g. "anassa"): never treated as a competitor or
--                             off-topic. Empty = the business name and site domain are used.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. Rows changed: +4 in seo_industries (first run only). Existing
-- industry values (1 client + 7 templates, all 'waxing_beauty'; 7 templates null) stay as they are.

begin;

create table if not exists public.seo_industries (
  key        text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  label      text not null check (char_length(label) between 1 and 60),
  hint       text check (char_length(hint) <= 200),
  sort       integer not null default 100,
  built_in   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.seo_industries enable row level security;  -- server only (service key), no policies

insert into public.seo_industries (key, label, hint, sort, built_in) values
  ('waxing_beauty', 'Waxing & beauty salon', 'Waxing, brows, lashes, facials.', 10, true),
  ('med_spa', 'Med spa', 'Injectables, laser, skin treatments.', 20, true),
  ('home_services', 'Home services', 'Contractors, cleaning, repairs, service-area businesses.', 30, true),
  ('blank', 'Blank', 'Start from the generic templates.', 999, true)
on conflict (key) do nothing;

alter table public.seo_clients drop constraint if exists seo_clients_industry_check;
alter table public.seo_clients drop constraint if exists seo_clients_industry_fkey;
alter table public.seo_clients add constraint seo_clients_industry_fkey
  foreign key (industry) references public.seo_industries (key) on update cascade on delete restrict;

alter table public.seo_templates drop constraint if exists seo_templates_industry_check;
alter table public.seo_templates drop constraint if exists seo_templates_industry_fkey;
alter table public.seo_templates add constraint seo_templates_industry_fkey
  foreign key (industry) references public.seo_industries (key) on update cascade on delete restrict;

alter table public.seo_clients add column if not exists brand_words text[] not null default '{}';

commit;
