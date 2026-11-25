-- SEO Hub, redesign step 6c-2: per-client scope words + one more auto-fill kind.
--   seo_clients.out_of_scope_words  = words for services the client doesn't offer (e.g. male, men, chest).
--                                     Keywords with one of them get NO role / service / intent suggestion;
--                                     they go to the "Out of scope" list (suggest Rejected, Angel confirms).
--   seo_clients.neighbourhood_words = neighbourhoods inside the client's area (e.g. great kills, new dorp).
--                                     Unless one is also an active area (A1–A3), keywords with it go to the
--                                     same list as "neighbourhood → Later" (no service suggestion).
--   seo_autofill kind 'scope'       = that plain-code list (kept apart from Claude's 'triage').
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN: "if not exists" columns (empty lists by default) and one check
-- constraint replaced. No rows are changed, nothing is dropped except the old version of that constraint.

begin;

alter table public.seo_clients add column if not exists out_of_scope_words text[] not null default '{}';
alter table public.seo_clients add column if not exists neighbourhood_words text[] not null default '{}';

alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check
  check (kind in ('setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope', 'matrix', 'clusters'));

commit;
