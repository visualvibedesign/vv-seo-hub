-- SEO Hub: account checklist as a quick-access list (Angel, Nov 25).
--   seo_client_accounts.link = an optional per-client link (this client's GSC property, GA4 property, GBP profile,
--                              Semrush project…). Links only: https, no username:password@ in it. Never logins.
--   New account rows start as 'ready' (one agency account covers most tools); Angel sets Pending when something's missing.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. No rows are changed (existing statuses stay as they are).

begin;

alter table public.seo_client_accounts add column if not exists link text;

alter table public.seo_client_accounts drop constraint if exists seo_client_accounts_link_check;
alter table public.seo_client_accounts add constraint seo_client_accounts_link_check
  check (link is null or (char_length(link) <= 500 and link ~* '^https://[^\s/@]+(/[^\s]*)?$'));

alter table public.seo_client_accounts alter column status set default 'ready';

commit;
