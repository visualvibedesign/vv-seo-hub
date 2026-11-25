# Redesign audit (phase 1)

**Nov 25, 2026 · branch `redesign` · plan only, no code.**

This compares what's built (phase 1, steps 1–5, backed up in `5793ec7`) with:
- the new docs (BUILD-ROADMAP, seo-hub-phases, context pack, playbook)
- the 21 design screens

Order: website first (phases 1–4). The site connection waits for the plugin.

Labels:
- **Keep**: already matches.
- **Change**: what and why.
- **Remove**: only where it conflicts.
- **New**: missing.

Nothing in here deletes data or tables. Anything that would is marked **ask Angel**.

---

## 0. Before building

| # | Item | Status |
| --- | --- | --- |
| 0.1 | New docs into `docs/` | **Done.** Copied in: BUILD-ROADMAP, vibe-seo-plugin-plan, phases, context pack, handoff notes. The root CLAUDE.md and START-HERE.md were already Angel's newer versions, so they were kept. |
| 0.2 | Day 9 merged back | **Done.** The playbook is the new file plus our Day 9 section (before Day 10), the Day 9 video and the Day 9 mapping line. The phases doc's phase 4 has the Day 9 checklist, tables (with the `seo_` prefix) and rules again. |
| 0.3 | Design PNGs into `docs/design/` | **Done.** 21 screens, named after the artboards (Main, Clients, NewClient, Templates, TemplateEditor, Client, Guide, Autofill, Keywords, Notes, Sidebar, Reports, Results, Pages, SitePlan, Brief, GBP, GBPCare, Links, Site, Automation). |
| 0.4 | `ANTHROPIC_API_KEY` | Add it to `.env.local` before the auto-fill steps. |
| 0.5 | Step 5 (Database page) | Done: committed in the `5793ec7` backup. |
| 0.6 | Leftover `seo-hub-all-phases/` | **Waiting for Angel's OK** to delete. Its `vibe-seo-kit/` (the plugin's CLAUDE.md + docs) has no other copy yet. |

### Angel's answers (Nov 25)
1. **31 extra keywords:** keep all of them as **"Needs role"** (role empty), not Later. Add a "Needs role" filter to the Database page. Auto-fill can suggest roles later; Angel approves.
2. **Tracked 10:** taken from Anassa's Position Tracking CSV (`test-data/anassa/semrush-position-tracking-2026-11-18.csv`). All 10 were found in the data and set to Track on (Nov 25): waxing staten island, waxing staten island ny, brazilian wax staten island, bikini wax staten island, body waxing staten island, eyebrow waxing staten island, facial waxing staten island, leg waxing staten island, back waxing staten island, brow lamination staten island.
3. **Collapse-to-icons:** keep it, styled to match the design.
4. **Table name:** `seo_client_links` for Notes & links; `seo_links` stays for phase 4 citations.
5. **Day 9:** merged back (0.2).

---

## 1. Screens

| Screen (design) | Built now | Verdict | What changes and why |
| --- | --- | --- | --- |
| **Sign in** | `LoginPage`, HQ password + `vv_session` | **Keep** | Matches the rules. Not in the design. |
| **Sidebar** (`Sidebar component`) | Hub mode lists every client under "Clients". Client mode is one flat "Workspace" group with icons, plus a collapse-to-icons button. | **Change** | Hub mode: Overview · All clients · Templates · Automation, a lime **+ Add client** button, Switch app at the bottom. **Never list clients** (50+ coming). See the client-mode row below. |
| Sidebar, client mode | Flat list, sections from `CLIENT_SECTIONS` | **Change** | Top: ← All clients, the **client switcher** (AW avatar, name, "Day 2 · Keywords", search), Overview, Step-by-step guide (Day tag), Uploads + auto-fill ("2 left"). Groups with dividers that **fold open/closed** (remembered per user): KEYWORDS, RESULTS, PAGES, LOCAL, SITE. Conversions shows "Later". |
| Sidebar extras | Collapse-to-icons, dark mode toggle | **Keep** | Not in the design, but they don't conflict. Collapse-to-icons is kept and restyled to match the design (Angel, Nov 25). |
| **Overview · all clients** (`Main`) | `HomePage`: 3 numbers, client cards, phase list | **Change** | "Good evening, *Angel.*" plus Templates and + Add client buttons. 4 stat cards (Active clients, Keywords, Tracked in Semrush, Templates). **SEO overview** table (all "—" / "Not connected" until the plugin). Recently worked on (step badge + 10-step progress bar, keywords / tracked / pages / baseline). Next client card. **Needs you** list. Templates you reuse. The phase list goes. |
| **All clients** | `ClientsPage`: card grid | **Change** | A table instead: Client + site, City, Template, Sam step, SEO score ("—"), Keywords, Needs you, Status. Search (name / site / city), All / Active / Paused / Archived pills, "Any step" filter, sort (Recently worked on), **25 per page**. |
| **Add client · 4-step wizard** (`NewClient`) | `ClientFormPage`: one long form (site, services, areas, kickoff, notes). The edit page is the same form. | **Change** | Split into 4 steps: **Site** (name, URL → site id, city, state, "no address field on purpose" note) → **Template** (industry) → **Services & areas** → **Accounts**. Finish = "Start the step-by-step guide". Reuse the existing fields and validation. **Edit client** stays one page (Overview has an "Edit client" button). Kickoff answers move into the guide's Day 1 / auto-fill. |
| **Client · Overview** (`Client`) | `OverviewPage`: steps, targets, kickoff, accounts cards | **Change** | Title with the purple italic part of the name. Chips: site, city, **Template**, site id. Buttons: Edit client, **Continue Day N in the guide**. 4 stat cards (GSC, GA4, GBP, Map grid) show "—" until phase 2. **Sam's 10 days**: 9 rows with Done / In progress / Not started from guide progress. **Services & areas** card (Home/S1–S3 with services, A1–A3 chips). **Accounts** card with Ready / Pending pills; keep the inline status + next-action editing. |
| **Step-by-step guide** (`Guide`) | Nothing (the `SAM_STEPS` list only) | **New** | Left: 9 steps with ticks. Right: Day tag, title, one-line why, **Do this (x / y)** checklist, Tools, Tip, buttons (Open screen, Watch Sam's video, **Mark step done**). "2 of 9 steps done" bar. Saved per client. |
| **Uploads + Claude auto-fill** (`Autofill`) | `ImportPage` (Keywords › Import): upload → match → preview → commit, with dedupe and merge rules | **New page; keep the import engine** | Day tabs (Day 1 · Setup … Day 10 · Results). **1 · What I need from you**: the exports list with ticks, "How to get this file" steps, and **one drop zone** that knows each file by its columns. **2 · What Claude filled** (Roles, Services, Intent, 3×3 matrix, Clusters), each "Ready to review" + Review, plus Approve all. **3 · Needs you**. The file detection and merge rules in `readCsv` / `importRules` / `importService` already do the hard part. |
| Keywords › **Import** | `ImportPage` + `ImportHistory` + delete import | **Keep** (restyle) | It stays in the sidebar as the manual/advanced import and import history (delete an import lives here). Uploads + auto-fill calls the same server code. |
| **Keywords › Matrix** (`Keywords`) | Coming-soon card | **New** | 3×3 grid (Home + S1–S3 × A1–A3). Each cell: primary keyword, "Semrush 210 · KP 10–100", Page live / Page not live yet; N/A cells dashed "N/A · one area only". Buttons: **Export tracked list**, **Upload CSVs**. The design puts a short database table under the matrix: show the first rows with a "See all" link to Database. |
| **Keywords › Database** | `DatabasePage` (step 5): filters, sort, 100/page, bulk bar, KP cell editor, phone cards | **Keep + Change** | Design columns match: Keyword, Role, Service, Intent, KP range, Semrush, KD %, CPC, Track. Changes: role filter as **pills with counts** (All 216 · Primary 10 · …); Track shown as a "Tracked" / "Off" pill (keep it clickable); intent as text, not C/T letters; footer "'—' = no data in the export (never shown as 0)"; a **"Needs role"** pill/filter for keywords with no role (Angel, Nov 25). **Keep what the design doesn't show** (see §5). |
| **Keywords › Clusters** | Coming soon | **New** (step 7) | No design screen. Use the context pack columns: Category, Page, Priority, Primary, Volume · KD, Secondary + FAQ, Why. One page per keyword. |
| **Templates library** (`Templates`) | Nothing | **New** | Industry dropdown, + New template, 7 cards (Day tag, name, blurb, "1 client" / "Not used yet"). Detail panel: What's in it, **Preview for <client>**, Apply to a client, Edit template, "Editing never changes clients it was already applied to". |
| **New template · editor** (`TemplateEditor`) | Nothing | **New** | Name, Type, Sam day, Industry. Variables `{service} {city} {st} {state} {brand}`, a pattern list with add/remove, and a **Live preview** with a sample service / city / ST. |
| **Notes & links** (`Notes`) | Coming soon; `seo_clients.notes` is one text box | **New** | Links list (icon code, name, URL, Open, + Add link). Notes feed with a **Rule** / **Decision** tag, author and Day, "Add note". |
| Coming-soon pages | `ComingSoonPage` + `comingLabel()` | **Keep** | Phases 2–5 sections show "Coming in phase X". Site data screens show "Connect the site (coming soon)". |
| Phases 2–5 screens (Reports, Day 10, Pages, Site plan, Brief, GBP check, GBP care, Links, Site + work log, Automation) | Not built | **Later** | Not in phase 1, apart from their sidebar entries and coming-soon cards. Notes from the screens are in §6. |

---

## 2. Database (Supabase, `seo_` tables, RLS on, no policies = server-only)

### Existing 12 tables (`0001_seo_phase1.sql`)

| Table | Verdict | Notes |
| --- | --- | --- |
| `seo_clients` | **Keep + Change** | Add `template_industry` (text: waxing_beauty / med_spa / home_services / blank) and `last_worked_at` (for "Recently worked on"). `notes` stays as is (old text); new notes go in `seo_notes`. No address column, ever. |
| `seo_client_categories` | **Keep** | Home / S1–S3 / FAQ match the matrix rows. |
| `seo_client_services` | **Keep** | Anassa has 22, as the docs expect. |
| `seo_client_areas` | **Keep** | A1–A3 with N/A matches the design. |
| `seo_client_accounts` | **Keep** | The 12 account kinds; Ready / Pending / N/A match the Accounts card. |
| `seo_imports` | **Keep + Change** | Add `step` (day the file belongs to, for the Uploads tabs) and `expected_kind` (which "What I need" row it ticks). The `source` / `report` checks will need more values in phase 2 (position tracking, whitespark, GSC…). Widen the check then. |
| `seo_keywords` | **Keep** | Every design column exists. `suggested` covers "suggested primaries with no data". |
| `seo_keyword_sources` | **Keep** | Where a keyword came from, plus the raw row. |
| `seo_matrix_cells` | **Keep** | target / n_a / pending matches the design. |
| `seo_matrix_keywords` | **Keep** | primary + backups. |
| `seo_pages` | **Keep** (extend in phase 3) | Phase 3 adds page_code, structure, title / meta / H1, v_status, parent. Not now. |
| `seo_page_keywords` | **Keep** | The keyword id is the primary key, so one keyword sits on one page only. That's Sam's rule. |

### New tables for phase 1 (migration `0002_seo_phase1b.sql`: creates only, RLS on, SQL shown to Angel before running)

| Table | Columns (short) | Used by |
| --- | --- | --- |
| `seo_templates` | id, kind (keyword_research / matrix / clusters / hotspots / gbp_posts / review_email / citation_waves), name, sam_day, industry (or null = all), description, built_in, updated_at | Templates library, editor |
| `seo_template_items` | template_id, sort, kind (pattern / rule / money_word / faq_word / export / text), body | Patterns like `{service} {city}`, rules, words |
| `seo_client_templates` | client_id, template_id, applied_at, **snapshot jsonb** (a copy) | "Editing a template never changes clients it was applied to" |
| `seo_guide_progress` | client_id, step (0–8), status (not_started / in_progress / done), tasks_done jsonb, started_at, done_at | Guide, Overview "Sam's 10 days", client switcher "Day 2 · Keywords", All clients "Sam step" |
| `seo_autofill` | id, client_id, step, kind (roles / services / intent / matrix / clusters / setup…), payload jsonb, summary, status (**ready_to_review** / approved / rejected), source (rules / claude), ai_log_id, approved_at | "What Claude filled", Review / Approve all, Overview "Needs you" |
| `seo_ai_log` | id, client_id, task, model, tokens_in, tokens_out, cost_estimate, ok, error, created_at | Every Claude call logged |
| `seo_notes` | id, client_id, kind (rule / decision / note), body, author, day, created_at | Notes & links |
| `seo_client_links` | id, client_id, kind (website / sheet / gsc / ga4 / gbp / semrush / whitespark / clickup / other), label, url, sort | Notes & links |

**Name clash:** the phases doc calls the links table `seo_links`, but phase 4 also uses `seo_links` for citations and backlinks. I suggest `seo_client_links` for Notes & links so phase 4 keeps `seo_links`.

The guide's task text, tools, tip and video live in code (like `SAM_STEPS`), not in a table. Only progress is stored.

---

## 3. SEO Hub logic

### Auto-fill: plain code vs Claude API

| Job | Who | Why |
| --- | --- | --- |
| Recognise a file by its columns (KP ideas / volumes, Semrush Magic / Overview / Gap, Sheet, position tracking) | **Code**, already built (`readCsv`) | Exact |
| Parse, dedupe exact duplicates, merge rules (fill only empty fields, KP stand-ins kept in history only) | **Code**, already built (`importRules`, `importService`) | Exact; never changes exported numbers |
| Seed keywords from template patterns × services × areas | **Code** (new) | Plain string fill |
| Role rules: "near me" → Near me; aftercare / vs / how long / first time → FAQ; price / cost / deals / best → Secondary | **Code** (new) | Patterns from the template |
| Primary = best keyword per matrix cell **suggestion** | **Claude** (volume + fit), code checks it's in the cell's service + area | Judgment |
| Service matching (keyword → one of the client's services) | **Code first** (name match), **Claude** for the rest | Mostly exact, some judgment |
| Intent (only where the export left it empty) | **Claude**; never overwrites Semrush's intent | Judgment |
| Clusters (pages, priority, why, no keyword on two pages) | **Claude** drafts; **code** enforces one page per keyword | Judgment + a hard rule |
| Day 1: services, areas, kickoff answers from notes + Services page text | **Claude** (pasted text only; no site crawling) | Writing / judgment |
| Counts, "Needs you" items (primaries with no KP, keywords without Semrush volume, S3 page not live) | **Code** | Exact |
| Citation waves (phase 4), counters + UTM (phases 3–4) | **Code** | Exact |

### Review / approve
- Everything auto-fill makes goes into `seo_autofill` as **Ready to review**. **Nothing touches `seo_keywords` / matrix / pages until approved.**
- **Review** opens a diff list: current → suggested, with per-row untick.
- **Approve** writes the approved rows in one go.
- **Approve all** = approve every ready item for that day tab.
- **Reject** keeps the row (status rejected) for the log.
- Claude never changes exported numbers, never invents volumes or facts, and puts unknowns in [brackets]. The server checks the output and drops any field that's an exported number.
- Every call → `seo_ai_log` (task, client, model, tokens, cost estimate). The key is server-only, called from `api/` like HQ.

### Templates
- 7 built-in, seeded by the migration: Keyword research, 3×3 matrix, Clusters, SEO hotspots, GBP 13-week posts, Review email, Citation waves.
- Industries: Waxing & beauty salon, Med spa, Home services, Blank.
- Variables `{service} {city} {st} {state} {brand}`, filled from the client's own services and areas. **Nothing Anassa-specific in code.**
- Applying a template saves a **copy** (`seo_client_templates.snapshot`), so later edits never change a client.

### Guide progress
- 9 steps = `SAM_STEPS` (already in `clientSetup.ts`), each with its tasks.
- Some ticks are **automatic** from data, e.g. "Import the CSVs" ticks when a KP + Semrush import exists, and "Set roles + pick a primary per cell" ticks when the matrix is full. The others are ticked by hand.
- The **current step** (first step not done) drives the client switcher, All clients "Sam step", the Overview button and the sidebar "Day 2" tag.

---

## 4. Anassa vs the "done when" numbers (live DB, read today)

| | Target (Sheet) | Now | Gap |
| --- | --- | --- | --- |
| Keywords | 216 | 247 | 31 extra from the KP/Semrush imports. **Kept as "Needs role"** (Angel, Nov 25). |
| Roles | 10 / 76 / 32 / 98 | 10 / 76 / 32 / 98 + 31 Needs role | ✓ Matches for the Sheet's 216 |
| Services | 22 | 22 | ✓ |
| Tracked | 10 | **10** | ✓ Set Nov 25 from the Position Tracking CSV |
| Pages | 18 | **0** | Comes with Clusters (step 7) |
| Matrix | 4 primaries | **0 cells** | Comes with Matrix (step 6) |

---

## 5. Built but not in the Database design (keep: data or rules need them)

- KP range as text exactly as exported, with the greyed stand-in number as a hint.
- Blank = "—", never 0.
- **KP cell quick edit + bulk set** (the phases doc requires it).
- KP overwrite confirm.
- Status Keep / Later / Rejected, and its filter (default: active).
- Missing-data filters (no KP, no Semrush, no service, no role).
- Source filter (where each keyword came from).
- Service picker grouped by the client's own categories.
- Phone card layout.

---

## 6. Later-phase notes from the screens (no work now)

- **Reports / Day 10:**
  - "Page 1 keywords 0 / 10".
  - Swapped-page flag.
  - Monthly report cards.
  - "Draft with Claude".
  - Comparable / Limited / Unavailable.
  - Six buckets.
  - 3 actions → ClickUp.
- **Pages:**
  - P-codes with Live / Improve / New.
  - Counters 57 / 50–60 and 158 / 150–160 with CTA.
  - Google preview.
  - "Push to site (P5)".
  - Redirects Queued → Sent → Live.
  - BrandScript A–P (design says "0 of 16") + 11 sections V1 / V2.
- **GBP check / care:**
  - Competitors per S1–S3.
  - Whitespark factors with "Hidden · home studio".
  - Public details only.
  - 4 products.
  - Review tracker (ref, date, channel, result).
  - 13 posts.
- **Links:**
  - Design shows waves + Backlink Gap + Local & premier tabs only.
  - **Add Day 9's opportunity list, sponsorships, SERP searches and authority checks** when we plan phase 4 (see 0.2).
- **Site + Automation:** wait for Vibe SEO 1.3.0 / 1.4.0.

---

## 7. Remove

| What | Why |
| --- | --- |
| Client list in the hub sidebar | The design and rules: clients are never listed in the sidebar |
| Phase list card on the hub Overview | Replaced by the design's Overview |
| Client card grid on All clients | Replaced by the table |

No tables, columns or data are removed.

---

## 8. Build order (redo phase 1)

Numbers = the redesign steps as built (START-HERE order). Migrations are split per step, each add-only, SQL shown to Angel first.

- ✅ **Docs + design in place** (§0).
- ✅ **Step 1 · Sidebar** (hub + client mode, switcher, foldable groups) + routes for every section.
- ✅ **Step 2 · All clients** (table, filters, 25/page) + **Add client wizard** (4 steps) + Edit client. Migration 0002: `seo_clients.industry` (ran Nov 25).
- ✅ **Step 3 · Guide + both Overviews** (migration 0003: `seo_guide_progress`):
  - 3a **Step-by-step guide** (9 steps, tasks, auto-ticks, progress per client)
  - 3b **Client Overview** (design Client.png: chips, Continue Day N, 4 stat cards with "Connect the site (coming soon)" / "—" until phase 2, Sam's 10 days from guide progress, Services & areas, Accounts)
  - 3c **Hub Overview** (design Main.png: greeting, 4 stat cards, SEO overview table as the "Connect the site (coming soon)" empty state, Recently worked on with step + progress bar, Next client, Needs you, Templates you reuse). Replaces the old "Build phases" page.
  - Then the Sam step column + "Any step" filter on All clients and "Day 2 · Keywords" in the client switcher go live.
- ✅ **Step 4 · Keywords**: Database restyle (pills with counts, Needs role, Track pill) + Matrix + Clusters + Export tracked list.
- ✅ **Step 5 · Templates** library + editor + apply (snapshot). Migration: `seo_templates`, `seo_template_items`, `seo_client_templates` + 7 seeded templates.
- **Step 6 · Uploads + auto-fill** (Day 1 + Day 2): what I need + how-to steps, one drop zone, code rules first, then the Claude API + AI log + Review / Approve. Migration: `seo_autofill`, `seo_ai_log`.
  - ✅ 6a Uploads page · ✅ 6b plain-code rules (roles, services) · ✅ 6c-1 Claude setup + intent (Haiku)
  - ✅ 6c-2 (migration 0008): per-client scope words (Edit client): out of scope → suggest Rejected, neighbourhood (not an active area) → suggest Later; those keywords get no role / service / intent suggestions and Approve all skips them. Claude (Haiku): no-rule keywords triage (competitor brand / off-topic → Rejected, neighbourhood → Later, fits → left alone) and leftover services (skips triaged keywords).
  - ✅ 6c-3 matrix suggestions (Sonnet): only open cells (active area, not N/A, no primary); candidates = the client's keywords naming that row's service + the cell's city, not already in the matrix; approve cell by cell (fills only a still-empty cell, primary gets the Primary role if empty); Approve all never touches it
  - 6c-4 Day 1 from notes (Sonnet)
- ✅ **Any client** (Nov 25, migration 0009): brand words per client, neutral prompts / screen text, area state falls back to the client's state ("[state]" if none), industries are a database list (`seo_industries`) with "+ New industry" in the Add client wizard and "Add industry" on Templates. No industry needs its own template versions: generic templates + the client's own services, areas, scope and brand words.
- ✅ **Accounts as quick access** (migration 0010): every account starts Ready, Open button (client link, else the tool's main page), per-client links (https only, never logins), "More accounts" always shown.
- ✅ **Bulk "Add clients from CSV"** (/clients/import): name, URL, city, state, optional industry; site ids worked out, existing clients + repeats skipped, address-like rows refused, new industries added on save, preview before saving; services filled in later per client ("Needs services" on All clients). No new tables.
- **Step 7 · Notes & links.** Migration: `seo_notes`, `seo_client_links`.
- **Last:** Anassa check vs §4, phone + dark mode on every screen.

Each step: plan → Angel OK → build → test on localhost → commit locally. No push, merge or deploy until Angel says so.

## 9. Questions for Angel

All answered Nov 25 (see "Angel's answers" in §0).
