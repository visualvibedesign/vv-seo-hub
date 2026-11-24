-- SEO Hub, redesign step 3: step-by-step guide progress (Sam's 10 days as 9 steps, per client).
-- Run once: Supabase → SQL Editor → New query → paste → Run.
--
-- Safe for HQ's live database:
--   * Only CREATES one new table (seo_guide_progress). Nothing existing is changed, dropped or rewritten.
--   * RLS on, no policies (server-only), same as 0001.
--
-- How it's used:
--   * One row per client per step, made the first time a step is touched (no row = not started).
--   * step 0–8 = the 9 guide steps (src/lib/clientSetup.ts SAM_STEPS): 0 Client setup (Day 1) … 8 Results (Day 10).
--   * tasks_done = keys of the tasks ticked BY HAND (e.g. 'kp_ideas'). Tasks that SEO Hub can see in the data
--     (e.g. "Import the CSVs") are worked out live from the data and never stored, so they can't go stale.
--   * The client's current step = the first step that isn't done. It drives "Day 2 · Keywords" in the switcher,
--     the Sam step column on All clients and "Continue Day N in the guide".

begin;

create table public.seo_guide_progress (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.seo_clients (id) on delete cascade,
  step        smallint not null check (step between 0 and 8),
  status      text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  tasks_done  text[] not null default '{}',
  started_at  timestamptz,
  done_at     timestamptz,
  updated_at  timestamptz not null default now(),
  unique (client_id, step),
  check (status <> 'done' or done_at is not null)
);

create index seo_guide_progress_client on public.seo_guide_progress (client_id);

create trigger seo_guide_progress_touch before update on public.seo_guide_progress
  for each row execute function public.seo_touch_updated_at();

alter table public.seo_guide_progress enable row level security;

commit;
