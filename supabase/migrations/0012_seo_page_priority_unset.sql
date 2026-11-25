-- SEO Hub: a page's priority can be "not set yet" (null), shown as "Medium (default)" until Angel picks one.
-- Imports without a priority column (Sam's Guide, a Clusters row with a blank priority) leave it empty instead of
-- pretending Medium was chosen. The check (high / medium / low) stays; null passes it.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. No rows are changed by this file.

begin;

alter table public.seo_pages alter column priority drop default;
alter table public.seo_pages alter column priority drop not null;

commit;
