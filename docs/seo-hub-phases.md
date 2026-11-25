# SEO Hub – All Phases

One file for the whole SEO Hub build. **Updated Nov 25, 2026:** follows the approved design canvas and adds:
- uploads + Claude auto-fill from phase 1
- reusable templates
- the step-by-step guide
- Sam's Day 10
- the **SEO Hub + Vibe SEO integration plan** (full detail in `vibe-seo-plugin-plan.md`)

The order of every phase for both projects is in `BUILD-ROADMAP.md`. **Decided Nov 25: website first.** In phase 2, skip the site-connection items (Connect site, `/api/vibe/checkin`, check-in data, SEO overview table, `/clients/{site id}`, import) and build them later together with Vibe SEO 1.3.0 (roadmap step P1 + 2c). Screens that need site data show an empty state until then.

**Design (source of truth for every screen):** https://claude.ai/artifact/8WkeSEz7sQxqm6NRV5Uu8H
Claude Code can't open it, so export each screen (Share › Export, PDF or images) into `docs/design/` and name them like the artboards below.

**How we build each phase:** plan → build locally → Angel tests on localhost → push to a Vercel preview only when Angel says → Alexia reviews → fix → next phase.

## The idea in one line
**You upload, Claude fills, you approve.**
- SEO Hub tells you exactly which exports it needs, with step-by-step "how to get this file".
- Plain code rules fill the exact stuff; the Claude API fills the judgment and writing.
- Nothing is saved or pushed without your OK.
- Every new client starts from templates and follows Sam's 10 days in a guide.

## SEO Hub + Vibe SEO built together
SEO Hub is the main place to work. Alexia's agency hub and every Vibe SEO feature keep running: nothing is removed, and Vibe Admin is never changed.

| SEO Hub phase | Vibe SEO release | Together |
| --- | --- | --- |
| 1 | — (ask Alexia first) | |
| 2 | **1.3.0** read-only: SEO Hub key, pages list, duplicate keyphrases, link ideas, QA summary, Check in now, Open in SEO Hub | **Connect site** + receive check-ins → real page data, forms, what changed, care progress |
| 2 → 3 | — | **One-time import** of the agency hub's client workspaces, site plans, monthly reports (read-only copy) |
| 5 | **1.4.0** writes: pushes, applied log, redirects via `VVDA_Redirects::import()`, target keyword column in WP | Plan → push → live; weekly email switch (with Alexia's OK) |
| later | **1.5.0** planned pages → drafts | Site plan "+ Add page" lands in WP |

Alexia's **SEO hub address** setting (`VVDA_Hub::seo_link`) points her hub's SEO links to SEO Hub `/clients/{site id}`.

## Tech stack (same as Visual Vibe HQ)
| Tool | Used for | From phase |
| --- | --- | --- |
| GitHub `visualvibedesign/vv-seo-hub` | Code | 1 |
| React + Vite + Tailwind | The app (same setup and styles as HQ) | 1 |
| Vercel `vv-seo-hub.vercel.app` | Hosting + previews (behind the team login) | 1 |
| Supabase (same project as HQ) | `seo_` tables, RLS on, server-only; private Storage bucket `seo-imports` for raw files | 1 |
| HQ login | Shared team password + `vv_session` cookie (Phase 0). No user list | 1 |
| Papa Parse | Reading CSVs (KP UTF-16 included) | 1 |
| **Claude API** (same Anthropic account as HQ; own key "SEO Hub" if possible) | Auto-fill: service matching, intent, clusters, matrix picks, hotspot/brief/post drafts, reading screenshots, Day 10 update draft. Server-side only, every call logged | **1** |
| Google Search Console + GA4 APIs (free) | Impressions, clicks, engaged sessions | 2 |
| Vibe SEO plugin (Angel owns it) | Signed check-ins (1.3.0, phase 2), `/clients/{site id}`, pushes + redirects (1.4.0, phase 5) | 2 |
| ClickUp API | Web Page tasks, next actions from Day 10 | 3 |
| Slack | Alerts | 5 |

Not used:
- Semrush API (CSV only)
- GBP API (typed in / screenshots)
- Whitespark API (CSV / screenshot)

## Rules for every phase
- **Sources:**
  - Follow Sam's process (`local-seo-playbook.md`, Days 1–10).
  - Agency rules + Anassa test data: `seo-hub-context-pack.md`.
  - Plugin: `vibe-seo-plugin-plan.md` + `vibe-seo-handoff-notes.md`.
- **Look = Visual Vibe HQ** (reuse its styles/components):
  - Fraunces headings with a purple italic word (#7C5CE6), Inter body text.
  - Background #F7F5FF, text #131314, sidebar #EEEAFF, active pill #BFAFFF.
  - White 22px cards with #ECE8FB border, lime #BAD657 pill buttons.
  - Light + dark mode, phone layout.
  - Role tags: Primary teal, Secondary light blue, FAQ orange, Near me gray.
  - Never change global tokens.
- **Code rules for exact work, Claude for judgment.** Code: CSV parsing, duplicates, near me / FAQ patterns, citation waves, counters, UTM links. Claude: everything that needs judgment or writing.
- **Claude never** changes exported numbers, invents volumes, reviews, prices or facts, or publishes anything. Its output is saved as **Ready to review** until Angel approves. Unknown facts stay in [brackets].
- **Data:**
  - Volumes exactly as exported (KP ranges stay text).
  - Missing data shows "—", never 0.
- **Privacy:**
  - Never store or show a private address.
  - Never store passwords or API keys in tables. Site connection keys are stored hashed/encrypted, server-side only.
- **Access:**
  - Team-only.
  - Never push, merge or deploy until Angel says so.
  - Never change HQ's code or the Vibe Admin plugin.
  - Never remove a Vibe SEO feature.
- **Before a step is "done":**
  - Every list has empty, loading and error states.
  - Check phone width + dark mode.

## Sidebar (all phases build toward this)
- **Hub mode:** Overview · All clients · Templates · Automation · **+ Add client** · Switch app. Clients are **never** listed in the sidebar (50+ clients).
- **Client mode, top:** ← All clients · client switcher (search, name on one line, "Day 2 · Keywords") · Overview · Step-by-step guide · Uploads + auto-fill.
- **Client mode, groups:**
  - **KEYWORDS:** Matrix, Database, Clusters, Import
  - **RESULTS:** Baseline + reports, Day 10 review
  - **PAGES:** Sitemap + hotspots, Site plan, Page briefs
  - **LOCAL:** GBP check, GBP care, Links
  - **SITE:** Connection + work log, Notes & links, Conversions (later)
- **Client mode, bottom:** Switch app.
- Sections have dividers and fold open/closed (remembered per user). Not-built sections show "Coming in phase X".

---

## Phase 0 · One-login portal (inside Visual Vibe HQ)
Approved by Alexia.
- HQ keeps its shared password + `vv_session` cookie; the landing page is unchanged.
- New `/apps` page ("Pick your vibe") with cards: HQ (live), SEO Hub (Building, not open yet), Client Reports (later).
- App list lives in `src/lib/apps.ts`.

**Later (not now):**
- The SEO Hub card opens SEO Hub through a one-time handoff link.
- SEO Hub sends signed-out people to HQ's login, so the portal is the only door.
- A shared cookie across apps needs custom domains (`hq.` / `seo.visualvibedesign.com`), waiting on Alexia.

---

## Phase 1 · Clients, keywords, templates, guide, uploads + auto-fill (Sam Days 1–2)

> **Status (Nov 26, 2026): built**, merged to `main` locally. Changed on the way: each client has two areas, the **Client Overview** (results + quick access: Overview, Baseline, Results, Site check, Site connection, Notes & links) and the **Strategy Builder** (Days 1, 2, 4, 5, 6, 7, 8–9); the hub sidebar is Overview · Clients · Templates · Settings. Whole client Sheet (.xlsx) import, Sam's Guide import, Claude auto-fill (Day 1 + Day 2), Delete client. Checklist: `docs/phase-1-checklist.md`.

**Already built (local, branch `phase-1`):**
- Step 1: database (12 `seo_` tables)
- Step 2: sign-in
- Step 3: clients
- Step 4: CSV import + delete import + client sections in the sidebar (needs the new sidebar look)

**Screens (design artboards):**
- Overview (`Main`)
- All clients (`Clients`)
- Add client wizard (`NewClient`)
- Templates (`Templates`) + editor (`TemplateEditor`)
- Client overview (`Client`)
- Step-by-step guide (`Guide`)
- Uploads + auto-fill (`Autofill`)
- Keywords: matrix, database, clusters, import (`Keywords`)
- Notes & links (`Notes`)
- Sidebar component (`Sidebar`)

**Done when**
- [ ] New sidebar: groups, dividers, fold open/closed, client switcher with search, Switch app at the bottom
- [ ] All clients page: search, status + step filters, sort, 25 per page
- [ ] Add client wizard: Site → Template → Services & areas → Accounts → "Start the step-by-step guide"
- [ ] Templates:
  - 7 built-in: Keyword research, 3×3 matrix, Clusters, SEO hotspots, GBP 13-week posts, Review email, Citation waves
  - Editor with variables `{service} {city} {st} {state} {brand}` and live preview
  - Industry versions: Waxing & beauty salon, Med spa, Home services, Blank
  - Editing a template never changes clients it was already applied to
- [ ] Step-by-step guide: Sam's 9 steps with tasks, tools, tip, a button to the right screen and Sam's video; progress saved per client
- [ ] Uploads + auto-fill (Day 1 + Day 2 tabs):
  - "What I need from you" list with **How to get this file** steps
  - One drop zone that recognises each file by its columns
  - "What Claude filled" (Review / Approve all)
  - "Needs you"
- [ ] Auto-fill for Day 1 (services, areas, scope / brand words from notes + Services page; kickoff answers skipped at our agency) and Day 2 (roles, services, intent, matrix suggestions, clusters)
- [ ] Keyword table with quick KP range editing (bulk set), 3×3 matrix, clusters, export tracked list
- [ ] Notes & links per client
- [ ] Anassa matches her Sheet: 216 keywords · 10 Primary / 76 Secondary / 32 FAQ / 98 Near me · 22 services · 18 pages · 10 tracked (plus 31 keywords from later imports kept as "Needs role")
- [ ] Claude calls logged (what, client, tokens, cost estimate, when)

**New tables (on top of the 12):**
- `seo_templates`, `seo_template_items`, `seo_client_templates` (what was applied, a copy)
- `seo_guide_progress` (client, step, tasks ticked, status, dates)
- `seo_autofill` (client, step, kind, payload, status draft / approved / rejected, approved_by, at)
- `seo_ai_log` (client, task, model, tokens in/out, created_at)
- `seo_notes`, `seo_client_links` (Notes & links; `seo_links` is phase 4's citations/backlinks table)

**Prompt to paste**
```
Phase 1 continues. Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md (rules, sidebar, phase 1), docs/seo-hub-context-pack.md, docs/local-seo-playbook.md (Days 1–2 and 10) and the design screens in docs/design/ (Main, Clients, NewClient, Templates, TemplateEditor, Client, Guide, Autofill, Keywords, Notes, Sidebar).

Keep everything already built on the phase-1 branch. Plan first (no code): what changes in the sidebar and screens to match the design, the new tables (templates, guide progress, auto-fill items, AI log, notes, links) with RLS, which auto-fill parts are plain code rules and which use the Claude API, and the build steps. Save it in docs/phase-1-plan.md and update CONTEXT.md.

Claude API: same Anthropic account as HQ, key in .env.local as ANTHROPIC_API_KEY, server-side only, called from api/ like HQ. Everything Claude fills is "Ready to review" until I approve. Never change exported numbers or invent facts. Log every call.

Then build step by step after I approve, tell me what to test on localhost, and commit each step locally. Do NOT push, merge or deploy until I say so.
```

---

## Phase 2 · Baseline, reports, Day 10 review + site connection (Sam Days 3 + 10, Vibe SEO 1.3.0)

> **Plan (Nov 26): `docs/phase-2-plan.md`** (Google numbers, rankings, map grid, GBP → Overview, Baseline, Results; site connection after phase 4). SQL draft `0016_seo_phase2.sql`, not run. The table list below is the original idea; the plan has the final one.

**Screens:**
- Baseline + reports (`Reports`)
- Day 10 review (`Results`)
- Uploads + auto-fill Day 3 + Day 10 tabs
- Connection (`Site`, connect part only)

**Done when**
- [ ] Semrush Position Tracking CSV import: date, position, ranking URL; first import = baseline; later imports show change
- [ ] GSC + GA4 connected once per client (free APIs, OAuth):
  - Pulled for the same date-range length
  - GSC query filter (city + service words)
  - GA4 engaged sessions from Organic Search
- [ ] GBP numbers typed in or read from a screenshot (Claude); Whitespark grid from CSV (drawn 5×5, green/yellow/red/grey) or screenshot
- [ ] Swapped-page flags (ranking URL ≠ owner page)
- [ ] Monthly report archive (snapshot per month)
- [ ] Day 10 review:
  - (No kickoff goal: skipped at our agency. Start from the baseline and the focus service + area.)
  - Compare like with like (Comparable / Limited / Unavailable + reason + next check)
  - Work worth explaining (from the work log)
  - Six buckets (OK / Next / Later)
  - Client update (past → present → future)
  - Up to 3 actions with type, owner, due date
- [ ] Claude drafts: comparison labels, work items, buckets, client update. Angel reviews
- [ ] Anassa's baseline (Nov 17) matches her Baseline Rankings tab
- [ ] **Connect site** (client › Site):
  - Generate a per-site **SEO Hub key** (shown once, Copy button)
  - Steps to paste it + set the SEO hub address in WordPress
  - Status: Connected / Not connected + last check-in + why
  - **Regenerate key** (the old key stops working right away)
  - Key stored server-side only, hashed/encrypted, never shown again
- [ ] `POST /api/vibe/checkin`:
  - HMAC over the raw body, 10-minute window, constant-time compare
  - Matches the site id to the client
  - Reachable when previews are password-protected (the signature protects it)
  - Accepts the old shared `hub_key` only as a fallback, until the site has its own key
- [ ] Check-in data shown in Client overview, Reports, Work log, Needs you:
  - Pages list (title, meta, keyphrase, score, missing alt, orphan)
  - Duplicate keyphrases and link ideas
  - QA summary
  - Form entries, what changed, care progress
- [ ] Overview "SEO overview" table from check-ins (score, pages, missing meta / keyphrase / alt, visitors, last check-in)
- [ ] `/clients/{site id}` works for links from Alexia's agency hub; unknown id → "not an SEO Hub client yet"
- [ ] One-time read-only import of the agency hub's client workspaces, site plans, monthly reports (only if Alexia OKs; see `BUILD-ROADMAP.md` phase 2b)

**Tables:**
- `seo_sites` (site id, url, key hash, last check-in, status)
- `seo_site_reports` (check-in payloads)
- `seo_rank_snapshots`
- `seo_metric_snapshots` (metric, value, date_from, date_to, source gsc / ga4 / gbp / manual)
- `seo_map_grids` (+ points)
- `seo_google_connections`
- `seo_reports` (month, sections, status, saved_at)
- `seo_report_actions` (type, target, owner, due, done_looks_like)

**Prompt to paste**
```
Phase 2 of SEO Hub: baseline, reports and the Day 10 review. Phase 1 is done.
Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md (rules + phase 2), docs/local-seo-playbook.md (Days 3 and 10), docs/vibe-seo-plugin-plan.md, docs/vibe-seo-handoff-notes.md and docs/design/ (Reports, Results, Autofill, Site, Main).
Website first: skip the site-connection items (Connect site, /api/vibe/checkin, check-in data, SEO overview table, /clients/{site id}, import) for now; screens that need site data show an empty state. Plan first (no code): tables; Semrush CSV rules; GSC + GA4 setup (free, OAuth, same date-range length, GSC query filter, GA4 engaged organic sessions); map grid import; monthly snapshots; Day 10 review; which parts Claude drafts. Save it as docs/phase-2-plan.md and update CONTEXT.md.
After I approve: build step by step on a local branch with Anassa's real baseline (Nov 17), tell me what to test, commit locally. Do NOT push, merge or deploy until I say so.
Rules: rank tracking stays in Semrush (US national), we only import. Missing history isn't zero. Claude drafts are reviewed before saving. Connection keys never leave the server and are never shown twice.
```

---

## Phase 3 · Pages: sitemap, hotspots, site plan, page briefs (Sam Days 5–6)

**Screens:**
- Sitemap + hotspots (`Pages`)
- Site plan + redirects queue (`SitePlan`)
- Page brief (`Brief`)
- Uploads + auto-fill Days 5–6 tab

**Done when**
- [ ] Page list P1, P2… keep / improve / new, structure (service first / location first / flat), keyword owner per page
- [ ] "Live now" column from check-ins next to the planned hotspot (empty state until the site is connected)
- [ ] Hotspot editor with live counters (title 50–60, meta 150–160 ending with a CTA, H1, URL) + Google preview; swapped-page flags
- [ ] Site plan tree + "+ Add page" (planned pages); redirects queue (Queued → Sent → Live) when a URL changes
- [ ] Page brief: BrandScript A–P once per client + 11 StoryBrand sections, V1 / V2
- [ ] Claude drafts hotspots and briefs from keywords, clusters and the SEO hotspots template; [brackets] for unknown facts
- [ ] Send hotspots to ClickUp Web Page tasks

**Tables:**
- Extend `seo_pages` (page_code, structure, status, owner_type, title, meta, h1, url, v_status, parent)
- `seo_redirects`
- `seo_brandscripts`
- `seo_page_briefs`
- `seo_clickup_links`

**Prompt to paste**
```
Phase 3 of SEO Hub: pages, hotspots, site plan, page briefs. Phases 1–2 are done.
Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md (rules + phase 3), docs/local-seo-playbook.md (Days 5–6) and docs/design/ (Pages, SitePlan, Brief, Autofill).
Plan first (no code): tables, "live now" from check-ins, Claude drafts for hotspots + briefs, redirects queue, ClickUp sync. Save as docs/phase-3-plan.md, update CONTEXT.md.
After I approve: build step by step on a local branch with Anassa's pages, tell me what to test, commit locally. Do NOT push, merge or deploy until I say so.
Rules: title 50–60, meta 150–160 ending with a CTA, state abbreviation in URLs, full state name in titles, no invented claims.
```

---

## Phase 4 · GBP check, GBP care, links (Sam Days 4, 7, 8–9)

**Screens:**
- GBP check (`GBP`)
- GBP care (`GBPCare`)
- Links (`Links`)
- Uploads + auto-fill Day 4 + Days 7–9 tabs

**Done when**
- [ ] Competitors per service (S1–S3 tabs): categories, reviews, rating, newest review; Claude reads Maps / review screenshots into the table
- [ ] Whitespark top map factors checklist; business details public vs private (private address never stored)
- [ ] GBP care (Claude drafts the posts + email):
  - Products: one per service page, 720×720
  - Review email + tracker (ref, date, channel, result only)
  - 13-week post calendar (1200×900, UTM)
- [ ] Links: BrightLocal list → 3 waves automatically (rows 1,4,7 / 2,5,8 / 3,6,9), Backlink Gap import, local + premier links with status; link ideas from check-ins
- [ ] Opportunity list (Day 9): exact page, found via (R relationship / S search / C competitor / Cit citation / Sp sponsorship), Authority Score, why it fits, how to get on it (claim / apply / contact / join), cost, next action + date, This week / Sent / Approved / Live as separate ticks (Live only after the link is clicked and checked)
- [ ] Backlink Gap CSV import (root domain, up to 4 competitors = C1–C4): keeps the "matches" count (e.g. 4 of 5), hides Authority Score below 3 by default, flags citations already on the Day 8 wave list so nothing is added twice
- [ ] Premier links checklist (chamber, trade groups, certifications, referral partners, vendors, organizations worked with → page or route in + next action) + editorial idea
- [ ] Sponsorships (2–3): event or cause, tier + cost, why, sponsor page (public / on main site / stays up), shows (name / logo / profile / link)
- [ ] SERP searches log: search run → promising pages (customer-style + lister-style searches)
- [ ] Weekly pace (2–10 links/week) per client + count of links live this week vs pace
- [ ] Authority check typed in at month 3 / 6 / 9 / 12: Authority Score, referring domains, backlinks (no Semrush API)

Links screen tabs: Citations · 3 waves, Backlink Gap, Local + premier (design) + **Opportunities** (This week / Sent / Approved / Live filters), Sponsorships, SERP searches, Authority checks (Day 9, not in the design yet).

**Tables:**
- `seo_competitors`
- `seo_factor_checks`
- `seo_gbp_profile` (public fields only)
- `seo_gbp_products`
- `seo_review_requests`
- `seo_gbp_posts`
- `seo_links` (citations + backlinks: type citation / backlink / local / premier, wave, domain, authority, verification, owner, status). Not the Notes & links table: that one is `seo_client_links` (phase 1).
- `seo_link_opportunities` (page URL, domain, found_via, authority_score, competitor_matches, why_fits, how_to_get, cost, next_action, next_action_date, this_week, sent_at, approved_at, live_at, link_id when it becomes a link)
- `seo_premier_relationships` (relationship type, page or route in, next action)
- `seo_sponsorships` (event, tier, cost, why, page flags, shows flags)
- `seo_serp_searches` (search, promising opportunity ids)
- `seo_authority_checks` (date, authority score, referring domains, backlinks)
- Weekly link pace lives on the client

**Prompt to paste**
```
Phase 4 of SEO Hub: GBP check, GBP care and links. Phases 1–3 are done.
Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md (rules + phase 4), docs/local-seo-playbook.md (Days 4, 7, 8, 9) and docs/design/ (GBP, GBPCare, Links, Autofill).
Plan first (no code), save as docs/phase-4-plan.md, update CONTEXT.md. After I approve: build step by step locally with Anassa, tell me what to test, commit locally. Do NOT push, merge or deploy until I say so.
Rules: never store or show the private address (not on any listing either); review tracker keeps only ref, date, channel, result; waves = rows 1,4,7… / 2,5,8… / 3,6,9…; no GBP API yet; no Semrush API (Backlink Gap = CSV, authority checks typed in); Sent / Approved / Live stay separate; check the wave list before adding a citation as an opportunity; Claude drafts are reviewed.
```

---

## Phase 5 · Push to site + automation (Vibe SEO 1.4.0)

**Screens:**
- Connection + work log (`Site`)
- Automation (`Automation`)

**Done when**
- [ ] Check-in endpoint, Connect site and `/clients/{site id}` are already done in phase 2
- [ ] Push title / meta / keyphrase to a page:
  - Before/after preview + confirm, logged in the work log
  - Needs **Vibe SEO 1.4.0**: pushes ride on the check-in reply and are applied via `save_field()`, SEO fields only
  - The applied-changes log comes back on the next check-in
- [ ] Redirects queue sent to sites (Vibe SEO 1.4.0 calls `VVDA_Redirects::import()`; Vibe Admin unchanged)
- [ ] Target keyword + approved hotspots shown read-only in WordPress (1.4.0)
- [ ] Automation:
  - Slack alerts: rank drops, swapped pages, fell off page 1, review ask due, site stopped checking in
  - Weekly SEO email (Mondays; the hub's keeps sending until this is ready, then switch with Alexia's OK)
  - ClickUp lists
  - Claude drafts queue

**Tables:**
- `seo_push_log`
- `seo_alerts`
- `seo_drafts`
- (`seo_sites` and `seo_site_reports` come from phase 2)

**Prompt to paste**
```
Phase 5 of SEO Hub: push to site + automation. Phases 1–4 are done (check-ins already work from phase 2).
Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md (rules + phase 5), docs/vibe-seo-plugin-plan.md, docs/vibe-seo-handoff-notes.md and docs/design/ (Site, Automation, Main).
Plan first (no code): pushes in the check-in reply, applied log, redirects queue, what Vibe SEO 1.4.0 needs (Vibe SEO only, never Vibe Admin, never remove a feature), Slack alerts, weekly email, ClickUp. Save as docs/phase-5-plan.md, update CONTEXT.md.
After I approve: build step by step, tell me what to test, commit locally. Do NOT push, merge or deploy until I say so.
Rules: every push has a preview + confirm and is logged; connection keys never leave the server; Claude drafts are never published without review.
```

---

## Phase 6 (later) · Client report view
- Read-only report per client. Could replace Agency Analytics, which Sam says costs ~$20 per client per month.
- Uses the phase 2 monthly reports: past → present → future, with charts.
- Client login or private link, with RLS so a client sees only their own data.
- Monthly PDF/email.
- No internal notes, competitor data or private address shown.
