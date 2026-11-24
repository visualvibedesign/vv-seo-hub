# SEO Hub – Phase 1 plan

Clients + keyword database + CSV import + 3×3 matrix + clusters (Sam Days 1–2), built so phase 5 (Vibe SEO plugin connection) needs no rebuild. Written Nov 20, 2026. **Status: approved Nov 20 (with answers in §9). Building on branch `phase-1`.**

Source docs: `seo-hub-context-pack.md`, `seo-hub-phases.md` (rules, phase 0, phase 1), `local-seo-playbook.md` (Days 1–2), `vibe-seo-handoff-notes.md`, HQ code in `../visual-vibe-dashboard` (read only), Vibe SEO 1.0.0 source from the handoff zip (read only).

---

## 1. What we reuse from HQ

Copied (never imported across folders, never edited in HQ). ✅ = already in the repo from setup.

| From HQ | Used for | |
|---|---|---|
| `src/styles/tokens.css`, `index.css`, `tailwind.config.js` | Colors, fonts, dark mode, `phone:` breakpoints, laptop zoom | ✅ |
| `components/ui/Logo`, `ThemeToggle`, `NavIcon` | Sidebar, headers | ✅ |
| `components/ui/Loading` | BootLoader, TopBar ✅ · add `PageSkeleton`, `CardSkeleton`, `Spinner` | part |
| `components/layout/AppLayout`, `Sidebar` | Page frame, collapse, phone Menu (SEO nav instead of HQ's) | ✅ |
| `components/ui/ConfirmDialog`, `InfoNote` | "Delete import?", tips on the import wizard | copy |
| `pages/LoginPage.tsx` + `components/layout/RequireSession.tsx` | Sign in (same look, says "SEO Hub") | copy |
| `lib/api.ts` → `call()` + `ApiError` | Every browser → `/api` call | copy |
| `server/utils/auth.ts` | Password check + `vv_session` cookie (minus "change password", which stays in HQ) | copy |
| `server/clients/supabase.ts` (`db()`, `must()`) | Server-only Supabase client | copy |
| `server/dev/apiDevPlugin.ts` | `/api` in `npm run dev` | ✅ |
| Page patterns | Breadcrumb + Fraunces header with purple italic word, white 22px cards, lime pill buttons, status pills, KeyNumbers-style number cards, pill tabs, HQ table look | follow |

**New SEO tokens** (added to `tokens.css`, light + dark): role tags **Primary teal**, **Secondary light blue**, **FAQ orange**, **Near me gray**; priority **High / Medium / Low**; status **good #2e8b57 / ok #d39b16 / bad #c9483c**; grey table header rows.

---

## 2. Fit with the Vibe SEO plugin (phase 5 ready)

From `vibe-seo-handoff-notes.md` and the plugin code (`includes/class-seo-link.php:74`, `class-seo-workspace.php:289`).

**Site id:** each client stores its **site URL** (the WordPress home URL) and **site id**, computed exactly like the plugin:

```
site_id = md5( strip trailing "/" ( lowercase( remove "http(s)://" + "www." from the start of home URL ) ) )
```

- Same id the plugin sends in its check-in (`site.id`) and the agency hub uses.
- Anassa: `https://anassabeauty.com/` → `anassabeauty.com` → **`c6e74adc272c98005f3086f85c88b9da`**.
- The path is kept (a site at `example.com/shop` gets a different id from `example.com`).
- Computed on the server when the client is saved; shown read-only on the client form with a "matches the plugin" note. Unique per client.
- Changing the URL changes the id (and the client's links). The form warns first.
- Phase 5 just matches check-ins on `site_id`; no data moves.

**Routes:** client pages live at **`/clients/{site id}`**. That's the exact link the agency hub's "SEO client" badge, site name and SEO report button open once `seo_hub_url` is set.

**Client tabs** follow the hub workspace that SEO Hub replaces (`VVDA_SEO_Workspace`):

| Tab | Route | Phase | Phase 1 content |
|---|---|---|---|
| Overview | `/clients/{id}` | **1** | Client card, Sam's 9 steps, kickoff answers, Home/S1–S3, A1–A3, account checklist |
| Keywords | `/clients/{id}/keywords` | **1** | Sub-views: **Matrix** · **Database** · **Clusters** · **Import** |
| Pages | `/clients/{id}/pages` | 3 | "Coming in phase 3" (page list + hotspots; site page list in phase 5) |
| Site plan | `/clients/{id}/plan` | 3 | "Coming in phase 3" (ideal sitemap; redirects queue later) |
| Reports | `/clients/{id}/reports` | 2 | "Coming in phase 2" (baseline + results, monthly reports) |
| Work log | `/clients/{id}/log` | 5 | "Coming in phase 5" (push log + change log) |
| Notes & links | `/clients/{id}/notes` | 5 | "Coming in phase 5" |
| Conversions | `/clients/{id}/conversions` | later | "Coming later" (hub `cro` tab; 8th tab, decided Nov 20) |

Clusters sit under Keywords for now; they become the start of the Pages tab in phase 3 (same `seo_pages` table).

---

## 3. Supabase tables

Same Supabase project as HQ. **Every SEO table starts with `seo_`**, so it never mixes with HQ's tables. Same model as HQ: **RLS on, no policies**, so only our server (secret key) can read/write and the browser never talks to Supabase. No user table (shared team password). Migration: `supabase/migrations/0001_seo_phase1.sql`, which Angel runs once in Supabase → SQL Editor.

The only HQ thing SEO Hub touches: it **reads** `settings.team_password_hash` (so the password is the same). It never writes HQ tables.

| Table | Columns (main ones) | Notes |
|---|---|---|
| `seo_clients` | id, **site_id** (unique, 32 hex), **site_url**, name, city, state, ideal_client, usp, success_12mo, status (active/paused), notes, created_at | **No address field of any kind.** Phase 5 adds check-in tables keyed on `site_id`. |
| `seo_client_categories` | id, client_id, code (`Home`/`S1`/`S2`/`S3`/`FAQ`), name, in_matrix bool, sort | Matrix rows = Home + S1–S3. `FAQ` (help pages like /faqs/, /first-timers/) is a cluster category, not a matrix row |
| `seo_client_services` | id, client_id, category_id, name, sort | The individual services under each category (Anassa S2: Eyebrow lamination, Eyebrow tint, Eyebrow waxing, Full brow bundle, Full face, Chin, Neck, Nose, Sideburns, Upper lip). Keywords link to a service; the category follows from it |
| `seo_client_areas` | id, client_id, code (`A1`–`A3`), name, state, status (active / n_a) | Anassa: A1 Staten Island, A2/A3 N/A |
| `seo_client_accounts` | id, client_id, kind, status (ready / pending / n_a), next_action, note | Domain/DNS, hosting, platform, GBP, GSC, GA4, Semrush, Whitespark, Clarity (+ Cloudflare, Ads, AI tool). **Never passwords.** |
| `seo_imports` | id, client_id, source (kp / semrush / sheet), report (kp_ideas, kp_volumes, keyword_magic, keyword_overview, keyword_gap, master_db, clusters), file_name, storage_path, file_size, location (KP location / Semrush database), filter (e.g. city), column_map, rows_total, rows_added, rows_merged, rows_skipped, note, created_at | One row per uploaded file |
| `seo_keywords` | id, client_id, keyword, keyword_key, role (primary / secondary / faq = "FAQ / content" / near_me / null), service_id, area_id (optional), suggested bool, intent, kp_volume **text**, kp_volume_by (typed / sheet), kp_volume_at, semrush_volume int, kd int, cpc numeric, track bool, status (keep / later / rejected), notes | `unique (client_id, keyword_key)`; a check keeps `keyword_key` in sync with `keyword` |
| `seo_keyword_sources` | id, keyword_id, import_id, source, segment, volume_raw **text**, kd, cpc, intent, raw jsonb | Every source's values kept separately, exactly as exported. `segment` = KP location row: Richmond County (shown) and All (stored, not shown) |
| `seo_matrix_cells` | id, client_id, category_id, area_id, state (target / n_a / pending), note | 3×3 + Home row |
| `seo_matrix_keywords` | cell_id, keyword_id, kind (primary / backup), sort | Max one primary per cell (real links, so a deleted keyword never leaves a broken id) |
| `seo_pages` | id, client_id, category_id, name, url (null until it exists), priority (high/medium/low), status (live / scheduled = built, not live / planned), why, content_ideas text[], sort | Clusters now; phase 3 adds hotspots. A page is a URL (`/brazilian-wax/`) or just a name ("Full Body Wax") until it's live |
| `seo_page_keywords` | page_id, keyword_id, role (primary/secondary/faq) | `unique (keyword_id)`, so **a keyword can't sit on two pages** |

**Storage:** private bucket `seo-imports` with the raw CSVs saved untouched (`<site id>/<import id>/<file name>`).

**How the data rules are enforced**
- **Volumes exactly as exported:** KP volume stays text (`"10–100"`), Semrush stays the integer it exported. Nothing is rounded, averaged or added. The raw row is kept in `seo_keyword_sources.raw`.
- **KP ranges are typed in the app (decided Nov 20).** KP CSVs only export stand-in numbers (`50.0`), so a KP import keeps the stand-in in `seo_keyword_sources.volume_raw` but **never** fills `kp_volume`. The range is set in the keyword table (see §5): an editable **KP range** column plus **bulk-set** for selected rows. The stand-in shows greyed next to an empty cell as a hint ("KP export: 50"); it's never used as the value. Works the same for every client.
- **Empty ≠ zero:** Semrush `0` is a real reading and stays 0; a blank Semrush or KD cell is stored as null and shows "no data". Semrush numbers with thousands commas (`"74,000"`) are read as 74000 (same number, not changed).
- **KP range values:** a range (`10–100`, `100–1K`…), `No data` (checked, KP had nothing) or `Not checked` (not looked up yet), all kept as text. Empty and `Not checked` both count as "missing KP".
- **Suggested keywords:** a page can have a "(suggested)" primary that has no search data yet (e.g. "first time waxing staten island"). Stored as a keyword with `suggested = true` and no volumes, shown as "Suggested · no data".
- **Skip exact duplicates only:** `keyword_key` = trimmed, lowercase, single spaces. Same key + same source = skipped (counted). Same key from a different source = merged (adds that source's numbers). Close variants ("brazilian wax" / "brazilian waxing") are **kept** as separate rows.
- **Flag missing data:** worked out when read (not stored, so never stale): no KP range, no Semrush, no KD, no service. Shown as warning chips plus a "Missing data" filter. Missing values show as "no data", never 0.
- **No private address:** there's no column for it and no address field on the client form.
- **Team-only:** every `/api` route checks the session first.

---

## 4. Sign-in

**Now (phase 1):** SEO Hub has its own Sign in page with the same look as HQ's.
- Same team password: it checks the hash in HQ's `settings` table (fallback `TEAM_PASSWORD_HASH`), so changing the password in HQ changes it here too.
- Same `vv_session` cookie format and same `SESSION_SECRET`, so an HQ cookie is valid here and vice versa.
- On localhost, cookies ignore ports, so **signed in on HQ (5173) = signed in on SEO Hub (5180)**.
- Change password / forgot password stay in HQ only.

**Later (custom domains):** `hq.visualvibedesign.com` + `seo.visualvibedesign.com`, with `SESSION_COOKIE_DOMAIN=.visualvibedesign.com` in both apps.
- HQ's sign-in sets one cookie for the whole domain and SEO Hub just reads it.
- New env var `HQ_LOGIN_URL`: when set, SEO Hub's Sign in page sends people to HQ's `/login?next=https://seo.…/clients/{id}` (HQ's `safeNext` already allows `seo.visualvibedesign.com`). When it's not set, SEO Hub uses its own sign-in (localhost, previews).
- Vercel previews (`*.vercel.app`) keep their own cookie and the team login, never public.
- Phase 5's `POST /api/vibe/checkin` is signed by the site (HMAC), not by the team login.

---

## 5. Screens

| Route | Screen |
|---|---|
| `/login` | Sign in |
| `/` | Clients list (cards: name, site, city, S1–S3, keyword count, primaries set x/9, last import) + Add client |
| `/clients/{id}` | **Overview** tab (see §2) |
| `/clients/{id}/keywords` | **Matrix** (3×3 + Home row) on top, **Database** table under it: filters (role, service, area, source, intent, missing data incl. "No KP range", tracked), role/intent tags, "Semrush 110 · KP 10–100", **editable KP range column**, Track toggle, edit role/service/status, **row checkboxes + bulk bar**, **Export tracked list** |
| `/clients/{id}/keywords/clusters` | One row per page, grouped by category (Home, FAQ, S1–S3): Page, Priority, Status (Live / Scheduled / Planned), Primary keyword, Volume · KD ("110 · KD 14", "30 · no KD", "No data"), Secondary keywords with their numbers, FAQ / content ideas (keywords + free-text ideas like "Link to /first-timers/"), Why. Numbers come from the database automatically, never typed twice. Under it: the "Why there's a Priority column" legend with the pages listed per priority |
| `/clients/{id}/keywords/import` | Wizard: source → upload → match columns → preview (new / merged / exact duplicates / flagged) → import. Import history with links to the raw file |
| `/clients/{id}/pages`, `/plan`, `/reports`, `/log`, `/notes` | "Coming in phase X" cards |

**KP range editing (every client):**
- Click a KP range cell → quick picks of Keyword Planner's ranges (`0–10`, `10–100`, `100–1K`, `1K–10K`, `10K–100K`, `100K–1M`) + `No data` + `Not checked` + type your own. Saved as text exactly as picked/typed. Keyboard: Enter saves, Tab/↓ moves to the next row, so a long list is quick.
- **Bulk-set:** tick rows (or "select all filtered"), bulk bar → **Set KP range** → pick `10–100` → applies to all selected (e.g. 20 keywords at once). Same bar also sets role, service, track, status.
- Handy flow: filter "No KP range" + sort by KP stand-in → tick a group → bulk-set → next group.
- Each change records `kp_volume_by` / `kp_volume_at`. Overwriting an existing range in bulk asks first ("6 of these already have a range").

**Import sources:** Keyword Planner (UTF-16, tab-separated, 2 title lines, auto-detected; stand-ins stored as raw only), Semrush Keyword Magic / bulk Keyword Overview / Keyword Gap (UTF-8 CSV). Parsed with Papa Parse in the browser (preview + column match); the server re-checks and saves.

**Sheet import (testing only):** a "Master Keyword Database" CSV source, used once to load Anassa and check phase 1 against her Google Sheet (it carries role, service and typed KP ranges). Not part of the normal flow for new clients; hidden behind "Other sources".

**Export tracked list:** CSV of tracked keywords with tags (S1/S2/S3/Home), ready for Semrush Position Tracking.

---

## 6. Folder structure

```
vv-seo-hub/
├─ api/                         # Vercel functions (thin: check session → service → respond)
│  ├─ auth/[action].ts          # login, logout, me
│  ├─ clients/[action].ts       # list, get (by site id), save, accounts
│  ├─ keywords/[action].ts      # list, update, track, matrix, pages, export
│  ├─ imports/[action].ts       # preview, commit, history, file
│  └─ health.ts
│                               # phase 5 adds api/vibe/checkin.ts
├─ server/
│  ├─ clients/supabase.ts       # db(), must() (from HQ)
│  ├─ services/                 # clientService, importService, keywordService, clusterService
│  ├─ utils/auth.ts             # from HQ
│  ├─ utils/siteId.ts           # plugin-compatible site id
│  └─ dev/apiDevPlugin.ts
├─ src/
│  ├─ pages/                    # LoginPage, ClientsPage, client/{Overview,Keywords,Clusters,Import,ComingSoon}Page
│  ├─ components/
│  │  ├─ layout/                # AppLayout, Sidebar, RequireSession, ClientLayout (header + tabs)
│  │  ├─ ui/                    # from HQ + RoleTag, VolumeCell, FlagChip
│  │  ├─ clients/  keywords/  import/  clusters/
│  ├─ hooks/                    # useClients, useKeywords, useImports (TanStack Query)
│  ├─ lib/                      # api.ts, clientTabs.ts, csv/ (kp.ts, semrush.ts, sheet.ts, keywordKey.ts), exportCsv.ts
│  └─ types/
├─ supabase/migrations/0001_seo_phase1.sql
├─ docs/  CONTEXT.md  CLAUDE.md
```

At most ~5 functions in `api/` (Vercel Hobby's limit is 12).

---

## 7. Build steps

One step per message, on local branch **`phase-1`**. After each step: what to test on localhost, CONTEXT.md updated, step ticked here.

- [x] **1. Database:** branch, migration (tables, RLS, Storage bucket), `siteId.ts` (+ a check that Anassa → `c6e74adc…`); Angel runs the migration in Supabase; `/api/health` shows the tables are reachable
  - [x] branch `phase-1`, `supabase/migrations/0001_seo_phase1.sql` written (12 tables + bucket), `server/utils/siteId.ts` + `npm run check:site-id` (passes), `server/clients/supabase.ts`, `/api/health` table check
  - [x] Angel reviewed the SQL and ran it in Supabase (Nov 20)
  - [x] `/api/health` shows all 12 tables + the bucket as `ok` (Nov 20)
- [x] **2. Sign-in:** auth + `/api/auth`, Sign in page, RequireSession, Log out in the sidebar (Nov 20; hash read only from HQ's `settings`, `/api/health` now signed-in only)
- [x] **3. Clients:** list, Add/edit client (site URL → site id, Home + S1–S3, A1–A3, ideal client, kickoff answers), account checklist, `/clients/{id}` layout with all 8 tabs (unbuilt ones show "coming in phase X" / "coming later"), Overview with Sam's 9 steps. Anassa entered
  - [x] built (Nov 20): Clients list, Add/Edit client (live plugin site id check, services with paste + move, A1–A3 with N/A, kickoff answers, status), `/clients/{site id}` header + 8 tabs, Overview (Sam's 9 steps, services & areas, kickoff, account checklist saved per row), sidebar client shortcuts, `/api/clients`
  - [x] Angel entered Anassa (Nov 20): site id c6e74adc…, 22 services (Home 1, S1 4, S2 10, S3 7), A1 Staten Island, A2/A3 N/A, 12 account rows (checked read-only in Supabase)
- [x] **4. CSV import wizard:** KP + Semrush parsers (+ Sheet source for testing), column match, preview with duplicates/flags, raw file to Storage, import history. Anassa's real KP + Semrush files imported
  - [x] sidebar (Nov 20, Angel): client tabs moved into the sidebar (no client: Overview, All clients, client list; client open: ← All clients, client switcher, sections with Keywords › Matrix / Database / Clusters / Import, not-built greyed with their tag); tab row removed; `/` = hub Overview, `/clients` = All clients
  - [x] built (Nov 20): wizard (source → file → match columns → preview → import), KP UTF-16 + title lines, KP file totals kept on the import, include/exclude words, server dry-run preview, merge rule (fill empties, never overwrite filled Semrush/KD/CPC unless ticked “Use the new numbers”; only the Sheet fills EMPTY KP ranges; typed never overwritten), raw file to Storage, history with download; dry run on all 6 Anassa files OK
  - [x] Delete this import (Nov 20, Angel): confirm with counts first; removes the import's history rows, its raw file in Storage and the keywords that ONLY came from it (keywords also in another import stay); warns when removed keywords have a typed KP range/role/service or sit in the matrix/clusters
  - [x] UI pass (Nov 20): phone order, compact forms, grid fix, sticky Save; UI rule added to CLAUDE.md
  - [x] Anassa's files imported (Nov 24) with the reusable `scripts/import-csvs.ts` (any client, one folder per client, dry run by default): 13 files, 31 new keywords, 247 total; 4 identical copies skipped; 3 unfiltered national exports (5k–10k rows) held back. Angel checked the history (Nov 24)
  - [x] Position Tracking exports are refused by the CSV reader (phase 2 data, not keyword research)
- [ ] **5. Keyword database:** filters, role/intent tags, both volumes, missing-data flags, **editable KP range + bulk bar** (KP range, role, service, track, status), Track toggle
- [ ] **6. 3×3 matrix:** Home row + S1–S3 × A1–A3, N/A / Pending, primary + backups with volumes, pick from the table
- [ ] **7. Clusters:** pages, priority, primary, Volume · KD, secondary + FAQ ideas, Why, no keyword on two pages, Priority legend
- [ ] **8. Export tracked list** CSV for Semrush Position Tracking
- [ ] **9. Anassa check:** matrix + clusters match her Google Sheet (numbers in §8); phone + dark mode pass; phase 1 "done when" list ticked
- [ ] **10. Preview (only when Angel says):** push, Vercel preview behind the team login

---

## 8. Anassa test data

- Client facts from `seo-hub-context-pack.md`: site `https://anassabeauty.com/` (site id `c6e74adc272c98005f3086f85c88b9da`), Staten Island NY, Home + S1 Brazilian & Bikini, S2 Face & Brows, S3 Body Waxing, A1 Staten Island, A2/A3 N/A, primaries. **No address.**
- Raw files (already in Angel's Downloads, 2026-11-18): `KP_ideas_batch1.csv`, `KP_volumes.csv`, Semrush `*_broad-match_*`, `*_all-keywords_*`, bulk `brazilian-wax_brow-lamination_bulk_*`, `gap.keywords_*`.
- Sheet exports (testing only, received Nov 20): `test-data/anassa/sheet-master-keyword-database.csv` and `sheet-clusters.csv` (git-ignored: client data stays local). The app itself is built for every client and never needs a Sheet.

**What phase 1 must reproduce for Anassa (from the Sheet):**

| Check | Expected |
|---|---|
| Keywords | **216**, 0 exact duplicates |
| Roles | 10 Primary · 76 Secondary · 32 FAQ / content · 98 Near me |
| KP range | 194 × `10–100` · 5 × `100–1K` · 10 × `No data` · 7 × `Not checked` |
| Semrush | 13 real `0`s kept as 0; 11 blanks shown as "no data"; 52 blank KD |
| Services | 22 services under Home (Waxing), S1, S2, S3 |
| Matrix (A1 Staten Island; A2/A3 N/A) | Home `waxing staten island` (210 · 10–100), S1 `brazilian wax staten island` (110 · 10–100), S2 `brow lamination staten island` (30 · 10–100), S3 `body waxing staten island` (10 · No data); backups = the other 6 primaries (bikini, eyebrow waxing, eyebrow tinting, facial, leg, back) |
| Tracked | the 10 keywords in Semrush Position Tracking (Nov 18 export): 9 primaries + `waxing staten island ny` (Secondary). `eyebrow tinting staten island` is a primary but **not** tracked, so Track is its own toggle, not tied to role |
| Clusters | **18 pages**: 4 High, 9 Medium, 5 Low; Home + FAQ (2) + S1 (2) + S2 (6) + S3 (7); 7 suggested primaries; no keyword on two pages |

**Anassa service → category map** (typed once on the client form): Home = Waxing · S1 Brazilian & Bikini = Brazilian, Full bikini, Bikini line, Full butt · S2 Face & Brows = Eyebrow lamination, Eyebrow tint, Eyebrow waxing, Full brow bundle, Full face, Chin, Neck, Nose, Sideburns, Upper lip · S3 Body Waxing = Body waxing, Full arms, Full arms + legs, Full back, Full legs, Lower legs, Underarms.

---

## 9. Open questions

1. ~~KP numbers in the CSV~~ **Decided (Nov 20):** stand-ins kept as raw only; KP range typed in the app with an editable column + bulk-set (§3, §5).
2. ~~KP segments~~ **Decided:** use Richmond County (= Staten Island); store the "All" row but don't show it (`seo_keyword_sources.segment`).
3. ~~Exact duplicates~~ **Decided:** same text ignoring case + extra spaces, from the same source = skipped. Close variants kept.
4. ~~Conversions tab~~ **Decided:** 8th tab, "coming later" (§2).
5. ~~Full butt~~ **Decided:** S1 Brazilian & Bikini (listed there on anassabeauty.com/services).
6. Alexia OK with the same Supabase project (from START-HERE)?
7. Custom domains + who runs DNS (for the shared cookie).
