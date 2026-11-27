-- 0019 · Monthly reports: which baseline, Claude draft review trail, sent rule (Nov 28, phase 2f).
-- DRAFT: Angel runs it in the SQL Editor after review.
-- seo_reports and seo_report_actions are empty (0 rows), so the checks can't fail. No rows change, nothing deleted.

-- Which baseline the report compared against ("Start a new baseline" later must not change an old report).
-- The report's own numbers jsonb also keeps a copy of the baseline values, so set null on delete loses nothing.
alter table public.seo_reports
  add column if not exists baseline_id        uuid references public.seo_baselines (id) on delete set null,
  -- Claude draft review trail: when it was drafted, which logged call made it, when Angel approved the text.
  add column if not exists notes_draft_at     timestamptz,
  add column if not exists notes_draft_log_id uuid references public.seo_ai_log (id) on delete set null,
  add column if not exists notes_approved_at  timestamptz;

-- A sent report always has its sent date.
alter table public.seo_reports drop constraint if exists seo_reports_sent_has_date;
alter table public.seo_reports add constraint seo_reports_sent_has_date check (status <> 'sent' or sent_on is not null);

-- Up to 3 next actions per report: the app enforces the count; sort keeps their order.
alter table public.seo_report_actions drop constraint if exists seo_report_actions_sort_check;
alter table public.seo_report_actions add constraint seo_report_actions_sort_check check (sort between 0 and 2);

-- Foreign-key indexes (look-ups by report / by baseline).
create index if not exists seo_report_actions_report on public.seo_report_actions (report_id, sort);
create index if not exists seo_reports_baseline on public.seo_reports (baseline_id);
