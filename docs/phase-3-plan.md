# Phase 3 plan · Pages: sitemap + hotspots, site plan, page briefs (Sam Days 5–6)

Written Nov 28, 2026 on branch `phase-3` (from `phase-2`). **Plan only: no code until Angel approves.**
Designs: `docs/design/Pages.png`, `SitePlan.png`, `Brief.png`. Playbook: `docs/local-seo-playbook.md` › Days 5–6.
Test client: Visual Vibe Design (9 pages from Clusters: 4 live, 5 planned, keywords linked).

## What exists already (Phase 1)
- `seo_pages` (name, category S1–S3 / Home / FAQ, url, priority, status live / scheduled / planned, why, content
  ideas, sort, url_suggested) + `seo_page_keywords` (each keyword on one page only, role primary / secondary / faq).
- Clusters screen (Strategy Builder › Day 2) builds and edits those pages.
- Strategy Builder sidebar already has **Day 5 · Sitemap + hotspots, Site plan** and **Day 6 · Page briefs** as "P3"
  placeholders (`src/lib/clientSetup.ts`). Template kind `hotspots` already exists (Templates).
- Rankings know when Google ranks a different page than the one a keyword belongs to ("swapped").

## Screens (follow the designs)

### 1. Sitemap + hotspots (`strategy/pages`, Day 5)
- Left: the page list **P1, P2…** (code editable), name, primary keyword, and a pill **Keep / Improve / New**
  (new pages = planned). Site structure shown under the title (service first / location first / flat, set once per
  client). "+ Add page" (name, type, primary keyword from the client's keywords).
- Right: the selected page: "P2 · service page · keep + improve", owner of {primary} · N secondaries · N FAQ ideas,
  a **swapped-page flag** from rankings ("Google may show /services/ instead"), then the **hotspots**:
  - SEO title with a live counter (target 50–60), meta description (150–160, must end with a call to action),
    H1, URL (the target permalink).
  - **Google preview** (title, domain › path, description) as it would look.
  - Checks in code (warnings, never blocking): title / meta length, meta ends with a CTA, primary keyword near the
    start of the title, full state name in the title, state abbreviation in the URL, [brackets] still open.
  - "Live now" column: empty state "Connect the site (coming soon)" (needs the Vibe SEO plugin, phase P1).
  - Buttons: **Save hotspots**, **Open page brief ›**, **Draft with Claude**, "Push to site (P5)" disabled,
    "Send to ClickUp" (see decision 1).

### 2. Site plan (`strategy/plan`, Day 5)
- Sitemap tree by the client's structure: Home → service pages (or location pages) → children → supporting pages
  (FAQ, About, Contact…). Each page has a type (home / service / location / supporting) and an optional parent.
  New pages show "New". A line for the body-copy linking rule (service pages link to FAQ / first-timer pages, every page
  has a route to contact).
- **Redirects queue**: when a **live** page's URL is changed in its hotspots, a redirect old → new is queued
  automatically with the reason ("P2 URL now matches the keyword"). Status **Queued → Sent to site → Live**, moved by
  hand (click). Note: sending to the site needs Vibe SEO (phase 5); Vibe Admin does the real redirect.
- "Start from a website" stays a "Later" pill (design).

### 3. Page briefs (`strategy/briefs`, Day 6)
- **BrandScript** (left, once per client): A–P from the playbook (company, customer want, need, problem, feeling,
  belief, why, solution, 3-step plan, don't / instead, next action, success), "N of 16 filled", **Draft with Claude**
  (from Day 1 setup + kickoff answers + client facts; never invents services, prices, guarantees, reviews or
  results; unknown = [bracket]), then edit + "Read aloud and confirmed".
- **Page copy** (right, per page): **V1 · hotspots** (header + footer: eyebrow "Service in City, State", headline,
  subheadline with a semantic triple, CTA; contact / hours / booking) and **V2 · full copy** (the 11 StoryBrand
  sections: header, stakes, value, guide, social proof, path in exactly 3 steps, pricing (optional), services,
  failure vs success, lead magnet (optional), footer). Status per section (To write / Drafted / Done).
  **Draft with Claude** (BrandScript + page keywords + hotspots + real facts; [placeholders] for reviews etc.),
  **Save brief**, **Copy for Elementor** (copies the sections as clean text to paste into the page builder).
- The Day 5 "first page brief" worksheet fields sit at the top of a page's brief: opportunity, why first (demand,
  value, competition, proof, effort), customer need, 2–3 buying questions, proof, desired action, links from / to,
  missing inputs.

## Claude (all "Ready to review", estimate first, logged; same pattern as Day 2 auto-fill / report notes)
| Task | Model | What it writes | Code checks after |
|---|---|---|---|
| `hotspots` | Sonnet 5.5 | Per page: title, meta, H1, URL, opening + closing line, from keywords (volumes exactly as exported), matrix, clusters and the client's Hotspots template | lengths, CTA, state rules, keeps sensible existing URLs, no invented claims ([Trust signal] brackets) |
| `brandscript` | Sonnet 5.5 | A–P from Day 1 setup + kickoff | empty = [bracket]; never prices / guarantees / reviews |
| `page_copy` | Sonnet 5.5 | V1 header + footer, or V2 all 11 sections | exactly 3 path steps; [placeholders] kept; no invented facts |
Approving copies the draft into the page / BrandScript / brief; nothing is published anywhere.

## Decisions (answered Nov 28)
- **ClickUp: Later** (button stays "Later"; no token needed now).
- **Site structure: per client, default service first** (Sam: most common; switch to location first for physical locations, flat for few pages).
- **Page codes: auto P1, P2… in page order (Home = P1), editable.**

## Decisions for Angel (original questions)
1. **Send to ClickUp** (Web Page tasks): needs a ClickUp API token in `.env.local` / Vercel and the list id. Build it in
   Phase 3 (last step), or leave the button as "Later"? *Recommended: Later* (one less secret; copy works today).
2. **Site structure** per client: pick it on Sitemap (service first / location first / flat), default "service
   first". OK?
3. **Page codes**: auto P1, P2… in page order (Home = P1), editable. OK?

## Database · migration 0021 (`supabase/migrations/0021_seo_phase3_pages.sql`, written Nov 28, waiting for Angel to run it)
Only adds columns + new tables; nothing is deleted. Rows affected: 0 updated except the backfill noted below.
```sql
-- Pages: code, type, parent, keep / improve / new, hotspots, target URL
alter table public.seo_pages
  add column if not exists page_code text check (page_code is null or page_code ~ '^P[0-9]{1,3}$'),
  add column if not exists page_type text check (page_type is null or page_type in ('home','service','location','supporting')),
  add column if not exists parent_id uuid references public.seo_pages (id) on delete set null,
  add column if not exists page_action text check (page_action is null or page_action in ('keep','improve','new')),
  add column if not exists seo_title text check (seo_title is null or char_length(seo_title) <= 120),
  add column if not exists meta_description text check (meta_description is null or char_length(meta_description) <= 320),
  add column if not exists h1 text check (h1 is null or char_length(h1) <= 160),
  add column if not exists url_target text check (url_target is null or char_length(url_target) <= 300),
  add column if not exists hotspots_at timestamptz;
create index if not exists seo_pages_parent on public.seo_pages (parent_id);
create unique index if not exists seo_pages_code on public.seo_pages (client_id, page_code) where page_code is not null;

-- Site structure, once per client
alter table public.seo_clients
  add column if not exists site_structure text not null default 'service_first'
    check (site_structure in ('service_first','location_first','flat'));

-- Redirects queue (old → new when a live page's URL changes)
create table if not exists public.seo_redirects (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  page_id    uuid references public.seo_pages (id) on delete set null,
  old_url    text not null check (char_length(old_url) between 1 and 300),
  new_url    text not null check (char_length(new_url) between 1 and 300),
  why        text check (why is null or char_length(why) <= 200),
  status     text not null default 'queued' check (status in ('queued','sent','live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists seo_redirects_client on public.seo_redirects (client_id, status);
alter table public.seo_redirects enable row level security;

-- BrandScript: one per client, A–P answers as written
create table if not exists public.seo_brandscripts (
  client_id    uuid primary key references public.seo_clients (id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,   -- { "A": "...", ..., "P": "..." }
  confirmed_at timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.seo_brandscripts enable row level security;

-- Page brief: one per page (worksheet fields + V1 / V2 copy sections)
create table if not exists public.seo_page_briefs (
  page_id    uuid primary key references public.seo_pages (id) on delete cascade,
  client_id  uuid not null references public.seo_clients (id) on delete cascade,
  version    text not null default 'v1' check (version in ('v1','v2')),
  worksheet  jsonb not null default '{}'::jsonb,   -- opportunity, why first, questions, proof, action, links, missing
  sections   jsonb not null default '{}'::jsonb,   -- "1".."11": { text, status: to_write | drafted | done }
  updated_at timestamptz not null default now()
);
create index if not exists seo_page_briefs_client on public.seo_page_briefs (client_id);
alter table public.seo_page_briefs enable row level security;

-- updated_at triggers (same helper as the other tables)
drop trigger if exists seo_redirects_touch on public.seo_redirects;
create trigger seo_redirects_touch before update on public.seo_redirects for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_brandscripts_touch on public.seo_brandscripts;
create trigger seo_brandscripts_touch before update on public.seo_brandscripts for each row execute function public.seo_touch_updated_at();
drop trigger if exists seo_page_briefs_touch on public.seo_page_briefs;
create trigger seo_page_briefs_touch before update on public.seo_page_briefs for each row execute function public.seo_touch_updated_at();

-- Claude drafts saved as "Ready to review"
alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services','setup_areas','setup_kickoff','roles','services','services_ai','intent','triage','scope',
  'matrix','clusters','gbp_screenshot','map_screenshot','hotspots','brandscript','page_copy'));
```
Backfill (separate, shown before running, with a dry-run count): `page_code` P1… in page order, `page_type` from the
category (Home → home, S1–S3 → service, FAQ → supporting), `page_action` live → keep, planned → new. For Visual
Vibe: 9 pages. Done through a repair action with a dry run (no one-off data SQL), per the project rule.

## API (still 12 Vercel functions)
- Pages / plan / briefs / BrandScript: new actions in `api/clusters/[action].ts` (pages already live there).
- Claude drafts (hotspots, brandscript, page_copy): new tasks in `api/autofill/[action].ts` (300 s limit), with
  estimate + run like Day 2; the Day 2 auto-fill list keeps ignoring non-keyword kinds.

## Build order (stop after each step; Angel tests; next-session note updated each time)
1. Migration 0021 (Angel runs it) + backfill repair action (dry run, then apply).
2. Sitemap + hotspots screen: page list, Keep / Improve / New, hotspots with counters, checks and Google preview,
   swapped flag, Save; "+ Add page"; live-now empty state.
3. Site plan: structure picker, tree with types / parents, redirects queue auto-filled on URL change + status moves.
4. Claude hotspot drafts (per page, Ready to review, approve into the page).
5. BrandScript (form + Claude draft + confirm).
6. Page brief: worksheet + V1 / V2 sections, Claude draft, Save, Copy for Elementor.
7. (If decision 1 = now) Send to ClickUp.

## Test steps (localhost, Visual Vibe)
- Pages list shows P1–P9 with Keep / New; editing a title shows the counter turn green at 50–60; the meta warns
  without a CTA; the Google preview updates as you type; save survives a reload.
- Changing a live page's URL adds one queued redirect (old → new) on Site plan; moving it Queued → Sent → Live sticks.
- Claude hotspots: estimate first, draft is "Ready to review", approve fills the page; volumes match the export.
- BrandScript: Claude fills A–P with [brackets] where facts are missing; nothing invented.
- Page brief: V1 shows header + footer, V2 all 11 sections; Copy for Elementor puts clean text on the clipboard.
- Light + dark mode, phone width.
