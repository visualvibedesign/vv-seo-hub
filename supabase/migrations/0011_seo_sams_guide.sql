-- SEO Hub: one-time import of a client's "Sam's Guide" sheet (docs/sams-guide-import-plan.md).
--   seo_imports.report  + 'sams_guide' (the raw CSV is kept untouched with the import, like every import)
--   seo_competitors     = the client's direct competitors C1–C4, NAME ONLY (no URL, no address, no notes)
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. No existing rows are changed.

begin;

alter table public.seo_imports drop constraint if exists seo_imports_report_check;
alter table public.seo_imports add constraint seo_imports_report_check
  check (report in ('kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap', 'master_db', 'clusters', 'sams_guide'));

create table if not exists public.seo_competitors (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  code       text not null check (code ~ '^C[1-9]$'),
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, code)
);
alter table public.seo_competitors enable row level security;  -- server only (service key), no policies

drop trigger if exists seo_competitors_touch on public.seo_competitors;
create trigger seo_competitors_touch before update on public.seo_competitors
  for each row execute function public.seo_touch_updated_at();

commit;
