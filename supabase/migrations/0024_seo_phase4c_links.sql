-- 0024 · Phase 4c: Links (Sam Days 8–9). Nov 29, 2026.
-- DRAFT: Angel runs it in the Supabase SQL Editor after review.
--
-- New tables only (+ two widened checks on seo_imports). Nothing existing is changed or deleted; 0 rows affected.
-- RLS on every new table, no policies: server only, like the other seo_ tables.
-- Numbers (Domain Authority, Authority Score, matches) are kept exactly as exported / typed; missing = null.
-- Privacy: no address column anywhere (the client's hidden address is never used on any listing).

begin;

-- ---- Per-client link settings: weekly pace, citation wave start, sponsorship budget -----------------------------
create table if not exists public.seo_link_settings (
  client_id           uuid primary key references public.seo_clients (id) on delete cascade,
  weekly_pace         smallint check (weekly_pace is null or weekly_pace between 1 and 20),   -- Sam: 2–10 a week
  citation_start_week smallint not null default 6 check (citation_start_week between 1 and 52), -- wave 1 ~ week 6
  wave1_started_on    date,
  wave2_started_on    date,
  wave3_started_on    date,
  sponsor_budget      text check (sponsor_budget is null or char_length(sponsor_budget) <= 40),  -- e.g. "$500 / year"
  updated_at          timestamptz not null default now()
);
alter table public.seo_link_settings enable row level security;

-- ---- Day 8 · Citations (BrightLocal list, numbered in list order → wave by row: 1,4,7… / 2,5,8… / 3,6,9…) ----------
create table if not exists public.seo_citations (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.seo_clients (id) on delete cascade,
  row_no            smallint check (row_no is null or row_no between 1 and 500),  -- null = aggregator row (YP network)
  wave              smallint not null check (wave between 1 and 3),
  name              text not null check (char_length(name) between 1 and 120),
  domain            text check (domain is null or char_length(domain) <= 200),
  domain_authority  smallint check (domain_authority is null or domain_authority between 0 and 100),  -- as exported
  verification      text check (verification is null or char_length(verification) <= 120),
  owner             text not null default 'brightlocal' check (owner in ('brightlocal', 'me')),
  status            text not null default 'planned' check (status in ('planned', 'submitted', 'live')),
  live_url          text check (live_url is null or char_length(live_url) <= 500),
  note              text check (note is null or char_length(note) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists seo_citations_row on public.seo_citations (client_id, row_no) where row_no is not null;
create unique index if not exists seo_citations_domain on public.seo_citations (client_id, lower(domain)) where row_no is not null and domain is not null;
create index if not exists seo_citations_client on public.seo_citations (client_id, wave, row_no);
alter table public.seo_citations enable row level security;

-- ---- Day 9 · Semrush Backlink Gap rows (root domain, up to 4 competitors C1–C4) -----------------------------------
create table if not exists public.seo_backlink_gap (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.seo_clients (id) on delete cascade,
  import_id       uuid references public.seo_imports (id) on delete set null,
  domain          text not null check (char_length(domain) between 1 and 200),
  authority_score smallint check (authority_score is null or authority_score between 0 and 100),   -- as exported
  matches         smallint check (matches is null or matches between 0 and 5),                       -- e.g. 4 (of 5)
  matches_of      smallint check (matches_of is null or matches_of between 1 and 5),
  competitors     text[] not null default '{}',                                                       -- 'C1'…'C4'
  skipped         boolean not null default false,                                                     -- spam / not relevant
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists seo_backlink_gap_domain on public.seo_backlink_gap (client_id, lower(domain));
alter table public.seo_backlink_gap enable row level security;

-- ---- Day 9 · Opportunity list (bring to Day 10). Sent / Approved / Live stay separate. -------------------------
create table if not exists public.seo_link_opportunities (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.seo_clients (id) on delete cascade,
  row_no             smallint not null check (row_no between 1 and 999),
  page_url           text check (page_url is null or char_length(page_url) <= 500),      -- the exact page
  domain             text not null check (char_length(domain) between 1 and 200),
  found_via          text[] not null default '{}' check (found_via <@ array['R', 'S', 'C', 'Cit', 'Sp']::text[]),
  authority_score    smallint check (authority_score is null or authority_score between 0 and 100),
  competitor_matches smallint check (competitor_matches is null or competitor_matches between 0 and 5),
  why                text check (why is null or char_length(why) <= 300),
  how                text check (how is null or how in ('claim', 'apply', 'contact', 'join', 'other')),
  cost               text check (cost is null or char_length(cost) <= 60),               -- as typed, e.g. "$275/yr"
  next_action        text check (next_action is null or char_length(next_action) <= 200),
  next_action_on     date,
  this_week          boolean not null default false,
  sent               boolean not null default false,
  approved           boolean not null default false,
  live               boolean not null default false,
  live_checked_on    date,                                                               -- Live = link clicked + checked
  note               text check (note is null or char_length(note) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (client_id, row_no),
  check (not live or live_checked_on is not null)
);
create index if not exists seo_link_opportunities_domain on public.seo_link_opportunities (client_id, lower(domain));
alter table public.seo_link_opportunities enable row level security;

-- ---- Day 9 · Premier relationships (chamber, trade groups, certifications, partners, vendors, organizations) ----
create table if not exists public.seo_premier_links (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.seo_clients (id) on delete cascade,
  kind           text not null check (kind in ('chamber', 'trade_group', 'certification', 'referral_partner', 'vendor', 'organization', 'editorial')),
  name           text not null check (char_length(name) between 1 and 120),
  page_or_route  text check (page_or_route is null or char_length(page_or_route) <= 300),
  next_action    text check (next_action is null or char_length(next_action) <= 200),
  next_action_on date,
  sort           smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists seo_premier_links_client on public.seo_premier_links (client_id, kind, sort);
alter table public.seo_premier_links enable row level security;

-- ---- Day 9 · Sponsorships (pick 2–3) ------------------------------------------------------------------------------
create table if not exists public.seo_sponsorships (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.seo_clients (id) on delete cascade,
  cause          text not null check (char_length(cause) between 1 and 120),
  tier_cost      text check (tier_cost is null or char_length(tier_cost) <= 80),
  why            text check (why is null or char_length(why) <= 300),
  page_public    boolean,
  on_main_site   boolean,
  stays_up       text check (stays_up is null or char_length(stays_up) <= 60),      -- e.g. "1 year"
  shows          text[] not null default '{}' check (shows <@ array['name', 'logo', 'profile', 'link']::text[]),
  status         text not null default 'considering' check (status in ('considering', 'committed', 'done')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.seo_sponsorships enable row level security;

-- ---- Day 9 · SERP searches log (customer-style + lister-style) ----------------------------------------------------
create table if not exists public.seo_serp_searches (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  search     text not null check (char_length(search) between 1 and 200),
  style      text not null check (style in ('customer', 'lister')),
  run_on     date,
  found      text check (found is null or char_length(found) <= 300),     -- promising pages / opportunity row #s
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.seo_serp_searches enable row level security;

-- ---- Authority checks typed in (month 3 / 6 / 9 / 12) ---------------------------------------------------------
create table if not exists public.seo_authority_checks (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.seo_clients (id) on delete cascade,
  checked_on        date not null,
  month_mark        smallint check (month_mark is null or month_mark in (3, 6, 9, 12)),
  authority_score   smallint check (authority_score is null or authority_score between 0 and 100),
  referring_domains integer check (referring_domains is null or referring_domains >= 0),
  backlinks         integer check (backlinks is null or backlinks >= 0),
  note              text check (note is null or char_length(note) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (client_id, checked_on)
);
alter table public.seo_authority_checks enable row level security;

-- ---- updated_at triggers -------------------------------------------------------------------------------------------
drop trigger if exists seo_link_settings_touch on public.seo_link_settings;
create trigger seo_link_settings_touch before update on public.seo_link_settings for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_citations_touch on public.seo_citations;
create trigger seo_citations_touch before update on public.seo_citations for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_backlink_gap_touch on public.seo_backlink_gap;
create trigger seo_backlink_gap_touch before update on public.seo_backlink_gap for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_link_opportunities_touch on public.seo_link_opportunities;
create trigger seo_link_opportunities_touch before update on public.seo_link_opportunities for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_premier_links_touch on public.seo_premier_links;
create trigger seo_premier_links_touch before update on public.seo_premier_links for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_sponsorships_touch on public.seo_sponsorships;
create trigger seo_sponsorships_touch before update on public.seo_sponsorships for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_serp_searches_touch on public.seo_serp_searches;
create trigger seo_serp_searches_touch before update on public.seo_serp_searches for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_authority_checks_touch on public.seo_authority_checks;
create trigger seo_authority_checks_touch before update on public.seo_authority_checks for each row execute function public.seo_touch_updated_at();

-- ---- Imports: the BrightLocal citation list + Semrush Backlink Gap CSV (raw file kept, like every import) ---------
alter table public.seo_imports drop constraint if exists seo_imports_report_check;
alter table public.seo_imports add constraint seo_imports_report_check
  check (report in ('kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap', 'master_db', 'clusters',
                    'sams_guide', 'competitors', 'client_sheet', 'position_tracking', 'whitespark_grid',
                    'brightlocal_citations', 'backlink_gap'));
alter table public.seo_imports drop constraint if exists seo_imports_source_check;
alter table public.seo_imports add constraint seo_imports_source_check check (source in ('kp', 'semrush', 'sheet', 'whitespark', 'brightlocal'));

commit;
