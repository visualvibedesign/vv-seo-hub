# SEO Hub + Vibe SEO – Build Roadmap (all phases, in order)

**Updated Nov 25, 2026.** This is the master list. Every phase of **both** projects, in the order we build them, with where to run it and the prompt to paste.

- **SEO Hub** = the web app. Folder `vv-seo-hub`, repo `visualvibedesign/vv-seo-hub`, Vercel `vv-seo-hub.vercel.app`.
- **Vibe SEO** = the WordPress plugin on each client site. Folder `vibe-seo`, repo `visualvibedesign/vibe-seo` (to create), released on `app.alexialynn.co/plugins/vibe-seo/`.
- **Vibe Admin** = Alexia's plugin. **Never changed.**

Details live in:
| Doc | What's in it |
| --- | --- |
| `seo-hub-phases.md` | SEO Hub phases: screens, "done when" checklists, tables, prompts |
| `vibe-seo-plugin-plan.md` | Vibe SEO releases, connection key, how a site connects, safety rules, questions for Alexia |
| `vibe-seo-handoff-notes.md` | Check-in API, routes, hub pieces, release steps (from Alexia) |
| `seo-hub-context-pack.md` | Who, goals, rules, look (Anassa data = history) |
| `local-seo-playbook.md` | Sam's 10-Day process (the flow the app follows) |
| `docs/design/` | Exported screens from the design canvas https://claude.ai/artifact/8WkeSEz7sQxqm6NRV5Uu8H |

---

## The big picture
**You upload, Claude fills, you approve.** SEO Hub is where all SEO work happens. Each client site connects through Vibe SEO, which sends its numbers in (check-ins) and later applies approved changes (pushes). Alexia's agency hub and every existing Vibe SEO feature keep running. Nothing is removed.

```
Client site (WordPress)                      SEO Hub (vv-seo-hub)
 Vibe Admin (Alexia, unchanged)               Clients · Keywords · Baseline · Pages
 Vibe SEO (Angel)  ── signed check-in ──►     GBP · Links · Results · Automation
                   ◄── approved pushes ──     (Supabase + Claude API + Google APIs)
```

## Order at a glance (decided Nov 25: **website first, then the plugin**)
SEO Hub phases 1–4 are built first. The site-connection parts (Connect site, check-ins, pushes) wait until the plugin is built, so nothing is half-done.

| # | Phase | Where | Sam days | Status |
| --- | --- | --- | --- | --- |
| 0 | One-login portal | Visual Vibe HQ | — | Done (SEO Hub card closed for now) |
| A | Ask Alexia | Slack | — | Message ready |
| 1 | Clients, keywords, templates, guide, uploads + auto-fill | SEO Hub | 1–2 | **Built** (redesign + Overview / Strategy Builder split, Settings); merged to `main` locally Nov 26; checklist `docs/phase-1-checklist.md` |
| 2 | Baseline, reports, Day 10 review (**without** the site connection) | SEO Hub | 3, 10 | **Plan ready:** `docs/phase-2-plan.md` + SQL 0016 draft (not run) |
| 3 | Pages: sitemap, hotspots, site plan, page briefs | SEO Hub | 5–6 | |
| 4 | GBP check, GBP care, links | SEO Hub | 4, 7, 8–9 | |
| P0 | Set up the Vibe SEO repo from 1.2.0 | Vibe SEO | — | After phase 4 |
| P1 + 2c | **Vibe SEO 1.3.0** + SEO Hub **Connect site / receive check-ins** (the connection items from phase 2) | Both | — | Built and tested together |
| 2b | One-time import of Alexia's hub data | SEO Hub | — | If Alexia OKs |
| P2 + 5 | **Vibe SEO 1.4.0** + SEO Hub push to site + automation | Both | — | Built and tested together |
| P3 | Vibe SEO 1.5.0: planned pages → drafts | Vibe SEO | — | Later |
| 6 | Client report view | SEO Hub | 10 monthly | Later |

While building phases 1–4: screens that will show site data later (Overview SEO table, "Live now", Site › Connection) show an empty state "Connect the site (coming soon)". Never fake site data.

## Rules for every phase (both projects)
- Plan first → Angel approves → build step by step locally → Angel tests → commit locally.
- **Never push, merge, deploy or upload a plugin release until Angel says so.**
- Never change Visual Vibe HQ's code (read only) or **Vibe Admin**. Never log in to WordPress admin.
- **Vibe SEO: add only.** Never remove or change how an existing feature works.
- Never store or show a client's private address. Keys/passwords never in tables or the browser.
- Claude output is "Ready to review" until approved. Never change exported numbers or invent facts.
- Volumes exactly as exported (KP ranges stay text). Missing data = "—", never 0.
- Test client: Visual Vibe Design (site id `5c939f2631d6b31bdf4523e5d2f79a2c`), the only client since Nov 26. Anassa (`c6e74adc…`) was deleted and will be re-added from her .xlsx.

---

## Phase 0 · One-login portal (Visual Vibe HQ) — DONE
`/apps` page in HQ ("Pick your vibe") with cards: HQ (live), SEO Hub (Building, closed), Client Reports (later).
**Later:** the SEO Hub card opens SEO Hub with a one-time handoff link; needs custom domains (`hq.` / `seo.visualvibedesign.com`).

---

## Step A · Ask Alexia (before plugin work)
1. Who edits Vibe SEO now? Send the 1.2.0 files; who uploads releases?
2. OK to add a per-site **SEO Hub key** (falls back to `hub_key`)?
3. OK for Vibe SEO to call `VVDA_Redirects::import()`?
4. OK to copy hub client workspaces, site plans, monthly reports into SEO Hub once (read-only)?
5. Weekly email: switch to SEO Hub's later, with her OK?
6. Later: option to hide the hub's SEO screens (never removed)?
7. Domains `seo.` / `hq.visualvibedesign.com`?

---

## Phase 1 · SEO Hub: clients, keywords, templates, guide, uploads + auto-fill (Days 1–2)
**Where:** `vv-seo-hub`, branch `phase-1`. **Already built:** database (12 tables), sign-in, clients, CSV import + delete import.
**Builds:** new sidebar (hub mode never lists clients; client mode grouped + foldable), All clients page, Add client wizard, 7 templates + editor, step-by-step guide, Uploads + auto-fill (Day 1 + 2), keyword table + 3×3 matrix + clusters, Notes & links, Claude API auto-fill + AI log.
**Done when / tables:** see `seo-hub-phases.md` › Phase 1.
**Before you paste:** export design screens into `docs/design/`, add `ANTHROPIC_API_KEY` to `.env.local`.

**Prompt 1a · catch up with the new plan (paste first)**
```
The plan changed. Read docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md, docs/seo-hub-context-pack.md, docs/vibe-seo-plugin-plan.md, CLAUDE.md and docs/design/. Compare them with what's already built on phase-1 and list what to keep, change or remove. Plan only, no code yet.
```
**Prompt 1b · build the rest of phase 1** → copy from `seo-hub-phases.md` › Phase 1.

---

## Phase P0 · Vibe SEO: repo setup from 1.2.0 (after SEO Hub phase 4)
**Where:** new folder `vibe-seo` (next to `vv-seo-hub`), private repo `visualvibedesign/vibe-seo`.
1. Get the 1.2.0 plugin files from Alexia → unzip into the folder (folder name `vibe-seo`).
2. Copy the `vibe-seo-kit` files in (CLAUDE.md + docs/).
3. Open Claude Code there and paste:
```
This is the Vibe SEO WordPress plugin (1.2.0, live). Read CLAUDE.md and everything in docs/ first, especially docs/vibe-seo-plugin-plan.md and docs/BUILD-ROADMAP.md.
Do NOT change any code yet. Map the plugin: main files, classes, hooks, settings, the check-in (VVDS_Link), what it uses from Vibe Admin (read only), and where each 1.3.0 update would go. Write it to CONTEXT.md.
Then git init and connect to github.com/visualvibedesign/vibe-seo, first commit "Vibe SEO 1.2.0 (from Alexia)". Do NOT push until I say so.
```

---

## Phase P1 + 2c · Vibe SEO 1.3.0 (read-only, add-only) + SEO Hub Connect site — after phase 4
**Adds:**
- Settings › Vibe SEO › **SEO Hub key** (per site; empty → falls back to Vibe Admin's `hub_key`)
- SEO Hub status card: last sent, OK / error, **Check in now**, **Open in SEO Hub** (`{seo_hub_url}/clients/{site id}`)
- Check-in payload additions (in `VVDS_Link::payload()`): pages list (URL, status, title, meta, keyphrase, score, missing image/alt, orphan, last edited), duplicate keyphrases, link ideas, QA summary (open vs checked, last scan)
**Never:** writes anything to pages, changes Vibe Admin, removes a feature.
**Test:** staging site with `VVDS_UPDATE_INFO_URL` in wp-config → check-in reaches SEO Hub local/preview → smoke test → Angel OKs → release.

**Prompt**
```
Vibe SEO 1.3.0. Read docs/vibe-seo-plugin-plan.md (1.3.0 rows, connection key, safety rules) and CONTEXT.md.
Plan first (no code): the SEO Hub key setting (fallback to hub_key when empty), status card + Check in now + Open in SEO Hub link, and the new check-in fields (pages list, duplicate keyphrases, link ideas, QA summary) using the existing VVDA_SEO::audit()/summary() and QA data. Add only: never remove or change existing features, never change Vibe Admin.
After I approve: build step by step, bump to 1.3.0 everywhere (Version, VVDS_VERSION, readme Stable tag + changelog, info.json), tell me how to test on the staging site. Commit locally. Do NOT push or upload a release until I say so.
```

---

## Phase 2 · SEO Hub: baseline, reports, Day 10 review (Days 3 + 10)
**Builds now:** Semrush Position Tracking import, GSC + GA4 (free APIs), GBP numbers, Whitespark grid, monthly report archive, Day 10 review.
**Built later (step 2c, with plugin 1.3.0):** Connect site (per-site key shown once, Regenerate), `POST /api/vibe/checkin`, `/clients/{site id}`, check-in data in Overview / Reports / Work log. Test: staging site → Connect site → paste key → Check in now → SEO Hub shows Connected + pages.
**Done when / tables / prompt:** `seo-hub-phases.md` › Phase 2.

## Phase 2b · One-time import of Alexia's hub data (only if she OKs)
Read-only copy of client workspaces (`vvda_seo_ws`, `vvda_seo_log`), site plans (`vvda_site_plan`, `vvda_redirect_queue`) and monthly reports (`vvda_seo_reports`) into SEO Hub. Her data stays where it is.
**Prompt**
```
One-time import of the agency hub's SEO data into SEO Hub. Read docs/vibe-seo-handoff-notes.md (hub pieces table) and docs/BUILD-ROADMAP.md (phase 2b).
Plan first (no code): how we get the data (an export file from the hub that Alexia or I download, never logging in to WordPress for it), which SEO Hub tables each part maps to, matching by site id, and that it's a read-only copy marked "Imported from hub". After I approve: build it, test with one client, commit locally. Do NOT push or deploy until I say so.
```

---

## Phase 3 · SEO Hub: pages, hotspots, site plan, page briefs (Days 5–6)
"Live now" from check-ins next to planned hotspots, hotspot editor with counters + Google preview, site plan + redirects queue, BrandScript + page briefs, ClickUp Web Page tasks.
**Done when / tables / prompt:** `seo-hub-phases.md` › Phase 3.

## Phase 4 · SEO Hub: GBP check, GBP care, links (Days 4, 7, 8–9)
Competitors per service, Whitespark factors, business details (public only), products, review email + tracker, 13-week posts, BrightLocal 3 waves, Backlink Gap, link ideas from check-ins.
**Done when / tables / prompt:** `seo-hub-phases.md` › Phase 4.

---

## Phase P2 · Vibe SEO 1.4.0 (writes, add-only) — built together with SEO Hub phase 5
**Adds:**
- Apply pushes from SEO Hub's check-in reply: title / meta / keyphrase via `VVDA_SEO::save_field()`. Each push has an id, applied once, SEO fields only.
- Applied-changes log (before → after, who, when), sent back in the next check-in.
- Redirects from SEO Hub via Vibe Admin's `VVDA_Redirects::import()` (Vibe Admin unchanged).
- Target keyword column in WP Pages list + approved hotspots shown read-only.
**Prompt**
```
Vibe SEO 1.4.0. Read docs/vibe-seo-plugin-plan.md (1.4.0 rows + safety rules) and CONTEXT.md.
Plan first (no code): reading pushes from SEO Hub's check-in reply (signed, each push id applied once, SEO fields only via VVDA_SEO::save_field()), the applied-changes log sent back next check-in, redirects through VVDA_Redirects::import() (never change Vibe Admin), and the read-only target keyword column + hotspots in WP. Add only: never remove or change existing features.
After I approve: build step by step, bump to 1.4.0 everywhere, tell me how to test on the staging site with SEO Hub. Commit locally. Do NOT push or upload a release until I say so.
```

## Phase 5 · SEO Hub: push to site + automation
Push with before/after preview + confirm, work log, redirects sent to sites, Slack alerts, weekly SEO email (switch from Alexia's with her OK), ClickUp lists, Claude drafts queue.
**Done when / tables / prompt:** `seo-hub-phases.md` › Phase 5.

---

## Phase P3 · Vibe SEO 1.5.0 (later)
Planned pages from SEO Hub's site plan → WordPress drafts, using Build's existing "create pages". Nothing published automatically.

## Phase 6 · SEO Hub: client report view (later)
Read-only monthly report per client (could replace Agency Analytics), past → present → future, RLS so each client sees only their own data. No internal notes, competitor data or private address.

---

## Release checklist (every Vibe SEO version)
1. Bump `Version:` + `VVDS_VERSION`, readme Stable tag + changelog, `info.json` (newest first). Raise `VVDS_NEEDS_ADMIN` only if needed.
2. Test on staging only (`VVDS_UPDATE_INFO_URL` in wp-config.php points staging at the test files).
3. Smoke test (handoff PDF list) + check SEO Hub receives the check-in.
4. **Angel OKs** → upload Vibe SEO's folder to `app.alexialynn.co/plugins/vibe-seo/` (sites with auto-update install it themselves).
5. Log "Vibe SEO X.Y.Z" in ClickUp "Vibe Admin Plugin" list, status complete.

## Every SEO Hub phase
plan → build locally → Angel tests on localhost → Vercel preview only when Angel says → Alexia reviews → fix → next phase.
