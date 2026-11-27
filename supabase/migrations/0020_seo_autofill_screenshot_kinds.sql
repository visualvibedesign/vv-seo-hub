-- 0020 · Screenshot reads (Nov 28, phase 2g). DRAFT: Angel runs it in the SQL Editor after review.
-- A GBP Performance screenshot (and later a Whitespark map grid screenshot) read by Claude is saved in seo_autofill
-- as "Ready to review" (status 'ready', one open read per client + kind, the Claude log link), the same way as the
-- other Claude suggestions. It counts nowhere until Angel approves it in the GBP / map grid form.
-- No image is stored anywhere: only the numbers Claude read (payload jsonb).
--
-- This only widens the list of allowed kinds (+ 'gbp_screenshot', 'map_screenshot'). The 15 existing rows all use
-- kinds already in the list, so the check passes on every row. No rows change, nothing is deleted.

alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope',
  'matrix', 'clusters',
  'gbp_screenshot', 'map_screenshot'
));
