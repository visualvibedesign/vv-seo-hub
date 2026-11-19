# SEO Hub – All Phases

One file for the whole build. Updated Nov 20, 2026: **no separate design mockups**. SEO Hub is built directly in the Visual Vibe HQ style, one phase at a time:

**plan → build locally → Angel tests on localhost → push to a Vercel preview (only when Angel says) → Alexia reviews the link → fix → next phase.**

Every phase has a ready-to-paste prompt for Claude Code at the end of its section.

## Tech stack (same as Visual Vibe HQ)
| Tool | Used for | Phase |
| --- | --- | --- |
| GitHub | Code + backups (repo: `vv-seo-hub`) | 1 |
| React | The web app (same setup as Visual Vibe HQ) | 1 |
| Vercel | Hosting + preview links | 1 |
| Supabase | Same Supabase project as HQ (needed for the shared login). SEO tables kept separate from HQ's tables. Row-level security, file storage | 1 |
| HQ login | Shared team password + signed `vv_session` cookie from HQ (Phase 0). No Supabase Auth, no new user list | 0–1 |
| Papa Parse (or similar) | Reading CSV files | 1 |
| Google Search Console + GA4 APIs (free) | Impressions, clicks, sessions | 2 |
| ClickUp API | Link clients to lists, create tasks | 3–5 |
| Claude API | Drafts (metas, GBP posts, page briefs), always reviewed | 5 |
| Slack | Alerts + weekly summaries | 5 |
| Vibe SEO plugin (WordPress, PHP) | Sites send a signed daily check-in; later push keyphrase/title/meta | 5 |

Not used: Semrush API (CSV instead), GBP API (until approved), Whitespark API (CSV/screenshot).

## Rules for every phase
- Follow Sam's process (`local-seo-playbook.md`). Agency rules + Anassa data: `seo-hub-context-pack.md`.
- **Style = Visual Vibe HQ** (reuse its styles/components): Fraunces headings with a purple italic word (#7C5CE6), Inter body, background #F7F5FF, text #131314, light purple sidebar #EEEAFF with active pill #BFAFFF, white cards (22px radius, 1px #ECE8FB border, soft purple shadow), lime #BAD657 pill buttons, light + dark mode, phone layout. Data tables can keep clear grey header rows and the role tags (Primary teal, Secondary light blue, FAQ orange, Near me gray).
- No separate mockups. Only make a quick mockup if one screen comes out confusing (most likely the 3×3 matrix).
- Volumes kept exactly as exported. Never store or show a private address.
- Team-only. Previews have real client data, so they must sit behind the team login (or Vercel password protection), never public.
- Build on a local branch. Never push, merge or deploy until Angel says so.

---

## Phase 0 · One-login portal (built inside Visual Vibe HQ)

Approved by Alexia (Nov 20, 2026). Being built in the HQ repo with Claude Code, not in SEO Hub.

- HQ keeps its shared team password and `vv_session` cookie.
- HQ landing page stays exactly as it is. After sign in → new **/apps** page (styled like the landing page) with cards: Visual Vibe HQ (live), SEO Hub (Building · Phase 1, disabled until it has an address), Client Reports (coming later).
- App list lives in one config file (`src/lib/apps.ts`), one line per app.
- Shared login across apps needs custom domains, e.g. `hq.visualvibedesign.com` + `seo.visualvibedesign.com`, and `SESSION_COOKIE_DOMAIN=.visualvibedesign.com` in production. **Waiting on Alexia** for the domain names and who manages DNS.
- Open question: HQ's existing "SEO & GBP helpers" page (/seo) stays for now; decide later if SEO Hub replaces it.

**What this means for SEO Hub:** no login screen of its own long-term. It checks HQ's `vv_session` cookie (same SESSION_SECRET, same Supabase `team_password_hash`) and sends signed-out people to HQ's sign in. Until the custom domains exist, SEO Hub needs its own simple sign-in with the same team password (or Vercel password protection).

---

## Phase 1 · Clients + keywords + 3×3 matrix (Sam Days 1–2)

**Done when**
- [ ] Sign-in works with the HQ team password (shared cookie once domains exist)
- [ ] Anassa set up (S1–S3, A1, account checklist)
- [ ] Anassa's keyword CSV imports cleanly
- [ ] 3×3 matrix + clusters match her Google Sheet
- [ ] "Export tracked list" CSV works for Semrush
- [ ] Looks like HQ (same fonts, cards, buttons, sidebar)

**Screens:** Clients list · Client Overview (client card, Sam's 9 steps, account checklist) · Keywords + matrix (matrix, keyword table, filters, Track toggle, export) · Clusters · Import CSV wizard (source → upload → match columns → preview → import) · other tabs "coming in phase X".

**Tables:** `clients`, `client_services`, `client_areas`, `client_accounts`, `keywords` (kp_volume as text, unique per client), `imports`, `matrix_cells`, `pages`, `page_keywords`. RLS on all. Raw CSVs saved in Storage. No user table (shared team password).

**Build steps:** repo → reuse HQ styles/components → Supabase tables + RLS → sign-in check → clients + overview → import wizard → keyword table → matrix → clusters → export → test with Anassa locally → preview link (when Angel says).

**Prompt to paste**
```
Phase 1 of SEO Hub: clients + keyword database + CSV import + 3×3 matrix + clusters (Sam Days 1–2).
Read docs/seo-hub-context-pack.md, docs/seo-hub-phases.md (rules, phase 0 and phase 1), docs/local-seo-playbook.md (Days 1–2) and the Visual Vibe HQ code in ../visual-vibe-dashboard for its styles, components and login (read only).

No design mockups. Build it directly in the Visual Vibe HQ style (reuse HQ's styles and components so both apps match).

Step 1 (plan only, no code): which HQ styles/components to reuse, Supabase tables (same Supabase project as HQ, SEO tables kept separate, RLS on all), how sign-in works now (same team password) and later (HQ's shared vv_session cookie), folder structure, build steps.
Step 2 (after I approve): build on a local branch, one step per message, and tell me what to test on localhost. Use Anassa's real data.
Step 3: do NOT push, merge or deploy until I say so. When I say, push for a Vercel preview that is behind the team login.

Rules: volumes exactly as exported, skip exact duplicates only, flag missing data, no private address field, team-only.
```

---

## Phase 2 · Baseline + results (Sam Days 3 + 10)

**Done when**
- [ ] Semrush Position Tracking CSV imports with date, position and ranking page
- [ ] First import saved as baseline; next imports show change vs baseline
- [ ] GSC + GA4 numbers pulled by API for a set date range
- [ ] GBP numbers typed in; Whitespark grid uploaded (CSV or screenshot)
- [ ] Anassa's baseline (Nov 17, 2026) matches her Baseline Rankings tab

**Screens:** Baseline + results tab (rankings table: keyword, start, now, change, ranking page, owner page, flag) · starting numbers cards (GSC, GA4, GBP, map grid) · monthly import · simple trend per keyword.

**Tables:** `rank_snapshots` (client, keyword, date, position, ranking_url, import_id) · `metric_snapshots` (client, metric, value, date_from, date_to, source: gsc / ga4 / gbp / manual) · `map_grids` (client, keyword, date, found_points, total_points, file) · `google_connections` (client, gsc property, ga4 property, token ref).

**Prompt to paste**
```
Phase 2 of SEO Hub: baseline + results (Sam Days 3 and 10). Phase 1 is done.
Read the phase 2 section of docs/seo-hub-phases.md and Day 3 of docs/local-seo-playbook.md.

No mockups. Build directly in the same HQ style as phase 1.
Step 1 (plan only): tables, Semrush CSV import rules, GSC + GA4 API setup (free, OAuth), how monthly comparisons work.
Step 2 (after I approve): build on a local branch step by step with Anassa's real baseline (10 keywords, Nov 17, 2026; GSC 1,020 impressions / 65 clicks; GA4 882 sessions; GBP 182 views; 0 of 18 map grid points). Show start vs now, change, ranking page vs owner page and swapped-page flags. Tell me what to test on localhost.
Step 3: do NOT push, merge or deploy until I say so.

Rules: rank tracking stays in Semrush (US, national), we only import it. Same date-range length for every comparison. GBP typed in by hand.
```

---

## Phase 3 · Ideal sitemap + SEO hotspots (Sam Days 5–6)

**Done when**
- [ ] Page list with IDs (P1, P2…), keep / improve / new, structure choice
- [ ] Keyword owner per page (home / service / location)
- [ ] Hotspots per page with live character counters (title 50–60, meta 150–160 ending with a CTA, H1, URL)
- [ ] Swapped-page flags from phase 2 rankings
- [ ] Page briefs: BrandScript (once per client) + 11-section StoryBrand copy, V1 / V2 status
- [ ] Send hotspots to ClickUp Web Page tasks

**Screens:** Sitemap + hotspots tab (page list + hotspot editor) · Page briefs tab (BrandScript form, page brief form).

**Tables:** extend `pages` (page_code, structure, status, owner_type, title, meta, h1, url, v_status) · `brandscripts` (client, A–P fields) · `page_briefs` (page, 11 sections, buying questions, proof, links to/from) · `clickup_links` (client, list id, page ↔ task id).

**Prompt to paste**
```
Phase 3 of SEO Hub: ideal sitemap + SEO hotspots + page briefs (Sam Days 5–6). Phases 1–2 are done.
Read the phase 3 section of docs/seo-hub-phases.md and Days 5–6 of docs/local-seo-playbook.md.

No mockups. Build directly in the same HQ style.
Step 1 (plan only): tables, ClickUp sync for Web Page tasks, how hotspots will later push to WordPress.
Step 2 (after I approve): build on a local branch step by step using Anassa's pages (19 pages, live and not-live), with character counters, keyword owner, swapped-page flags and V1/V2 status. Tell me what to test on localhost.
Step 3: do NOT push, merge or deploy until I say so.

Rules: title 50–60 chars, meta 150–160 ending with a CTA, state abbreviation in URLs, full state name in titles, no invented claims in briefs.
```

---

## Phase 4 · GBP + link database (Sam Days 4, 7, 8–9)

**Done when**
- [ ] Competitor check per service (Maps search, primary + additional categories, review count, newest review, average)
- [ ] Whitespark ranking factors checklist (client vs competitors)
- [ ] Business details: public side only (private address never shown)
- [ ] GBP care: services/products (one per service page), review request email + tracker, 13-week post calendar with UTM links
- [ ] Link database: BrightLocal CSV split into 3 waves automatically, Backlink Gap CSV, local + premier links, status per link

**Screens:** GBP check tab · GBP care tab (products, reviews, post calendar) · Link database tab (waves, competitor links, local links).

**Tables:** `competitors` · `competitor_reviews` · `factor_checks` · `gbp_profile` (public fields) · `gbp_products` · `review_requests` · `gbp_posts` (week, topic, CTA page, UTM, image need, status) · `links` (type: citation / backlink / local / premier, wave, domain, authority, verification, owner, status).

**Prompt to paste**
```
Phase 4 of SEO Hub: GBP check, GBP care and link database (Sam Days 4, 7, 8–9). Phases 1–3 are done.
Read the phase 4 section of docs/seo-hub-phases.md and Days 4, 7 and 8 of docs/local-seo-playbook.md.

No mockups. Build directly in the same HQ style.
Step 1 (plan only): tables, BrightLocal + Backlink Gap CSV import rules, UTM builder.
Step 2 (after I approve): build on a local branch step by step using Anassa (S1–S3, Staten Island), including the 13-week post calendar and the 3 citation waves. Tell me what to test on localhost.
Step 3: do NOT push, merge or deploy until I say so.

Rules: never store or show the private address; review tracker keeps only customer ref, date, channel, result; waves = rows 1,4,7… / 2,5,8… / 3,6,9…; no GBP API yet.
```

---

## Phase 5 · Plugin connection + automation

**Done when**
- [ ] `POST /api/vibe/checkin` receives each site's signed daily check-in (HMAC verified, see `vibe-seo-handoff-notes.md`)
- [ ] `/clients/{site id}` route works (the agency hub links there)
- [ ] Push keyphrase, title, meta (and schema) to a page from SEO Hub; result shows back
- [ ] Change log of every push
- [ ] Slack alerts (rank drops, swapped pages, pages off page 1)
- [ ] ClickUp tasks from quick wins
- [ ] Claude drafts (metas, GBP posts, page briefs) marked "draft" until reviewed

**Screens:** Sites (connection status per client, last check-in) · push preview + confirm · Change log · Automation settings (Slack channel, ClickUp list, which alerts).

**Tables:** `sites` (client, site id, url, key ref, last check-in, latest payload) · `push_log` (page, fields, before, after, who, when, result) · `site_reports` · `alerts` · `drafts` (type, content, status: draft / approved).

**Prompt to paste**
```
Phase 5 of SEO Hub: connect to client sites through the Vibe SEO plugin + automation. Phases 1–4 are done.
Read the phase 5 section of docs/seo-hub-phases.md and docs/vibe-seo-handoff-notes.md (check-in API, routes, what Vibe SEO already does).

No mockups. Build directly in the same HQ style.
Step 1 (plan only): the /api/vibe/checkin endpoint (HMAC over the raw body, 10-minute window, constant-time compare), the /clients/{site id} route, how pushes to sites will work (only SEO fields), Slack alerts, ClickUp tasks, Claude drafts.
Step 2 (after I approve): build the SEO Hub side on a local branch step by step (Sites, push preview/confirm, Change log, Automation settings) using Anassa's site. Any change needed in Vibe SEO goes in the Vibe SEO plugin only (never Vibe Admin). Tell me what to test on localhost.
Step 3: do NOT push, merge or deploy until I say so.

Rules: every push needs a preview + confirm and is logged; Claude drafts are never published without review; plugin accepts SEO fields only; connection keys never leave the server.
```

---

## Phase 6 (later) · Client report view (could replace Agency Analytics)

Alexia's idea (Nov 19, 2026): "We could eventually replace Agency Analytics maybe and have clients see that view." Only after phases 1–5 work for the team. It also has a "Client Reports" card on the portal (Phase 0), marked "coming later".

**Done when**
- [ ] Read-only report per client: rankings vs baseline, GSC, GA4, GBP, map grid, what we did this month
- [ ] Client login (or a private share link) that shows only their own data, nothing editable
- [ ] Monthly PDF / email version of the report
- [ ] Looks branded (agency colours, client logo)

**Screens:** Client report (one page, read-only) · Report settings (which sections show) · Monthly email preview.

**Tables:** `client_users` (client, email, role: viewer) · `report_settings` · `report_archive` (month, PDF, sent_at). RLS: viewers see only their own client.

**Prompt to paste**
```
Phase 6 of SEO Hub: a read-only client report view that could replace Agency Analytics. Phases 1–5 are done.
Read the phase 6 section of docs/seo-hub-phases.md.

Step 1 (plan only): client access (login or private link, separate from the team password), row-level security so clients only see their own data, monthly PDF/email.
Step 2 (after I approve): build on a local branch step by step using Anassa's real data (rankings vs baseline, GSC, GA4, GBP, map grid, what we did this month), in the HQ style. Tell me what to test on localhost.
Step 3: do NOT push, merge or deploy until I say so.

Rules: read-only for clients, no private address, no internal notes or competitor data shown to clients.
```
