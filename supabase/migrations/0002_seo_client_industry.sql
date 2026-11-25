-- SEO Hub, redesign step 2: the client's industry template (Add client wizard, step 2 "Template").
-- Run once: Supabase → SQL Editor → New query → paste → Run.
--
-- Safe for HQ's live database:
--   * Only ADDS one nullable column to seo_clients. Nothing is dropped, renamed or rewritten.
--   * Existing clients keep industry = null ("No template yet") until set on Edit client.
--   * RLS stays on (no policies = server-only), same as 0001.

begin;

alter table public.seo_clients
  add column industry text
  check (industry in ('waxing_beauty', 'med_spa', 'home_services', 'blank'));

comment on column public.seo_clients.industry is
  'Industry template picked in the Add client wizard. Templates themselves (seo_templates) come in a later step.';

commit;
