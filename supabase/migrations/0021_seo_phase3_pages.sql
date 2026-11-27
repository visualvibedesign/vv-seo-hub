-- 0021 · Phase 3: pages (codes, types, parents, keep / improve / new, hotspots, target URL), the client's site
-- structure, redirects queue, BrandScript, page briefs, and Claude draft kinds. Nov 28, 2026.
-- DRAFT: Angel runs it in the Supabase SQL Editor after review.
--
-- Only adds columns, tables, indexes, triggers and widens one check. Nothing is deleted or changed in existing rows,
-- except: seo_clients gets site_structure = 'service_first' (the default) on its 1 existing row.
-- The 9 existing pages keep every value; their new columns start empty (the backfill is a separate repair action
-- with a dry run in the app, not SQL here). RLS on every new table, no policies: server only, like the others.

begin;

-- ---- Pages: code, type, parent, keep / improve / new, hotspots, target URL ------------------------------------
alter table public.seo_pages
  add column if not exists page_code        text check (page_code is null or page_code ~ '^P[0-9]{1,3}$'),
  add column if not exists page_type        text check (page_type is null or page_type in ('home', 'service', 'location', 'supporting')),
  add column if not exists parent_id        uuid references public.seo_pages (id) on delete set null,
  add column if not exists page_action      text check (page_action is null or page_action in ('keep', 'improve', 'new')),
  add column if not exists seo_title        text check (seo_title is null or char_length(seo_title) <= 120),
  add column if not exists meta_description text check (meta_description is null or char_length(meta_description) <= 320),
  add column if not exists h1               text check (h1 is null or char_length(h1) <= 160),
  add column if not exists url_target       text check (url_target is null or char_length(url_target) <= 300),
  add column if not exists hotspots_at      timestamptz;
create index if not exists seo_pages_parent on public.seo_pages (parent_id);
create unique index if not exists seo_pages_code on public.seo_pages (client_id, page_code) where page_code is not null;

-- ---- Site structure, once per client (Sam: service first is the most common) ----------------------------------
alter table public.seo_clients
  add column if not exists site_structure text not null default 'service_first'
    check (site_structure in ('service_first', 'location_first', 'flat'));

-- ---- Redirects queue: old → new when a live page's URL changes (sent to the site later, phase 5) ---------------
create table if not exists public.seo_redirects (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  page_id    uuid references public.seo_pages (id) on delete set null,
  old_url    text not null check (char_length(old_url) between 1 and 300),
  new_url    text not null check (char_length(new_url) between 1 and 300),
  why        text check (why is null or char_length(why) <= 200),
  status     text not null default 'queued' check (status in ('queued', 'sent', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seo_redirects_client on public.seo_redirects (client_id, status);
create index if not exists seo_redirects_page on public.seo_redirects (page_id);
alter table public.seo_redirects enable row level security;

-- ---- BrandScript: one per client, A–P answers as written ---------------------------------------------------------
create table if not exists public.seo_brandscripts (
  client_id    uuid primary key references public.seo_clients (id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.seo_brandscripts enable row level security;

-- ---- Page brief: one per page (Day 5 worksheet fields + V1 / V2 copy sections) ----------------------------------
create table if not exists public.seo_page_briefs (
  page_id    uuid primary key references public.seo_pages (id) on delete cascade,
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  version    text not null default 'v1' check (version in ('v1', 'v2')),
  worksheet  jsonb not null default '{}'::jsonb,
  sections   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists seo_page_briefs_client on public.seo_page_briefs (client_id);
alter table public.seo_page_briefs enable row level security;

-- ---- updated_at triggers (same helper as the other tables) ---------------------------------------------------------
drop trigger if exists seo_redirects_touch on public.seo_redirects;
create trigger seo_redirects_touch before update on public.seo_redirects for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_brandscripts_touch on public.seo_brandscripts;
create trigger seo_brandscripts_touch before update on public.seo_brandscripts for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_page_briefs_touch on public.seo_page_briefs;
create trigger seo_page_briefs_touch before update on public.seo_page_briefs for each row execute function public.seo_touch_updated_at();

-- ---- Claude drafts saved as "Ready to review" (+ hotspots, brandscript, page_copy) ---------------------------------
alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope',
  'matrix', 'clusters', 'gbp_screenshot', 'map_screenshot',
  'hotspots', 'brandscript', 'page_copy'
));

commit;
