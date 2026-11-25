-- SEO Hub: import a whole client Sheet (.xlsx) once (docs/client-sheet-import-plan.md).
--   seo_imports.report  + 'client_sheet' = the .xlsx upload itself (kept untouched in Storage, like every import).
--                         It adds no keywords of its own: each recognised tab becomes its own import
--                         (master_db / sams_guide / clusters / competitors), deletable on its own.
--   seo_imports.parent_import_id = the .xlsx a tab import came from (null for every other import).
--                         No cascade: the app deletes the tab imports first (their own undo rules), then the .xlsx row.
--                         Deleting a client still removes everything (both rows go in the same statement).
--   'competitors'        = the Competitors tab: names only, into seo_competitors (no URL, no address, no notes).
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. No existing rows are changed (every current import gets null).

begin;

alter table public.seo_imports drop constraint if exists seo_imports_report_check;
alter table public.seo_imports add constraint seo_imports_report_check
  check (report in ('kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap', 'master_db', 'clusters',
                    'sams_guide', 'competitors', 'client_sheet'));

alter table public.seo_imports add column if not exists parent_import_id uuid references public.seo_imports (id);
create index if not exists seo_imports_parent_idx on public.seo_imports (parent_import_id) where parent_import_id is not null;

commit;
