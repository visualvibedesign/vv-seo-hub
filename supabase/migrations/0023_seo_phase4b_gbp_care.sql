-- 0023 · Phase 4b: GBP care (Sam Day 7). Nov 29, 2026.
-- DRAFT: Angel runs it in the Supabase SQL Editor after review.
--
-- New tables only (+ one widened check). Nothing existing is changed or deleted; 0 rows affected.
-- RLS on every new table, no policies: server only, like the other seo_ tables.
-- Privacy: the review tracker keeps a short customer ref, date, channel, result and one follow-up date. Nothing else.
-- The database itself refuses a ref with an email (@) or a phone-like run of digits.

begin;

-- ---- Per-client GBP care settings: review round target, post quarter start, care routine ticks ------------------
create table if not exists public.seo_gbp_care (
  client_id          uuid primary key references public.seo_clients (id) on delete cascade,
  review_target      smallint not null default 5 check (review_target between 1 and 50),   -- Sam: 5 a round
  round_started_on   date,                                   -- reviews counted from this date
  posts_start_on     date,                                   -- week 1 of the 13-week post calendar
  next_post_batch_on date,
  care_checks        jsonb not null default '{}'::jsonb,     -- weekly / monthly routine ticks
  updated_at         timestamptz not null default now()
);
alter table public.seo_gbp_care enable row level security;

-- ---- Products: one per service page (links to the page, not Home) -------------------------------------------------
create table if not exists public.seo_gbp_products (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.seo_clients (id) on delete cascade,
  page_id     uuid references public.seo_pages (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  image_ready boolean not null default false,             -- 720×720 real photo ready (the image itself isn't stored)
  status      text not null default 'not_added' check (status in ('not_added', 'added')),
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists seo_gbp_products_one_per_page on public.seo_gbp_products (client_id, page_id) where page_id is not null;
create index if not exists seo_gbp_products_client on public.seo_gbp_products (client_id, sort);
alter table public.seo_gbp_products enable row level security;

-- ---- Review requests: ref, date, channel, result, one follow-up. No names, emails or phones. ---------------------
create table if not exists public.seo_review_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.seo_clients (id) on delete cascade,
  customer_ref text not null check (
    char_length(customer_ref) between 1 and 40
    and customer_ref !~ '@'
    and customer_ref !~ '([0-9][() .-]*){7,}'               -- no phone numbers (7+ digits in a row, any format)
  ),
  asked_on     date not null,
  channel      text not null check (channel in ('email', 'text', 'in_person', 'other')),
  result       text not null default 'waiting' check (result in ('waiting', 'reviewed', 'no_reply', 'declined')),
  follow_up_on date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists seo_review_requests_client on public.seo_review_requests (client_id, asked_on desc);
alter table public.seo_review_requests enable row level security;

-- ---- Post calendar: 13 weeks from a start date ---------------------------------------------------------------------
create table if not exists public.seo_gbp_posts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.seo_clients (id) on delete cascade,
  quarter_start date not null,
  week          smallint not null check (week between 1 and 13),
  post_on       date,
  topic         text check (topic is null or char_length(topic) <= 120),
  takeaway      text check (takeaway is null or char_length(takeaway) <= 300),
  body          text check (body is null or char_length(body) <= 1500),              -- GBP post limit
  cta           text not null default 'Learn more' check (char_length(cta) between 1 and 40),
  page_id       uuid references public.seo_pages (id) on delete set null,
  link_url      text check (link_url is null or char_length(link_url) <= 500),      -- page URL + UTM
  image_need    text check (image_need is null or char_length(image_need) <= 200),  -- 1200×900
  status        text not null default 'not_drafted' check (status in ('not_drafted', 'drafted', 'approved', 'scheduled', 'live')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, quarter_start, week)
);
alter table public.seo_gbp_posts enable row level security;

-- ---- updated_at triggers -------------------------------------------------------------------------------------------
drop trigger if exists seo_gbp_care_touch on public.seo_gbp_care;
create trigger seo_gbp_care_touch before update on public.seo_gbp_care for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_gbp_products_touch on public.seo_gbp_products;
create trigger seo_gbp_products_touch before update on public.seo_gbp_products for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_review_requests_touch on public.seo_review_requests;
create trigger seo_review_requests_touch before update on public.seo_review_requests for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_gbp_posts_touch on public.seo_gbp_posts;
create trigger seo_gbp_posts_touch before update on public.seo_gbp_posts for each row execute function public.seo_touch_updated_at();

-- ---- Claude drafts: product descriptions + the 13-week posts ("Ready to review") --------------------------------
alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope',
  'matrix', 'clusters', 'gbp_screenshot', 'map_screenshot',
  'hotspots', 'brandscript', 'page_copy',
  'map_competitors',
  'gbp_products', 'gbp_posts'
));

commit;
