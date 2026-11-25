-- SEO Hub, step 6c-4a: a page's URL can be a SUGGESTION (from the template's URL pattern, e.g. /web-design-bentonville-ar/),
-- shown as "suggested" until Angel confirms or edits it. Existing URLs are never changed by this.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN. No rows are changed (every existing page gets false = a real URL).

begin;

alter table public.seo_pages add column if not exists url_suggested boolean not null default false;

commit;
