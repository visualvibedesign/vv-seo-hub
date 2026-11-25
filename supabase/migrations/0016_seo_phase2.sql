-- SEO Hub, phase 2 (docs/phase-2-plan.md): Google numbers (Search Console + GA4), Semrush rankings, map grid, GBP,
-- baseline (Day 3) and monthly results (Day 10 + monthly). DRAFT: not run yet. Show Angel first.
-- Rules: numbers exactly as the source gives them; a missing day / position is NULL / no row, never 0; no address
-- anywhere (map grid centre = a town or area name); Google access lives server-side (env), never in these tables.
-- Every table: RLS on, no policies (server only, service key); cascades with the client.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN ("if not exists" / drop-and-add checks). No existing rows change.

begin;

-- ---- Google: which Search Console + GA4 property each client uses -----------------------------------------
create table if not exists public.seo_google_links (
  client_id       uuid primary key references public.seo_clients (id) on delete cascade,
  gsc_property    text check (gsc_property is null or gsc_property ~ '^(sc-domain:[a-z0-9.-]+|https://[^\s]+)$'),
  ga4_property    text check (ga4_property is null or ga4_property ~ '^properties/[0-9]+$'),
  gsc_query_words text[] not null default '{}',             -- city + service words for the "local searches" view
  last_sync_at    timestamptz,
  last_sync_ok    boolean,
  last_error      text check (last_error is null or char_length(last_error) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.seo_google_links enable row level security;

-- ---- Daily numbers from Google, exactly as returned (a missing day = no row) ---------------------------------
create table if not exists public.seo_metric_daily (
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  source     text not null check (source in ('gsc', 'ga4')),
  metric     text not null check (metric in ('clicks', 'impressions', 'ctr', 'position', 'sessions', 'engaged_sessions', 'users', 'key_events', 'avg_engagement_sec')),
  day        date not null,
  value      numeric not null,
  pulled_at  timestamptz not null default now(),
  primary key (client_id, source, metric, day)
);
alter table public.seo_metric_daily enable row level security;

-- ---- Top searches / top pages per period (Search Console) ----------------------------------------------------
create table if not exists public.seo_metric_top (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  dimension    text not null check (dimension in ('query', 'page')),
  period_from  date not null,
  period_to    date not null check (period_to >= period_from),
  label        text not null check (char_length(label) between 1 and 500),
  clicks       integer not null check (clicks >= 0),
  impressions  integer not null check (impressions >= 0),
  ctr          numeric,
  position     numeric,
  unique (client_id, dimension, period_from, period_to, label)
);
alter table public.seo_metric_top enable row level security;

-- ---- Semrush Position Tracking CSV: one row per keyword per date (position empty = not in the top 100) -----
create table if not exists public.seo_rank_snapshots (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  import_id    uuid not null references public.seo_imports (id) on delete cascade,
  keyword_id   uuid references public.seo_keywords (id) on delete set null,
  keyword      text not null check (char_length(keyword) between 1 and 200),
  keyword_key  text not null,
  checked_on   date not null,
  position     smallint check (position is null or position between 1 and 100),
  landing_url  text check (landing_url is null or char_length(landing_url) <= 500),
  visibility   numeric,
  created_at   timestamptz not null default now(),
  unique (client_id, keyword_key, checked_on)
);
create index if not exists seo_rank_snapshots_client_day on public.seo_rank_snapshots (client_id, checked_on desc);
alter table public.seo_rank_snapshots enable row level security;

-- ---- Whitespark map grid (CSV, typed, or later a screenshot) ---------------------------------------------------
create table if not exists public.seo_map_grids (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.seo_clients (id) on delete cascade,
  import_id     uuid references public.seo_imports (id) on delete cascade,
  keyword       text not null check (char_length(keyword) between 1 and 200),
  scanned_on    date not null,
  grid_size     smallint not null check (grid_size between 3 and 15),
  spacing       text check (spacing is null or char_length(spacing) <= 40),          -- "1.2 mi"
  center_label  text check (center_label is null or char_length(center_label) <= 80), -- a town / area, never an address
  source        text not null check (source in ('csv', 'typed', 'screenshot')),
  created_at    timestamptz not null default now()
);
alter table public.seo_map_grids enable row level security;

create table if not exists public.seo_map_grid_points (
  grid_id  uuid not null references public.seo_map_grids (id) on delete cascade,
  row_no   smallint not null check (row_no >= 0),
  col_no   smallint not null check (col_no >= 0),
  rank     smallint check (rank is null or rank between 1 and 100),                    -- empty = not found
  primary key (grid_id, row_no, col_no)
);
alter table public.seo_map_grid_points enable row level security;

-- ---- GBP numbers, typed in per period --------------------------------------------------------------------------
create table if not exists public.seo_gbp_snapshots (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.seo_clients (id) on delete cascade,
  period_from      date not null,
  period_to        date not null check (period_to >= period_from),
  views            integer check (views is null or views >= 0),
  calls            integer check (calls is null or calls >= 0),
  directions       integer check (directions is null or directions >= 0),
  website_clicks   integer check (website_clicks is null or website_clicks >= 0),
  reviews          integer check (reviews is null or reviews >= 0),
  rating           numeric(2, 1) check (rating is null or rating between 1 and 5),
  newest_review_on date,
  typed_by         text check (typed_by is null or char_length(typed_by) <= 60),
  note             text check (note is null or char_length(note) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (client_id, period_from, period_to)
);
alter table public.seo_gbp_snapshots enable row level security;

-- ---- Baseline (Day 3): a frozen copy of the starting numbers, each with its own dates -----------------------
create table if not exists public.seo_baselines (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.seo_clients (id) on delete cascade,
  label       text check (label is null or char_length(label) <= 80),
  is_current  boolean not null default true,
  note        text check (note is null or char_length(note) <= 500),
  saved_at    timestamptz not null default now()
);
create unique index if not exists seo_baselines_one_current on public.seo_baselines (client_id) where is_current;
alter table public.seo_baselines enable row level security;

create table if not exists public.seo_baseline_values (
  baseline_id  uuid not null references public.seo_baselines (id) on delete cascade,
  source       text not null check (source in ('gsc', 'ga4', 'semrush', 'gbp', 'whitespark', 'site')),
  metric       text not null check (char_length(metric) between 1 and 60),
  value        numeric,                                                                -- null = missing, never 0
  value_text   text check (value_text is null or char_length(value_text) <= 60),       -- as written, e.g. "118 · ★4.8"
  date_from    date,
  date_to      date,
  primary key (baseline_id, source, metric)
);
alter table public.seo_baseline_values enable row level security;

-- ---- Results: one report per client per month (Day 10 = the first) -------------------------------------------
create table if not exists public.seo_reports (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  status       text not null default 'draft' check (status in ('draft', 'sent')),
  numbers      jsonb not null default '{}'::jsonb,                                      -- frozen copy of the month vs baseline
  notes        text check (notes is null or char_length(notes) <= 6000),                -- approved text only
  notes_draft  text check (notes_draft is null or char_length(notes_draft) <= 6000),    -- Claude draft, waiting for review
  sent_on      date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, month)
);
alter table public.seo_reports enable row level security;

create table if not exists public.seo_report_actions (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.seo_reports (id) on delete cascade,
  kind       text not null check (kind in ('page', 'gbp', 'links', 'tracking', 'other')),
  body       text not null check (char_length(body) between 1 and 300),
  owner      text check (owner is null or char_length(owner) <= 60),
  due        date,
  done       boolean not null default false,
  sort       smallint not null default 0
);
alter table public.seo_report_actions enable row level security;

-- ---- Imports: the Position Tracking CSV and Whitespark grid are imports too (raw file kept) -----------------
alter table public.seo_imports drop constraint if exists seo_imports_report_check;
alter table public.seo_imports add constraint seo_imports_report_check
  check (report in ('kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap', 'master_db', 'clusters',
                    'sams_guide', 'competitors', 'client_sheet', 'position_tracking', 'whitespark_grid'));
alter table public.seo_imports drop constraint if exists seo_imports_source_check;
alter table public.seo_imports add constraint seo_imports_source_check check (source in ('kp', 'semrush', 'sheet', 'whitespark'));

-- ---- updated_at triggers -----------------------------------------------------------------------------------
drop trigger if exists seo_google_links_touch on public.seo_google_links;
create trigger seo_google_links_touch before update on public.seo_google_links for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_gbp_snapshots_touch on public.seo_gbp_snapshots;
create trigger seo_gbp_snapshots_touch before update on public.seo_gbp_snapshots for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_reports_touch on public.seo_reports;
create trigger seo_reports_touch before update on public.seo_reports for each row execute function public.seo_touch_updated_at();

commit;
