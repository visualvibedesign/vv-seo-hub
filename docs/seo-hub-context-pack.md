# SEO Hub – Context Pack

Everything Claude needs to know for the SEO Hub project. Updated Nov 25, 2026. Order of every phase (SEO Hub + Vibe SEO): `BUILD-ROADMAP.md`.

## Who
- **Angel**: Web Developer & SEO Support at Visual Vibe Design (remote, Cebu, Philippines). Builds sites in Elementor, manages Google Business Profiles, does keyword research and monthly SEO reporting. Owns SEO Hub and the Vibe SEO plugin.
- **Alexia**: agency lead, gives SEO strategic direction. Owns Visual Vibe HQ and the Vibe Admin plugin. Agency based in Rogers, AR, serves clients nationwide.
- **Sam** (Local SEO Academy / Thencan Designs): host of the 10-Day Rank Yourself SEO Challenge we follow.

## How Angel likes answers
- Short, straight to the point, bullets or tables, casual (not too formal).
- Slack/ClickUp messages as drafts in copyable code blocks, in Angel's voice. Never send them.
- Never log in to WordPress admin. Never change the Vibe Admin plugin files (Vibe SEO is Angel's and can be changed).
- Never push, merge or deploy without Angel saying so.

## The project
- **Goal:** an SEO dashboard web app ("SEO Hub"), like our project management app Visual Vibe HQ, but only for SEO. Strategy + implementation + later automation, for every SEO client.
- **Stack:** React + Vite (same setup as HQ), Vercel (`vv-seo-hub.vercel.app`), Supabase (same project as HQ), GitHub (`visualvibedesign/vv-seo-hub`), Claude API (from phase 1, same account as HQ), ClickUp API, Slack. Team-only.
- **Login:** shared team password + signed `vv_session` cookie from HQ (no Supabase Auth, no user list). See Phase 0 in `seo-hub-phases.md`.
- **Look:** same as Visual Vibe HQ (see Look below). The approved design canvas is the source of truth: https://claude.ai/artifact/8WkeSEz7sQxqm6NRV5Uu8H (export screens into `docs/design/` for Claude Code).
- **How it works:** you upload, Claude fills, you approve. Each step lists the exact exports with "how to get this file" steps; plain code rules fill exact things, the **Claude API** (same Anthropic account as HQ) fills judgment and writing; everything is "Ready to review" until approved. New clients start from **templates** and follow a **step-by-step guide** of Sam's 10 days.
- **Connects to client sites** through the **Vibe SEO** WordPress plugin (1.0.0, split out of Vibe Admin 1.38.0 by Alexia on Nov 19, 2026). Sites send a signed daily check-in to SEO Hub. Live version is Vibe SEO 1.2.0 (Alexia, Nov 21). Plan: 1.3.0 adds a per-site SEO Hub key + read-only page data (with SEO Hub phase 2), 1.4.0 applies approved pushes + redirects (with phase 5). Add only: nothing removed, Vibe Admin never changed. Details: `vibe-seo-plugin-plan.md`, `vibe-seo-handoff-notes.md`.
- **Status (Nov 24, 2026):** portal live in HQ (SEO Hub card closed for now). SEO Hub repo + Vercel set up; phase 1 steps 1–4 built locally (database, sign-in, clients, CSV import). Vibe Admin 1.38.0 + Vibe SEO 1.0.0 tested on the staging site. Full design (phases 1–5) done. Nov 25: integration plan with Vibe SEO decided (see `vibe-seo-plugin-plan.md`), questions sent to Alexia. Next: rest of phase 1 (new sidebar, templates, guide, uploads + auto-fill).

## Key docs (links)
- Master roadmap (both projects, in order): `BUILD-ROADMAP.md`
- Full SEO Hub phase plan + prompts: `seo-hub-phases.md`
- Vibe SEO plugin plan (releases, connection key): `vibe-seo-plugin-plan.md`
- Vibe SEO plugin handoff (API, routes, release steps): `vibe-seo-handoff-notes.md` · live doc https://claude.ai/artifact/16FpwdrWz5JNpYroz1Mv28
- Sam's full process: `local-seo-playbook.md` (Days 1–10)
- SEO Hub design canvas (all screens): https://claude.ai/artifact/8WkeSEz7sQxqm6NRV5Uu8H
- Strategy brief (Google Doc): https://docs.google.com/document/d/1oQejyg41v92z9VL2DMgCz0S0HlQuxk5hbAzSqsUdUYA/edit
- Anassa data (example client sheet): https://docs.google.com/spreadsheets/d/1-2eOHF19IGriVokfAhJ_1Gdh7DHhjjOcBRzfCoxYMxA/edit
- Old dashboard mockup (WordPress-admin look, for screen ideas only): https://claude.ai/artifact/5vJcmegarEA7wr6Jb4h1Mq
- Visual Vibe HQ live: https://visual-vibe-dashboard.vercel.app

## Sam's process → SEO Hub steps (one flow per client)
| Step | Sam day | What |
| --- | --- | --- |
| 0 Client setup | 1 | S1–S3 services, A1–A3 areas, ideal client, account checklist (GSC, GA4, GBP, Semrush, Whitespark, Clarity) |
| 1 Keywords | 2 | KP + Semrush CSV import, master keyword database, 3×3 matrix (+ Home row), clusters |
| 2 Baseline | 3 | Semrush Position Tracking CSV (US), Whitespark grid, GSC / GA4 / GBP numbers with dates |
| 3 GBP check | 4 | Competitors (Maps, Pleper categories, reviews), Whitespark factors, business details (private address hidden) |
| 4 Sitemap + hotspots | 5 | Page list (P1…, keep/improve/new), keyword owner, title 50–60, meta 150–160 + CTA, H1, URL, swapped-page flags |
| 5 Page brief | 6 | BrandScript A–P, 11-section StoryBrand copy, V1/V2 |
| 6 GBP care | 7 | Products (720×720), review email + tracker, 13-week posts (1200×900, UTM) |
| 7 Link database | 8–9 | BrightLocal citations in 3 waves (rows 1,4,7… / 2,5,8… / 3,6,9…), Backlink Gap, local + premier links |
| 8 Results | 10 + monthly | Compare everything with the baseline |

## Keyword research rules (Sam's Day 2 + our way)
- S1–S3 = the client's 3 main service categories; each gets one main keyword/page + backups. "Home" row = the general keyword for the home page.
- Sources: Keyword Planner (client city; record the range as shown, e.g. 10–100, never the 50/500 stand-ins) + Semrush (paid, US database; Keyword Magic Tool with city filter, bulk Keyword Overview, Keyword Gap; click Update metrics when empty).
- Show both numbers ("Semrush 110 · KP 10–100").
- Master Keyword Database columns: Keyword, Role (Primary teal / Secondary light blue / FAQ orange / Near me light gray), Service, Intent, KP vol, Semrush vol, KD %, CPC.
- Clusters: Category, Page, Priority (High/Medium/Low), Primary keyword, Volume · KD, Secondary + FAQ ideas, Why ("Live page" / "Not live yet"). No duplicate keywords across pages.
- Sam's rules: keep raw files untouched; record volumes exactly; keep sources/cities separate; remove only exact duplicates; every primary traces to a source; generic "near me" terms aren't page targets; N/A and Pending allowed.
- Reports for Alexia: don't name her in them; define KP / Semrush / KD; no worksheet wording.

## Agency rules
- Rank tracking: **Semrush Position Tracking**, target **United States (national)**, not SerpFox. Local view comes from the Whitespark geogrid.
- **No Semrush API** (too expensive): CSV imports only. GSC + GA4 free APIs. GBP typed in until API approval. Whitespark: CSV/screenshots.
- Never store or show a client's private address.
- Don't rebuild what other tools do (Yoast, ClickUp tasks, rank tracking).

## Example client: Anassa Wax & Beauty
- anassabeauty.com, Staten Island, NY. Owner doesn't wax men (men's keywords out of scope).
- S1 Brazilian & Bikini · S2 Face & Brows · S3 Body Waxing. A1 = Staten Island as a whole (no neighborhoods); A2/A3 N/A.
- Appointments at the owner's private studio: address never listed publicly.
- Primaries: Home "waxing staten island" (210 · 10–100), S1 "brazilian wax staten island" (110 · 10–100), S2 "brow lamination staten island" (30 · 10–100), S3 "body waxing staten island" (10 · no data, page not live yet).
- Semrush Position Tracking set up Nov 18, 2026 (10 keywords, US). Baseline Nov 17: 8 of 10 keywords on pages 3–4, none on page 1; Google shows Home or /services/ instead of service pages; brow lamination + back waxing not in top 100; not found on Maps at any of 18 Whitespark points. GSC 1,020 impressions · 65 clicks · avg position 21; GA4 882 sessions (125 Google); GBP 182 views · 0 calls · 12 website clicks.
- Open items: final review of Keep keywords; clusters task; confirm KP "Discover new keywords" location was Staten Island.

## Alexia's decisions
- Nov 19: build a **separate SEO Hub** app (like Visual Vibe HQ, only for SEO), not inside app.alexialynn.co. It links to the Vibe SEO plugin on every site.
- Nov 19: **team only.** Later maybe replace **Agency Analytics** with a client view (phase 6).
- Nov 19: all SEO + build features moved into the Vibe SEO plugin; shared pieces stay in Vibe Admin. Done (Vibe SEO 1.0.0).
- Nov 19: **keywords will live in SEO Hub** eventually; keep Google Sheets until it's ready.
- Nov 20: **one-login portal** approved, built inside Visual Vibe HQ (apps page with cards for HQ, SEO Hub, Client Reports).

## Leave out
Own rank tracking, Semrush API, GBP API (for now), client editing, live AI on every page, rebuilding Yoast, task management.

## Build phases (details in seo-hub-phases.md)
0. One-login portal (inside HQ)
1. Clients, keywords, templates, step-by-step guide, uploads + Claude auto-fill (Days 1–2)
2. Baseline, reports, monthly archive, Day 10 review, GSC/GA4 API, **Connect site + receive check-ins** (Days 3 + 10, with Vibe SEO 1.3.0); then a one-time import of the agency hub's data
3. Pages: sitemap + hotspots, site plan + redirects queue, page briefs (Days 5–6)
4. GBP check, GBP care, links (Days 4, 7, 8–9)
5. Push to site + redirects (with Vibe SEO 1.4.0) + automation (Slack, weekly email, ClickUp)
6. Later: read-only client report view (could replace Agency Analytics)

## Look (match Visual Vibe HQ)
Fraunces headings with a purple italic accent word (#7C5CE6), Inter body, page bg #F7F5FF, text #131314, sidebar #EEEAFF with active pill #BFAFFF, white cards (22px radius, 1px #ECE8FB border, shadow `0 14px 30px -24px rgba(91,63,208,.45)`), lime #BAD657 pill buttons, light + dark mode, phone layout. Reuse HQ's styles and components. For data tables: clear grey header rows, status colors good #2e8b57 / ok #d39b16 / bad #c9483c, role tags Primary teal, Secondary light blue, FAQ orange, Near me gray.
