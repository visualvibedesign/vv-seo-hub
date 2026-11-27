# Next session (updated Nov 28, 2026)

Shareable status note for the reviewer Claude: what was built, commit ids, what's pushed, what to test, what's
waiting on Angel. Updated after every step.

## Where we are
- **Phase 2 is finished and live in Production**: `main` = merge `6dbd2e4` (Nov 28: 2g PDF + GBP screenshot + fixes), after `324d0f3` (2a–2f).
- **Skipped for now:** Whitespark (map grid from a screenshot / CSV): no Whitespark account yet. The map grid stays
  optional and typed in by hand.
- **Phase 3 · Pages** on branch **`phase-3`** (plan `docs/phase-3-plan.md`, approved Nov 28: ClickUp later, structure per client default service first, page codes P1… auto). Step 1 done: migration 0021 run and checked. Step 2 done (`c0b4097`, Sitemap + hotspots) and **step 3 done (`b376d6e`, Site plan)**, both tested by Claude. Next: step 4, Claude hotspot drafts (Ready to review, approve into the page).
- Test client: **Visual Vibe Design** (`5c939f2631d6b31bdf4523e5d2f79a2c`): "Day 3" baseline (Nov 28) + the
  November 2026 report (Sent).
- 12 Vercel functions (Hobby cap). Migrations 0001–0020 run and checked.

## Everything built in this session, in order (for the reviewer Claude to check)

### On `main` / Production (merge `324d0f3`)
| Commit | What |
|---|---|
| `e906c4c` | GBP card as analytics: actions by month (grouped bars), "actions per 100 views", rating ring + reviews, views donut |
| `e786176` | Migrations 0017 (GBP views breakdown) + 0018 (`seo_save_baseline()`) |
| `2b58f45` | 2e step 1 · Baseline server (numbers per source with their own dates, save new / fill missing, history); map grid optional in Sources ("N of 4") |
| `145adb1` | 2e step 2 · Baseline page (Save baseline, Fill missing, Start a new baseline, past baselines, "N of 4 saved") |
| `b4fca7d` | 2e step 3 · "Baseline vs now" on the Overview |
| `d8fb348` | GBP: actions per 100 views from the typed actions ("directions not tracked") |
| `6d7ed0c` | 2f step 1 · Monthly reports server (create, preview, refresh, status, next actions, clicks per month) + migration 0019 |
| `b57851f` | 2f step 2 · Results page (create report, wins, every number vs baseline, clicks per month, report view); reports start from the baseline's month |
| `462ec72` | Fix: "Mark as sent" refused the team's today (server UTC vs Manila); server errors shown in the dialogs |
| `254ef2c` | 2f step 3 · Claude report notes (estimate → "Ready to review" → approve; numbers check; logged) |
| `9c702e3` | Dates in the agency time zone (Asia/Manila) everywhere |

### On `phase-2` only (pushed, Preview; not on `main` yet)
| Commit | What |
|---|---|
| `463aa23` | Fixes: dates sent to Claude written "Nov 28, 2026" + "copy dates exactly"; a Sent report is read-only (server refuses edits) until "Reopen as draft"; report notes shown once |
| `e346e3c` | 2g plan in `docs/phase-2-plan.md` |
| `be239db` | 2g · Report PDF: print view `/clients/{site}/results/{report}/print` (team login, A4, Vibe look, approved notes only, no address / accounts / drafts / costs), "Download PDF" button |
| `63604bc` | Migration 0020 (screenshot read kinds in `seo_autofill`) |
| `e7eda04` | 2g · GBP screenshot server (estimate, Claude read → "Ready to review", approve via normal GBP save, discard; image never stored) |
| `9dce8df` | 2g · GBP review screen ("Read a screenshot" on the GBP card, review beside the screenshot, approve / discard) |
| `a6bc5b0`, `642b518`, this note | Next-session notes |

## Test checklist for the reviewer Claude (localhost or the `phase-2` Preview, client Visual Vibe)
Angel already tested all of these; this is for an independent check. Don't change the real November report
(no redraft / approve / send on it); use a new draft report or mocks.

**Overview**
1. Sources: "4 of 4 connected", map grid "Optional · not set up".
2. GBP card: actions by month, "Actions per 100 views 5.1" with "directions not tracked", rating ring, donut.
3. Baseline vs now: 7 rows, dates under each number, change pills (green = better, lower position = better).
4. GBP › "Read a screenshot": cost shown first → read → "Ready to review" banner → Review: numbers match, unread
   fields orange and empty, unclear month left empty to pick, a month typed before keeps its reviews / rating →
   Approve / Discard / Later. A non-GBP image is refused. Nothing is stored from the image.

**Baseline**
5. "4 of 4 saved", cards "Saved · dates", "Start a new baseline" keeps the old one under Past baselines.
6. Day 3 "Starting numbers" ticks itself when all required sources are saved.

**Results**
7. Only months from the baseline's month are offered (November 2026); earlier months are refused.
8. Report view: frozen numbers with dates, missing reasons, Refresh (draft only), Mark as sent (no future date;
   errors show in the dialog), Reopen as draft.
9. Sent report = read-only: next actions are a plain list, the server refuses edits, notes locked.
10. Claude notes on a draft: estimate → draft → numbers check flags invented numbers → approve. Dates in the
    draft read like "Nov 28, 2026". Notes show once when the report is open.
11. Download PDF: A4, footer "Prepared by Visual Vibe Design · date" + "Page X of Y", light even in dark mode,
    approved notes only (draft notes left out with an on-screen warning), sign-in required (private window → sign-in).

**Everywhere**
12. Settings › Claude usage lists "Report notes" and "GBP screenshot" calls with tokens + cost.
13. Phone width + dark mode on Overview, Baseline, Results.

## Waiting on Angel
1. ~~Merge `phase-2` into `main`~~ done (`6dbd2e4`, pushed to Production Nov 28).
2. Fix the November report notes date yourself (old approved text says "2026-11-27").
3. ~~Run migration 0021~~ done.
4. Later: Whitespark account (map grid from a screenshot / CSV); GBP API (not applied for yet).
5. `ANTHROPIC_API_KEY` set in Vercel Production env (Claude notes + GBP screenshots in Production).

## Phase 3 commits (branch `phase-3`, pushed)
| Commit | What |
|---|---|
| `6f82cfc` | Phase 3 plan |
| `7b9b49a` | Migration 0021 (pages fields, site structure, redirects, BrandScript, page briefs, Claude kinds); run by Angel |
| `f1e8420` | `main` (with Phase 2g) merged into `phase-3` |
| `c0b4097` | **Step 2 · Sitemap + hotspots** (Strategy Builder › Day 5): structure picker; "fill codes" banner with a dry run (only empty fields: P1… in page order, Home → home, S1–S3 → service, FAQ → supporting, live → Keep, planned → New); page list P1… with Keep / Improve / New; hotspot editor with live counters (title 50–60, meta 150–160), checks (meta ends with a CTA, primary keyword near the start, full state name in the title, abbreviation in the URL, no [brackets]), Google preview, "Google may show /x instead" flag; saving a new URL on a live page queues a redirect (shown in step 3); + Add page. Claude draft, page brief, push to site, ClickUp shown as later. API in `api/clusters` (still 12). Tested by Claude: real 9 pages, dry run, refusals, screen light / phone dark |

**Step 2 tested by Claude on Visual Vibe (Nov 28, server functions the screen calls): 22 / 22 passed.** Fill dry run
→ applied (P1–P9: Home keep, 4 hubs keep, 5 city pages new; run again = nothing left); hotspots save + URL cleaned to
a slug; a live page's URL change queues 1 redirect, a second change updates it (not doubled), setting it back removes
it; a planned page's URL adds no redirect; duplicate / bad codes and a 121-character title refused; structure
switch + back; add-page refusals (no name, unknown category, keyword already on another page). Everything put back
afterwards: the only real change kept is the fill (codes P1–P9, types, Keep / New). Checked read-only: hotspots
empty on all 9 pages, 0 redirects, structure service first, 9 pages. A real "+ Add page" was NOT run (cleaning up
would need a delete). Fix found while testing: clearing every hotspot field now counts as "no hotspots" (`14b9d66`).

| `b376d6e` | **Step 3 · Site plan** (Strategy Builder › Day 5): page tree in the client's structure order (Home → service / location pages → children under their parent → supporting); "Move under…" per page (never itself or its own child); planned pages marked New; body-copy linking rule. Redirects queue: added automatically when a live page's URL changes; click a status to move it Queued → Sent to site → Live (→ Queued). API page-parent, redirect-status in `api/clusters` (still 12) |

**Step 3 tested by Claude on Visual Vibe: 12 / 12 passed** (P3 + P4 under P2; loop, self and unknown parent
refused; a P2 URL change gives 1 queued redirect with its page code; status Queued → Sent → Live → Queued; bad status
/ unknown redirect refused; then everything put back). Fix found while testing: clearing a live page's target URL
(empty instead of setting it back) now also drops its still-queued redirect. Checked read-only after: 0 redirects,
no parents, no hotspots, 9 pages. Screen rendered with the captured state (light desktop, dark phone).

## How to test step 3 (localhost, Visual Vibe › Strategy Builder › Day 5 · Site plan)
1. Tree: P1 Home on top, then "Service pages" P2…P9 (all service pages today), planned ones marked New.
2. "Move under…" on P3 › Under P2 Web Design hub › P3 moves under P2. Try moving P2 under P3: refused. Top level puts it back.
3. On Sitemap + hotspots change P2's URL and save › Site plan shows 1 redirect /web-design → new › click its status: Sent to site → Live → Queued.
4. Back on Sitemap + hotspots, clear P2's URL (or set it back) and save › the queued redirect is gone.

## How to test step 2 (localhost, Visual Vibe › Strategy Builder › Day 5 · Sitemap + hotspots)
1. Banner "9 pages have no code…" › See what would change › list P1–P9 (Home keep, 4 hubs keep, 5 city pages new) › Fill 9 pages.
2. Pick a page › type a title: the counter turns green at 50–60; meta warns without a call to action; Google preview updates.
3. Change a live page's URL (e.g. P2 to /web-design-northwest-ar/) › the orange "Saving queues a redirect" line › Save › reload: kept. (The redirect shows on Site plan in step 3; set the URL back to undo it.)
4. Change structure (service first / location first / flat) › reload: kept.
5. + Add page › name + category › new page with the next code, marked New.

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Never store or show a private address; no images saved from screenshots; secrets only in `.env.local` / Vercel.
- Supabase connector read-only; write SQL shown to Angel first, Angel runs it.
- Claude output is "Ready to review" until Angel approves; log every call.
- Ask before pushing `main` / Production. Stay at 12 Vercel functions.
- Light + dark mode, phone width, no emoji in the UI. Dates in the agency time zone (Asia/Manila).
- Update this note after every step (commit ids, pushed or not, waiting on Angel).
