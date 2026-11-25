-- SEO Hub, redesign step 6c-2: two more auto-fill kinds for Claude suggestions.
--   services_ai = leftover services suggested by Claude (kept apart from the plain-code 'services' rules run,
--                 so both can be open for review at the same time)
--   triage      = a category + status (Later / Rejected) for keywords no rule matched (competitor brand,
--                 neighbourhood, off-topic…). Angel decides; nothing is deleted.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN: it only replaces one check constraint on seo_autofill
-- (a table from 0006); no rows are changed, nothing is dropped.

begin;

alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check
  check (kind in ('setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'matrix', 'clusters'));

commit;
