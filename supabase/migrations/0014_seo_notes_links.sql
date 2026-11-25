-- SEO Hub, redesign step 7: Notes & links (design docs/design/Notes.png).
--   seo_notes         = a feed of notes per client, tagged Rule / Decision / Note, with who wrote it (a name typed in:
--                       there's no user list) and the guide day. client_id NULL = an agency rule shown on every client.
--   seo_client_links  = quick links that aren't accounts (the Google Sheet, ClickUp lists…). Search Console, GA4, GBP,
--                       Semrush, Whitespark etc. are NOT here: they're the per-account links (seo_client_accounts.link),
--                       shown on the same card. Links only, never logins: https, no user:pass@.
-- Never a street address in a note (the app refuses it). The old one-box seo_clients.notes is kept as it is.
-- Run in Supabase → SQL Editor. SAFE TO RE-RUN ("if not exists"). No existing rows are changed.

begin;

create table if not exists public.seo_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.seo_clients (id) on delete cascade,     -- null = agency rule (every client)
  kind        text not null default 'note' check (kind in ('rule', 'decision', 'note')),
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  author      text check (author is null or char_length(author) <= 60),
  day         smallint check (day is null or day between 0 and 9),          -- guide step it belongs to
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists seo_notes_client_idx on public.seo_notes (client_id, created_at desc);
alter table public.seo_notes enable row level security;  -- server only (service key), no policies

create table if not exists public.seo_client_links (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.seo_clients (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 80),
  url         text not null check (char_length(url) <= 500 and url ~* '^https://[^\s/@]+(/[^\s]*)?$'),
  note        text check (note is null or char_length(note) <= 120),      -- the grey line under the name
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists seo_client_links_client_idx on public.seo_client_links (client_id, sort);
alter table public.seo_client_links enable row level security;  -- server only (service key), no policies

drop trigger if exists seo_notes_touch on public.seo_notes;
create trigger seo_notes_touch before update on public.seo_notes
  for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_client_links_touch on public.seo_client_links;
create trigger seo_client_links_touch before update on public.seo_client_links
  for each row execute function public.seo_touch_updated_at();

commit;
