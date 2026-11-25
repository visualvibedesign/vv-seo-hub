# SEO Hub: Project Context

> Read this first. It explains what we're building, why, for whom, and the decisions made so far. Update it at the end of every build step.

## 0. Start here (for Claude in any account)

- **What:** SEO Hub (`vv-seo-hub`), the SEO-only sister app of Visual Vibe HQ (`../visual-vibe-dashboard`). One place for every SEO client's strategy, data and (later) automation.
- **Rules + process:** `CLAUDE.md` (hard rules), `docs/seo-hub-context-pack.md`, `docs/seo-hub-phases.md`, `docs/local-seo-playbook.md` (Sam's 10-Day Rank Yourself process), `docs/vibe-seo-handoff-notes.md` (plugin connection).
- **Current phase plan:** `docs/phase-1-plan.md` (steps ticked as they're done).
- **No design mockups.** Built directly in the HQ style; styles/components are **copied** from HQ (HQ is read only).
- **Where we are (Nov 25, 2026):** phase 1 steps 1–5 built (database, sign-in, clients, CSV import, keyword database), backed up in `5793ec7`. Now redoing phase 1 to match the design on local branch `redesign` (plan: `docs/redesign-audit.md`, screens: `docs/design/`). Redesign steps 1–2, 3a (step-by-step guide, migration 0003 seo_guide_progress; auto-ticks from data, hand ticks stored), 3b (client Overview, Client.png) and 3c (hub Overview, Main.png). Step 4 Keywords: 4a database restyle, 4b matrix (Anassa A1 primaries + 6 backups), 4c clusters (18 pages imported with scripts/import-clusters.ts). Step 5 Templates: library, editor with live preview, apply (copy per client); 0004 ran, 0004–0006 ran. Step 6a: Uploads page (Day 1 + Day 2 needs from real imports, drop zone with preview, Needs you); 6b Day 2 plain-code auto-fill (roles + services, Ready to review, approve per row / all, reject; never Primary, never overwrites). 6c-1: Claude intent (Haiku) with estimate-then-run, AI log; models in src/lib/aiModels.ts. Next 6c-2 (needs migration 0007). Earlier: step 1 (sidebar) and step 2 (All clients table + 4-step Add client wizard; migration 0002 adds seo_clients.industry) done. Anassa: 247 keywords (31 "Needs role"), 10 tracked. Bulk imports for any client: `scripts/import-csvs.ts`.
- **Repo:** https://github.com/visualvibedesign/vv-seo-hub (agency account, keep **private**). Never push, merge or deploy until Angel says so; build on local branches.

## 1. Overview

An internal SEO dashboard for **Visual Vibe Design** (Rogers, AR; remote team incl. Cebu). It follows Sam's local SEO process per client: keywords → baseline → GBP → sitemap + hotspots → page briefs → GBP care → links → results. Over time it replaces the SEO pieces that run on the agency hub (app.alexialynn.co) through the Vibe SEO plugin.

- **Owner / builder:** Angel (Web Developer & SEO Support; also owns the Vibe SEO plugin)
- **Stakeholder:** Alexia (agency lead; owns HQ and the Vibe Admin plugin)
- **Test client:** Anassa Wax & Beauty (Staten Island, NY)

## 2. Goals

1. Keywords live in SEO Hub instead of Google Sheets (Alexia, Nov 19).
2. One flow per client following Sam's Days 1–10.
3. Baseline vs results reporting (phase 2), later a client report view (phase 6).
4. Connect to client sites through the Vibe SEO plugin (phase 5) and replace the hub's SEO workspace.
5. Don't rebuild what other tools do (Yoast, ClickUp tasks, rank tracking).

## 3. Users

| User | Needs |
|---|---|
| Angel | Builds and runs keyword research, baselines, reports |
| Alexia | Reviews strategy, approves |

**Team-only.** One shared team password (same as HQ). No per-person accounts, no Supabase Auth.

**Login (built, step 2):** own Sign in page (`/login`), same password (reads HQ's `settings.team_password_hash`, fallback `TEAM_PASSWORD_HASH`), same `vv_session` cookie + `SESSION_SECRET` as HQ, so an HQ cookie works here too (on localhost both apps share it since cookies ignore ports). **Later:** custom domains + `SESSION_COOKIE_DOMAIN=.visualvibedesign.com`; with `HQ_LOGIN_URL` set, signed-out people go to HQ's sign-in and come back. The hash is **read only**: SEO Hub never writes it (no change-password code here; that stays in HQ › Settings). Log out clears the shared cookie, so it also signs this browser out of HQ.

**Sidebar bottom = HQ's (Nov 20, matches HQ commit caeac2f):** one **Switch app** button (apps icon, white bordered pill, pinned to the bottom) that opens HQ's `/apps` and stays signed in. **Log out is on HQ's Apps page**, like in HQ (SEO Hub's own `/login` "You're in" screen still has Sign out as a fallback while the apps are on different domains). Dark mode is the icon button in the page header (`HeaderTools`), like HQ's next to Refresh; on phones it's in the sidebar top bar.

## 4. Features

### Phase 1 (planned, see `docs/phase-1-plan.md`)
Clients (site URL + plugin site id, Home/S1–S3, A1–A3, account checklist), CSV import (Keyword Planner, Semrush; Sheet source only for testing), master keyword database with an editable KP range column + bulk-set, 3×3 matrix (+ Home row), clusters, Export tracked list for Semrush. Built for every client, not just Anassa.

### Routes

| Route | Page | Phase |
|---|---|---|
| `/login` | Sign in | 1 ✅ |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Sign-in API | 1 ✅ |
| `GET /api/clients/list`, `get?site=`, `site-id?url=`, `POST save`, `POST account` | Clients API (signed in) | 1 ✅ |
| `POST /api/imports/preview`, `POST commit`, `GET list?site=`, `GET file?site=&id=`, `GET delete-check?site=&id=`, `POST delete` | Imports API (signed in) | 1 ✅ |
| `/` | SEO Hub Overview (numbers, clients, phases) | 1 ✅ |
| `/clients` | All clients | 1 ✅ |
| `/clients/new`, `/clients/{site id}/edit` | Add / Edit client | 1 ✅ |
| `/clients/{site id}` | Overview tab (unknown id → "not an SEO Hub client yet" + Add client) | 1 ✅ |
| `/clients/{site id}/keywords` (Matrix), `/keywords/database`, `/keywords/clusters` | Keywords | 1 (steps 5–7) |
| `/clients/{site id}/keywords/import` | CSV import wizard + history | 1 ✅ |
| `/clients/{site id}/pages` | Pages | 3 |
| `/clients/{site id}/plan` | Site plan | 3 |
| `/clients/{site id}/reports` | Reports | 2 |
| `/clients/{site id}/log` | Work log | 5 |
| `/clients/{site id}/notes` | Notes & links | 5 |
| `/clients/{site id}/conversions` | Conversions (hub `cro` tab) | later |
| `POST /api/vibe/checkin` | Plugin check-in (HMAC, not team login) | 5 |
| `GET /api/health` | Setup check (signed-in only) | done |

**Navigation (design, Nov 25):** hub mode = Overview · All clients · Templates · Automation + a lime "+ Add client" button; clients are **never** listed in the sidebar (they live on All clients and in the client switcher). Client mode = "← All clients", the client switcher card (search; keeps you in the same section), Overview · Step-by-step guide · Uploads + auto-fill, then foldable groups KEYWORDS (Matrix, Database, Clusters, Import) · RESULTS (Baseline + reports, Day 10 review) · PAGES (Sitemap + hotspots, Site plan, Page briefs) · LOCAL (GBP check, GBP care, Links) · SITE (Connection + work log, Notes & links, Conversions "Later"). Fold state + collapse-to-icons are remembered in the browser. Not-built sections open a "coming" card with their phase. Lists: `CLIENT_TOP`, `CLIENT_GROUPS`, `HUB_SECTIONS` in `src/lib/clientSetup.ts`.

### Later phases
2 Baseline + results · 3 Sitemap + hotspots + page briefs · 4 GBP check/care + link database · 5 Vibe SEO check-in + automation · 6 Client report view. Details: `docs/seo-hub-phases.md`.

## 5. Tech Stack

| Layer | Choice | Role |
|---|---|---|
| Frontend | React 19 + Vite 8 + TypeScript | Same setup as HQ |
| Styling | Tailwind CSS v3 + HQ brand tokens | v3 like HQ (v4's native scanner is blocked on Angel's PC) |
| Routing & data | React Router 7 + TanStack Query | |
| Backend | Vercel functions (`/api`) | All keys server-side |
| Database | Supabase, **same project as HQ** | Tables prefixed `seo_`, RLS on, server-only access |
| Files | Supabase Storage (bucket `seo-imports`, private) | Raw CSVs, untouched |
| CSV | Papa Parse | Phase 1 |
| Access | HQ's shared team password + signed `vv_session` cookie | |
| Hosting / code | Vercel + GitHub | |

Not used: Semrush API (CSV only), GBP API (typed in), Whitespark API (CSV/screenshot).

## 6. Architecture

- Browser → `/api/*` (Vercel functions) → services → Supabase. The browser never talks to Supabase, Google or Claude directly.
- Code pattern (same as HQ): pages → components, data in hooks; api routes → services → clients.
- `npm run dev` runs `/api` through `server/dev/apiDevPlugin.ts` (copied from HQ).

### Plugin connection (Vibe SEO, phase 5; prepared in phase 1)
- Every client has a **site URL** and **site id** = `md5` of the home URL with `http(s)://` and `www.` removed, lowercased, trailing `/` removed (path kept). Same id the plugin (`class-seo-link.php`) and the agency hub use. Anassa: `anassabeauty.com` → `c6e74adc272c98005f3086f85c88b9da`.
- The agency hub links to `{seo_hub_url}/clients/{site id}`; that's our client route.
- Phase 5: sites `POST /api/vibe/checkin` daily (headers `X-Vibe-Site`, `X-Vibe-Time`, `X-Vibe-Signature` = HMAC-SHA256 of `"<time>.<raw body>"` with the site's connection key; verify on the raw body, constant-time, ±10 minutes). Matched to a client on `site.id`. Connection keys never leave the server.
- Vibe SEO is Angel's (can change); Vibe Admin is Alexia's (never change).

## 7. Data Model (planned, phase 1)

```
seo_clients          id, site_id (unique), site_url, name, city, state, ideal_client, usp, success_12mo, status, notes   (NO address)
seo_client_categories client_id, code (Home|S1|S2|S3|FAQ), name, in_matrix, sort
seo_client_services  client_id, category_id, name, sort          (e.g. S2 → Eyebrow lamination, Eyebrow tint, …)
seo_client_areas     client_id, code (A1|A2|A3), name, state, status (active|n_a)
seo_client_accounts  client_id, kind, status (ready|pending|n_a), next_action, note   (never passwords)
seo_imports          client_id, source (kp|semrush|sheet), report, file_name, storage_path, location, filter, column_map, counts
seo_keywords         client_id, keyword, keyword_key, role (primary|secondary|faq|near_me), service_id, area_id, suggested, intent,
                     kp_volume TEXT (typed in the app), kp_volume_by, kp_volume_at,
                     semrush_volume, kd, cpc, track, status (keep|later|rejected), notes
seo_keyword_sources  keyword_id, import_id, source, segment, volume_raw TEXT, kd, cpc, intent, raw jsonb
seo_matrix_cells     client_id, category_id, area_id, state (target|n_a|pending), note
seo_matrix_keywords  cell_id, keyword_id, kind (primary|backup), sort          (max one primary per cell)
seo_pages            client_id, category_id, name, url, priority, status (live|scheduled|planned), why, content_ideas[]
seo_page_keywords    keyword_id (primary key = one page per keyword), page_id, role (primary|secondary|faq)
```

Migration: `supabase/migrations/0001_seo_phase1.sql` (12 tables, 1 function `seo_touch_updated_at`, private bucket `seo-imports` 20 MB/file). One transaction; only creates `seo_*` things, never touches HQ's tables. **Run in Supabase on Nov 20, 2026** (all 12 tables + bucket confirmed by `/api/health`).

Data rules: KP range is text (`10–100`, `No data`, `Not checked`); Semrush `0` stays 0, blank = null ("no data"); Track is its own toggle (not tied to role); missing-data flags are worked out when read (not stored). KP segments: Richmond County shown, "All" stored but hidden (`segment`). Exact duplicate = same text ignoring case + extra spaces, same source; close variants kept.
**Import merge rules (Angel, Nov 20):** every CSV row is kept in history (`seo_keyword_sources`, raw row included); exact duplicates inside one file are skipped; an existing keyword's EMPTY Semrush volume / KD / CPC / intent is filled, a FILLED one is never overwritten unless “Use the new numbers” is ticked for it in the preview. KP ranges: KP and Semrush imports never touch them; only the Sheet (master_db) import fills an EMPTY one (`kp_volume_by = 'sheet'`); typed ranges are never overwritten. KP CSV numbers are stand-ins: history only. KP file totals ("All" / "Richmond County" rows with no keyword) are kept on the import (`column_map.totals`), not in the table. Raw file: Storage `seo-imports/<site id>/<import id>/<file>`, downloadable from the history. **Delete this import** (history, confirm with counts first): removes its history rows, its raw file and the keywords that only came from it; keywords also in another import stay; numbers it filled into kept keywords stay.

RLS on all, no policies (server-only). Read-only from HQ: `settings.team_password_hash`. Storage bucket `seo-imports` (`<site id>/<import id>/<file>`).

## 8. Brand & Styling

Same as HQ (`src/styles/tokens.css`, copied): Fraunces headings with a purple italic word (#7C5CE6), Inter body, bg #F7F5FF, text #131314, sidebar #EEEAFF, active pill #BFAFFF, white 22px cards with #ECE8FB border and soft purple shadow, lime #BAD657 pill buttons, light + dark mode, phone layout (≤900px). SEO extras: role tags Primary teal, Secondary light blue, FAQ orange, Near me gray; status good #2e8b57 / ok #d39b16 / bad #c9483c; grey table header rows. Change colors in `tokens.css`, not in components.

## 9. Apps & Accounts

| What | Status |
|---|---|
| GitHub repo `visualvibedesign/vv-seo-hub` | Done (keep private) |
| Supabase (HQ's project) | Keys in `.env.local`; 12 `seo_` tables + `seo-imports` bucket created Nov 20 |
| Vercel project | Not yet (only when Angel says) |
| Custom domain `seo.visualvibedesign.com` | Waiting on Alexia |
| Vibe SEO plugin `seo_hub_url` setting | Phase 5 |
| Google Cloud (GSC + GA4 APIs) | Phase 2 |

## 10. Open Questions

- [x] KP CSV stand-ins (`50.0`): kept as raw only; the KP range is typed in the app (editable column + bulk-set for selected rows). Decided Nov 20. Built for every client; the Sheet import is only for testing Anassa.
- [x] KP segments: Richmond County (= Staten Island) shown; "All" stored, not shown (Nov 20)
- [x] Exact duplicate = same text ignoring case + extra spaces, same source; close variants kept (Nov 20)
- [x] Conversions (CRO): 8th tab, "coming later" (Nov 20)
- [x] Anassa "Full butt": S1 Brazilian & Bikini (on anassabeauty.com/services) (Nov 20)
- [ ] Alexia OK with the same Supabase project as HQ?
- [ ] Custom domains + who manages DNS (needed for the shared cookie, `SESSION_COOKIE_DOMAIN`, and the plugin's `seo_hub_url`)
- [ ] **Later (after phase 1, Angel Nov 20; don't build yet):** HQ's /apps portal becomes the ONLY sign-in. The SEO Hub card on /apps gets a handoff link into SEO Hub; SEO Hub's own /login then goes away (or just sends people to HQ). Decide how the handoff works: shared cookie on a custom domain (`SESSION_COOKIE_DOMAIN`) vs a short-lived signed handoff token while on different domains.
- [ ] HQ's "SEO & GBP helpers" page (/seo): keep, or replaced by SEO Hub later?

## 11. Folder Structure

```
vv-seo-hub/
├─ api/health.ts                # GET /api/health (signed in): which seo_ tables/bucket exist (no data)
├─ api/auth/[action].ts        # login, logout, me
├─ api/clients/[action].ts     # list, get, site-id, save, account
├─ api/imports/[action].ts     # preview (dry run), commit, list, file (raw file link)
├─ server/
│  ├─ clients/supabase.ts       # db(), must(): server-only Supabase client (from HQ)
│  ├─ utils/auth.ts             # password check (reads HQ's hash, read only) + vv_session cookie (from HQ)
│  ├─ utils/siteId.ts           # plugin-compatible site id + URL cleanup
│  ├─ services/clientService.ts # clients: read, save (services keep ids), site id check, accounts
│  ├─ services/importService.ts # CSV import plan (preview + commit), merge rules, history, raw file link
│  └─ dev/apiDevPlugin.ts       # runs /api in npm run dev (from HQ)
├─ scripts/check-site-id.ts     # npm run check:site-id (Anassa → c6e74adc…)
├─ supabase/migrations/         # 0001_seo_phase1.sql
├─ src/
│  ├─ main.tsx, App.tsx         # entry + routes
│  ├─ pages/                    # HomePage (hub Overview), LoginPage, ClientsPage, ClientFormPage, client/{Overview,Import,ComingSoon}Page
│  ├─ hooks/useClients.ts       # TanStack Query: clients, client, save, account
│  ├─ hooks/useImports.ts       # imports list, preview, commit
│  ├─ lib/clientSetup.ts        # shared lists: categories, areas, accounts, CLIENT_SECTIONS (sidebar), Sam's 9 steps
│  ├─ lib/importRules.ts        # shared: keyword key, number parsing, reports, column auto-match
│  ├─ lib/readCsv.ts            # browser: reads KP (UTF-16) / Semrush / Sheet CSVs with Papa Parse
│  ├─ lib/ui.ts                 # HQ class strings (CARD, BTN_LIME, FIELD, pills)
│  ├─ types/seo.ts              # shared types (browser + server)
│  ├─ lib/api.ts                # call(), ApiError, getSession, login, logout, safeNext
│  ├─ components/layout/        # AppLayout, Sidebar (hub nav / client switcher + sections, Switch app), HeaderTools (dark mode), RequireSession, ClientLayout (header + breadcrumb)
│  ├─ components/ui/            # Logo, ThemeToggle, NavIcon, Loading, ConfirmDialog (from HQ)
│  ├─ components/import/        # ImportHistory (list, raw file download, Delete this import)
│  ├─ lib/theme.ts              # light/dark (from HQ)
│  └─ styles/                   # tokens.css, index.css (from HQ)
├─ public/brand/                # logos + icons (from HQ)
├─ docs/                        # context pack, phases, playbook, handoff notes, phase-1-plan
├─ test-data/anassa/            # git-ignored, local only: Sheet exports + Semrush tracking export for testing
├─ CLAUDE.md, CONTEXT.md, START-HERE.md
└─ .env.example                 # .env.local is git-ignored
```

Planned phase 1 layout: `docs/phase-1-plan.md` §6.

## 12. Conventions

- **Env vars** (`.env.example` lists names only; values in `.env.local` + Vercel):

  | Name | What | Set |
  |---|---|---|
  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | HQ's Supabase project, server only | ✅ local |
  | `SESSION_SECRET` | Same as HQ (shared cookie) | ✅ local |
  | `TEAM_PASSWORD_HASH` | Fallback password hash (same as HQ) | ✅ local |
  | `SESSION_COOKIE_DOMAIN` | `.visualvibedesign.com` once domains exist | empty |
  | `HQ_LOGIN_URL` | Send sign-in to HQ (planned) | — |
  | `VITE_HQ_URL` | HQ address for the sidebar's "Switch app" (public). Default: localhost:5173 in dev, visual-vibe-dashboard.vercel.app in builds | empty (default) |

- **Run it:** `npm install`, then `npm run dev -- --port 5180` → http://localhost:5180 (HQ uses 5173). Restart after editing `.env.local`. Checks: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:site-id`. Database check: http://localhost:5180/api/health.
- **Database changes:** new migration file in `supabase/migrations/`; Angel reviews the SQL, then runs it in Supabase → SQL Editor (it's HQ's live project). Only create/alter `seo_*` objects.
- Never commit secrets. HQ and Vibe Admin are read only: copy what we need, never edit them.
- Volumes exactly as exported; skip exact duplicates only; flag missing data; never store or show a private address.
- **Responsive rule (UI pass, Nov 20):** for a "2 columns on tablets, 1 on phones" grid use `[@media(min-width:901px)_and_(max-width:1199px)]:grid-cols-2 phone:grid-cols-1`. A plain `[@media(max-width:1199px)]:grid-cols-2` beats `phone:` in the CSS and leaves phones on 2 columns. Check pages at 1440, 1280 and 390 px wide, in light and dark.
- Claude drafts are never published without review.
- One step per message; Angel tests on localhost; update this file and tick `docs/phase-1-plan.md` after each step.
- Never push, merge or deploy until Angel says so.

## 13. Milestones

0. **Done.** Project setup (Nov 20, 2026): Vite + React + Tailwind like HQ, HQ styles copied, placeholder page, `.env.example`, git + remote, pushed to `main`.
1. **In progress (branch `phase-1`).** Phase 1: clients + keywords + import + matrix + clusters, plugin-ready (site id, `/clients/{site id}`, 8 hub tabs). Plan + ticked steps: `docs/phase-1-plan.md`.
   - [x] Step 1 (database): migration run Nov 20, health check all `ok`.
   - [x] Step 2 (sign-in): team password (read only from HQ), `vv_session` cookie shared with HQ, Sign in page, Log out.
   - [x] Step 3 (clients): list, add/edit (category name vs services box, list-in-name catch, pending services saved), `/clients/{site id}` + 8 tabs, Overview, account checklist, HQ's Switch app sidebar. Anassa entered Nov 20.
   - [x] Step 4 (CSV import wizard) built + sidebar sections. Not committed yet (Angel tests first).
2. Phase 2: baseline + results.
3. Phase 3: sitemap + hotspots + page briefs.
4. Phase 4: GBP + link database.
5. Phase 5: plugin connection + automation.
6. Phase 6 (later): client report view.
