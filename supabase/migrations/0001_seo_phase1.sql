-- SEO Hub, phase 1: clients, keywords, imports, 3×3 matrix, clusters (docs/phase-1-plan.md §3).
-- Runs in the SAME Supabase project as Visual Vibe HQ. Run once: Supabase → SQL Editor → New query → paste → Run.
--
-- Safe for HQ's live database:
--   * Only CREATES new things, all named seo_* (tables, indexes, one function, one Storage bucket).
--   * Never alters, drops or reads HQ's tables.
--   * One transaction: if anything fails, nothing is created.
--
-- Access: row level security ON with no policies (same as HQ), so only our server (secret key) can
-- read or write. The browser never talks to Supabase.
-- Privacy: there is NO address column anywhere. Never add one (CLAUDE.md hard rule).

begin;

-- ---- updated_at helper ------------------------------------------------------
create function public.seo_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---- Clients ----------------------------------------------------------------
-- site_id = md5 of the WordPress home URL without http(s):// and www., lowercased, no trailing slash
-- (same id the Vibe SEO plugin and the agency hub use; server/utils/siteId.ts). Routes: /clients/{site_id}.
create table public.seo_clients (
  id            uuid primary key default gen_random_uuid(),
  site_id       text not null unique check (site_id ~ '^[0-9a-f]{32}$'),
  site_url      text not null,
  name          text not null,
  city          text,
  state         text,
  ideal_client  text,                 -- Day 1 kickoff answers
  usp           text,
  success_12mo  text,
  status        text not null default 'active' check (status in ('active', 'paused', 'archived')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Home + S1–S3 (matrix rows) and FAQ (help pages: cluster category only)
create table public.seo_client_categories (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  code       text not null check (code in ('Home', 'S1', 'S2', 'S3', 'FAQ')),
  name       text not null,
  in_matrix  boolean not null default true,
  sort       smallint not null default 0,
  unique (client_id, code)
);

-- Individual services under a category (Anassa S2: Eyebrow lamination, Eyebrow tint, Chin, …)
create table public.seo_client_services (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  category_id  uuid not null references public.seo_client_categories (id),
  name         text not null,
  sort         smallint not null default 0
);
create unique index seo_client_services_name_uq on public.seo_client_services (client_id, lower(name));
create index seo_client_services_category_idx on public.seo_client_services (category_id);

-- A1–A3. Anassa: A1 Staten Island, A2/A3 N/A
create table public.seo_client_areas (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  code       text not null check (code in ('A1', 'A2', 'A3')),
  name       text,
  state      text,
  status     text not null default 'active' check (status in ('active', 'n_a')),
  unique (client_id, code)
);

-- Account checklist (Day 1 inventory). Status + next action only: NEVER passwords or keys.
create table public.seo_client_accounts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  kind         text not null check (kind in ('domain_dns', 'hosting', 'platform', 'gbp', 'gsc', 'ga4', 'semrush',
                                             'whitespark', 'clarity', 'cloudflare', 'google_ads', 'ai_visibility', 'other')),
  label        text,                  -- name for 'other'
  status       text not null default 'pending' check (status in ('ready', 'pending', 'n_a')),
  next_action  text,
  note         text,
  sort         smallint not null default 0,
  updated_at   timestamptz not null default now()
);
create unique index seo_client_accounts_kind_uq on public.seo_client_accounts (client_id, kind) where kind <> 'other';

-- ---- Imports + keywords -----------------------------------------------------
-- One row per uploaded CSV. The raw file is kept untouched in Storage (bucket seo-imports).
create table public.seo_imports (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.seo_clients (id) on delete cascade,
  source        text not null check (source in ('kp', 'semrush', 'sheet')),
  report        text not null check (report in ('kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview',
                                                'keyword_gap', 'master_db', 'clusters')),
  file_name     text not null,
  storage_path  text,
  file_size     integer,
  location      text,                 -- KP location / Semrush database, e.g. 'Staten Island', 'US'
  filter        text,                 -- e.g. Semrush "Include keywords" = 'staten island'
  column_map    jsonb,
  rows_total    integer not null default 0,
  rows_added    integer not null default 0,
  rows_merged   integer not null default 0,
  rows_skipped  integer not null default 0,   -- exact duplicates
  note          text,
  created_at    timestamptz not null default now()
);
create index seo_imports_client_idx on public.seo_imports (client_id, created_at desc);

-- The master keyword database. keyword_key = trimmed, lowercase, single spaces (exact-duplicate check);
-- close variants ("brazilian wax" / "brazilian waxing") are separate rows.
-- Volumes exactly as exported: kp_volume is TEXT ('10–100', 'No data', 'Not checked'), typed in the app
-- because KP CSVs only export stand-ins. Semrush 0 stays 0; blank = null ("no data").
-- Missing-data flags are worked out when read (no stored flags to go stale).
create table public.seo_keywords (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.seo_clients (id) on delete cascade,
  keyword         text not null,
  keyword_key     text not null,
  role            text check (role in ('primary', 'secondary', 'faq', 'near_me')),
  service_id      uuid references public.seo_client_services (id) on delete set null,
  area_id         uuid references public.seo_client_areas (id) on delete set null,
  suggested       boolean not null default false,   -- "(suggested)" primary with no search data yet
  intent          text,
  kp_volume       text,
  kp_volume_by    text check (kp_volume_by in ('typed', 'sheet')),
  kp_volume_at    timestamptz,
  semrush_volume  integer check (semrush_volume >= 0),
  kd              smallint check (kd between 0 and 100),
  cpc             numeric(10, 2) check (cpc >= 0),
  track           boolean not null default false,  -- in Semrush Position Tracking (its own toggle, not tied to role)
  status          text not null default 'keep' check (status in ('keep', 'later', 'rejected')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, keyword_key),
  check (keyword_key = lower(regexp_replace(btrim(keyword), '\s+', ' ', 'g')))
);
create index seo_keywords_service_idx on public.seo_keywords (service_id);

-- Every source's values for a keyword, kept separately and exactly as exported (raw row included).
-- segment: KP location rows, e.g. 'Richmond County' (shown) and 'All' (stored, not shown).
create table public.seo_keyword_sources (
  id          uuid primary key default gen_random_uuid(),
  keyword_id  uuid not null references public.seo_keywords (id) on delete cascade,
  import_id   uuid not null references public.seo_imports (id) on delete cascade,
  source      text not null check (source in ('kp', 'semrush', 'sheet')),
  segment     text,
  volume_raw  text,                   -- as exported, e.g. '50.0' (KP stand-in), '74,000', '10–100'
  kd          smallint,
  cpc         numeric(10, 2),
  intent      text,
  raw         jsonb not null,         -- the whole CSV row
  created_at  timestamptz not null default now()
);
-- One row per keyword + segment per import (a repeated row in the same file = exact duplicate, skipped)
create unique index seo_keyword_sources_uq on public.seo_keyword_sources (import_id, keyword_id, coalesce(segment, ''));
create index seo_keyword_sources_keyword_idx on public.seo_keyword_sources (keyword_id);

-- ---- 3×3 matrix ---------------------------------------------------------------
create table public.seo_matrix_cells (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  category_id  uuid not null references public.seo_client_categories (id) on delete cascade,
  area_id      uuid not null references public.seo_client_areas (id) on delete cascade,
  state        text not null default 'pending' check (state in ('target', 'n_a', 'pending')),
  note         text,
  updated_at   timestamptz not null default now(),
  unique (category_id, area_id)
);

-- Primary (max one per cell) + backup keywords of a cell
create table public.seo_matrix_keywords (
  cell_id     uuid not null references public.seo_matrix_cells (id) on delete cascade,
  keyword_id  uuid not null references public.seo_keywords (id) on delete cascade,
  kind        text not null check (kind in ('primary', 'backup')),
  sort        smallint not null default 0,
  primary key (cell_id, keyword_id)
);
create unique index seo_matrix_keywords_one_primary on public.seo_matrix_keywords (cell_id) where kind = 'primary';
create index seo_matrix_keywords_keyword_idx on public.seo_matrix_keywords (keyword_id);

-- ---- Clusters (pages) -----------------------------------------------------------
-- Phase 3 adds hotspots (title, meta, H1…) to this table.
create table public.seo_pages (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.seo_clients (id) on delete cascade,
  category_id    uuid not null references public.seo_client_categories (id),
  name           text not null,
  url            text,                -- null until the page exists
  priority       text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status         text not null default 'planned' check (status in ('live', 'scheduled', 'planned')),
  why            text,
  content_ideas  text[] not null default '{}',  -- free-text ideas, e.g. 'Link to /first-timers/'
  sort           smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index seo_pages_url_uq on public.seo_pages (client_id, url) where url is not null;
create index seo_pages_category_idx on public.seo_pages (category_id);

-- keyword_id is the primary key, so a keyword can only sit on ONE page.
create table public.seo_page_keywords (
  keyword_id  uuid primary key references public.seo_keywords (id) on delete cascade,
  page_id     uuid not null references public.seo_pages (id) on delete cascade,
  role        text not null check (role in ('primary', 'secondary', 'faq')),
  sort        smallint not null default 0
);
create unique index seo_page_keywords_one_primary on public.seo_page_keywords (page_id) where role = 'primary';
create index seo_page_keywords_page_idx on public.seo_page_keywords (page_id);

-- ---- updated_at triggers ----------------------------------------------------------
create trigger seo_clients_touch before update on public.seo_clients
  for each row execute function public.seo_touch_updated_at();
create trigger seo_client_accounts_touch before update on public.seo_client_accounts
  for each row execute function public.seo_touch_updated_at();
create trigger seo_keywords_touch before update on public.seo_keywords
  for each row execute function public.seo_touch_updated_at();
create trigger seo_matrix_cells_touch before update on public.seo_matrix_cells
  for each row execute function public.seo_touch_updated_at();
create trigger seo_pages_touch before update on public.seo_pages
  for each row execute function public.seo_touch_updated_at();

-- ---- Row level security: ON everywhere, no policies (server-only access) --------------
alter table public.seo_clients           enable row level security;
alter table public.seo_client_categories enable row level security;
alter table public.seo_client_services   enable row level security;
alter table public.seo_client_areas      enable row level security;
alter table public.seo_client_accounts   enable row level security;
alter table public.seo_imports           enable row level security;
alter table public.seo_keywords          enable row level security;
alter table public.seo_keyword_sources   enable row level security;
alter table public.seo_matrix_cells      enable row level security;
alter table public.seo_matrix_keywords   enable row level security;
alter table public.seo_pages             enable row level security;
alter table public.seo_page_keywords     enable row level security;

-- ---- Storage: private bucket for the raw CSVs (<site id>/<import id>/<file name>) -----
-- Private + no storage policies = only the server (secret key) can read or write. 20 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('seo-imports', 'seo-imports', false, 20971520);

commit;
