-- SEO Hub, redesign step 6: Uploads + auto-fill (design docs/design/Autofill.png).
-- Run once: Supabase → SQL Editor → New query → paste → Run.
--
-- SAFE TO RE-RUN: every statement is "if not exists" or idempotent, there are no seed rows, and nothing
-- existing is changed or dropped. A second run does nothing.
--
-- Safe for HQ's live database: only creates 2 new seo_ tables. RLS on, no policies (server-only), like 0001.
--
-- How it's used:
--   * seo_ai_log: one row per Claude API call (CLAUDE.md: log every call: task, client, tokens). Kept even if
--     the client is deleted (client_id becomes null) so costs still add up. No prompts or client data stored here.
--   * seo_autofill: what auto-fill suggests, per client and guide step, as "Ready to review". Nothing touches
--     keywords / matrix / pages until Angel approves; approving applies the payload, rejecting keeps the row.
--     source = 'rules' (plain code: CSV parsing, patterns, counts) or 'claude' (judgment / writing).
--     Claude output never changes exported numbers; the server drops any such field before saving.

begin;

-- ---- Claude API call log ---------------------------------------------------------------------------
create table if not exists public.seo_ai_log (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references public.seo_clients (id) on delete set null,
  task                text not null check (length(task) between 1 and 80),   -- e.g. 'day2.matrix', 'day1.services'
  model               text not null check (length(model) between 1 and 80),
  input_tokens        integer not null default 0 check (input_tokens >= 0),
  output_tokens       integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens   integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens  integer not null default 0 check (cache_write_tokens >= 0),
  cost_usd            numeric(10, 4) check (cost_usd >= 0),                     -- estimate at call time
  ok                  boolean not null,
  error               text check (length(error) <= 1000),
  duration_ms         integer check (duration_ms >= 0),
  created_at          timestamptz not null default now()
);
create index if not exists seo_ai_log_client_time on public.seo_ai_log (client_id, created_at desc);
create index if not exists seo_ai_log_time on public.seo_ai_log (created_at desc);

-- ---- Auto-fill suggestions (Ready to review → Approved / Rejected) ------------------------------------
create table if not exists public.seo_autofill (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.seo_clients (id) on delete cascade,
  step           smallint not null check (step between 0 and 8),            -- guide step: 0 = Day 1, 1 = Day 2 …
  kind           text not null check (kind in ('setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'intent', 'matrix', 'clusters')),
  source         text not null check (source in ('rules', 'claude')),
  status         text not null default 'ready' check (status in ('ready', 'approved', 'rejected', 'superseded')),
  summary        text not null check (length(summary) between 1 and 300),   -- "Primary 10 · Secondary 76 …"
  payload        jsonb not null,                                            -- the suggested changes, row by row
  item_count     integer not null default 0 check (item_count >= 0),
  applied_count  integer check (applied_count >= 0),                         -- rows actually applied on approve
  ai_log_id      uuid references public.seo_ai_log (id) on delete set null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  check ((status in ('approved', 'rejected')) = (decided_at is not null) or status = 'superseded')
);
create index if not exists seo_autofill_client_step on public.seo_autofill (client_id, step, status);
create index if not exists seo_autofill_ai_log on public.seo_autofill (ai_log_id) where ai_log_id is not null;
-- At most one open ("ready") suggestion per client + kind: a new run marks the old one 'superseded' first.
create unique index if not exists seo_autofill_one_ready on public.seo_autofill (client_id, kind) where status = 'ready';

alter table public.seo_ai_log   enable row level security;
alter table public.seo_autofill enable row level security;

commit;
