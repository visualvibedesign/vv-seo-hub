-- 0022 · Phase 4a: GBP check (Sam Day 4). Nov 29, 2026.
-- DRAFT: Angel runs it in the Supabase SQL Editor after review.
--
-- New tables only (+ one widened check). Nothing existing is changed or deleted; 0 rows affected.
-- RLS on every new table, no policies: server only, like the other seo_ tables.
-- Privacy: there is NO address column anywhere. The GBP profile keeps "address shown on GBP?" as yes / no only.

begin;

-- ---- The Maps search used per service (S1–S3): search text, date checked, how many results were counted --------
create table if not exists public.seo_map_searches (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.seo_clients (id) on delete cascade,
  category_code   text not null check (category_code in ('S1', 'S2', 'S3')),
  search          text check (search is null or char_length(search) <= 200),
  checked_on      date,
  results_counted smallint check (results_counted is null or results_counted between 0 and 20),
  updated_at      timestamptz not null default now(),
  unique (client_id, category_code)
);
alter table public.seo_map_searches enable row level security;

-- ---- Map-pack competitors per service (+ the client's own row, is_client) -----------------------------------------
create table if not exists public.seo_map_competitors (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.seo_clients (id) on delete cascade,
  category_code         text not null check (category_code in ('S1', 'S2', 'S3')),
  is_client             boolean not null default false,
  rank                  smallint check (rank is null or rank between 1 and 20),
  name                  text not null check (char_length(name) between 1 and 120),
  primary_category      text check (primary_category is null or char_length(primary_category) <= 120),
  additional_categories text[] not null default '{}',
  reviews               integer check (reviews is null or reviews >= 0),
  rating                numeric(2, 1) check (rating is null or rating between 1 and 5),
  newest_review_on      date,
  note                  text check (note is null or char_length(note) <= 300),
  sort                  smallint not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists seo_map_competitors_client on public.seo_map_competitors (client_id, category_code, sort);
-- One "client" row per service at most.
create unique index if not exists seo_map_competitors_one_client on public.seo_map_competitors (client_id, category_code) where is_client;
alter table public.seo_map_competitors enable row level security;

-- ---- Whitespark top map factors, checked for the client ----------------------------------------------------------
create table if not exists public.seo_gbp_factors (
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  factor_key text not null check (factor_key in ('primary_category', 'name_keywords', 'open_hours', 'address_shown', 'additional_categories', 'reviews_text', 'review_recency', 'website_match')),
  status     text not null default 'to_check' check (status in ('to_check', 'ok', 'needs_work', 'na')),
  note       text check (note is null or char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (client_id, factor_key)
);
alter table public.seo_gbp_factors enable row level security;

-- ---- GBP business details: PUBLIC fields only (must match the website). No address column. ---------------------
create table if not exists public.seo_gbp_profile (
  client_id             uuid primary key references public.seo_clients (id) on delete cascade,
  business_name         text check (business_name is null or char_length(business_name) <= 160),
  website               text check (website is null or char_length(website) <= 300),
  phone                 text check (phone is null or char_length(phone) <= 40),
  email                 text check (email is null or char_length(email) <= 160),
  primary_category      text check (primary_category is null or char_length(primary_category) <= 120),
  additional_categories text[] not null default '{}',
  service_areas         text check (service_areas is null or char_length(service_areas) <= 500),
  hours                 text check (hours is null or char_length(hours) <= 500),
  holiday_hours         text check (holiday_hours is null or char_length(holiday_hours) <= 300),
  socials               text[] not null default '{}',
  booking_url           text check (booking_url is null or char_length(booking_url) <= 300),
  review_url            text check (review_url is null or char_length(review_url) <= 300),
  description           text check (description is null or char_length(description) <= 750),
  address_shown         boolean,                 -- yes / no only; the address itself is never stored
  profile_checks        jsonb not null default '{}'::jsonb,   -- Day 4 profile check ticks
  checked_on            date,
  waiting_on_google     text check (waiting_on_google is null or char_length(waiting_on_google) <= 300),
  check_again_on        date,
  updated_at            timestamptz not null default now()
);
alter table public.seo_gbp_profile enable row level security;

-- ---- updated_at triggers (same helper as the other tables) ---------------------------------------------------------
drop trigger if exists seo_map_searches_touch on public.seo_map_searches;
create trigger seo_map_searches_touch before update on public.seo_map_searches for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_map_competitors_touch on public.seo_map_competitors;
create trigger seo_map_competitors_touch before update on public.seo_map_competitors for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_gbp_factors_touch on public.seo_gbp_factors;
create trigger seo_gbp_factors_touch before update on public.seo_gbp_factors for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_gbp_profile_touch on public.seo_gbp_profile;
create trigger seo_gbp_profile_touch before update on public.seo_gbp_profile for each row execute function public.seo_touch_updated_at();

-- ---- Claude reading a Maps / Pleper screenshot into competitor rows ("Ready to review") --------------------------
alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope',
  'matrix', 'clusters', 'gbp_screenshot', 'map_screenshot',
  'hotspots', 'brandscript', 'page_copy',
  'map_competitors'
));

commit;
