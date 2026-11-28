# Next session (updated Nov 29, 2026)

Shareable status note for the reviewer Claude: what was built, commit ids, what's pushed, what to test, what's
waiting on Angel. Updated after every step.

## Where we are
- **Production (`main`) = merge `39009e7` (Phase 3 · Pages, pushed by Angel's OK).** Before it: `6dbd2e4` (Phase 2g + fixes), `324d0f3` (2a–2f).
- **Phase 2 is finished and live.**
- **Skipped for now:** Whitespark (map grid from a screenshot / CSV): no Whitespark account yet. The map grid stays
  optional and typed in by hand.
- **Phase 3 · Pages is finished and live in Production** (merge `39009e7`): migration 0021, Sitemap + hotspots (`c0b4097`), Site plan (`b376d6e`), Claude hotspot drafts (`49336fb`), BrandScript (`4daa2cd`), page brief + page copy (`b5ca921`). All tested by Claude; the reviewer can still run the checklists below on Production. ClickUp sync is "later". Work continues on branch `phase-3` (same as `main` now) until Phase 4 gets its own branch.
- **Now: Phase 4 · GBP check, GBP care, links** (Sam Days 4, 7, 8–9), branch **`phase-4`**. Plan `docs/phase-4-plan.md` **approved by Angel** with decisions: order 4a → 4b → 4c; paste / type citation + Backlink Gap rows until CSV samples come; Maps / Pleper screenshot reading built in 4a (last step); review target 5, editable per client.
- **4a step 1: migration 0022 run by Angel** and checked (4 tables, RLS, triggers, no address column, kind `map_competitors`).
- **4a step 2: server + API done** (no screen yet). `server/services/gbpCheckService.ts`, shared math + lists in `src/lib/gbpCheck.ts`, types in `src/types/seo.ts` (GbpCheckState…). Actions in the existing `api/metrics/[action].ts` (still 12 functions): GET `gbp-check?site=`; POST `gbp-search-save`, `gbp-competitor-save`, `gbp-competitor-delete`, `gbp-factor-save`, `gbp-profile-save` (each returns the whole state).
  - Rules: up to 10 competitors per service, unique rank + name per service, one client row per service (name defaults to the client); missing numbers stay null; dates can't be in the future (check-again can); any text that looks like a street address is refused; any field named like "address" (other than addressShown) is refused; description ≤ 750 with no em / en dashes.
  - Math (`mapPackStats`): average = total reviews ÷ rows with a count (top 10 by rank, client row left out); pace = median of 30 ÷ days since each competitor's newest review (ballpark / month); goal = pace rounded up + 1, between 2 and 10.
  - Pinned client row: `fromGbp` = reviews / rating / newest review from the newest typed GBP period (Visual Vibe: 23 reviews, 5.0, Nov 14).
  - **Tested by Claude: 25 / 25 pass** on Visual Vibe (search, 5 rows + stats, refusals, client row, edit, factor, profile, address refusals), then put back: 0 competitor rows; one empty search row, one "to check" factor row and one empty profile row are left (empty = same as nothing).
- **4a step 3: GBP check screen done** (`strategy/gbp`, sidebar "Day 4 · GBP check" now live). `src/pages/client/GbpCheckPage.tsx`, `src/components/gbp/CompetitorDialog.tsx` + `ProfileDialog.tsx`, `src/hooks/useGbpCheck.ts`, API calls in `src/lib/api.ts`.
  - Competitors card: S1–S3 tabs (service names), Maps search line (Edit / Set the search: search, date checked, results counted), table (phone: stacked cards), Edit per row (Remove inside, with a confirm), + Add competitor (next free rank, max 10). The client's row is pinned at the bottom: typed here, or else shown from the newest GBP numbers with "Add" (saves it here). Pills: average (n counted), pace (~/month), goal; empty = "—".
  - Factors card: status pill per factor (To check / OK / Needs work / N/A) + a short note. Business details card: view list + Edit popup (public fields only, "Address shown on GBP?" select, description counter 750 + em dash warning, date checked, waiting on Google, check again). Private address box under it. Profile check card: 7 ticks (saved straight away).
  - **Tested by Claude**: typecheck + lint clean; rendered in headless Edge at 1400px (filled + empty) and 390px dark; matches docs/design/GBP.png. Server tests from step 2 cover the saves.
- **How to test 4a (localhost or Preview, Visual Vibe › Day 4 · GBP check)**: set the S1 search; add 3–5 competitors (leave one review count empty → average skips it); click "Add" on your pinned row; set a factor + note; Edit business details (try a street like "45 Oak Avenue" in Service areas → refused; an em dash in the description → blocked); tick a profile check; switch to S2 (empty). Remove test rows after.
- **4a step 4: Maps / Pleper screenshot → competitor rows done.** `server/services/mapShotService.ts` (estimate, read, approve, discard), actions `map-shot-estimate | map-shot-read | map-shot-approve | map-shot-discard` in `api/metrics/[action].ts` (still 12 functions), Claude task `map_competitors` (Sonnet, effort low) in `src/lib/aiModels.ts`, autofill kind `map_competitors` (step 3 = Day 4; hidden from the Day 2 auto-fill lists via NOT_KEYWORDS). UI: "Read a screenshot" on GBP check (`src/components/gbp/MapShotDialog.tsx`: pick → cost → read, for the open S tab), a "Ready to review" banner, and `MapShotReview.tsx` (tick rows, fix rank / name / numbers, "This is the client", Discard read / Later / Add N rows). Modal got a `wide="xl"` size (900px).
  - Rules: the image is sent once, never stored or logged; Claude's answer has no address / phone / website fields; address-like names are dropped; ads skipped; unclear = empty; dates only when shown with a year (never from "2 weeks ago"). Approve uses the same rules as typing a row in; a name already in the list updates that row (empty boxes keep the old values); if any row breaks a rule nothing is saved. The client's row is pre-ticked only if no client row is saved yet. One open read per client (a new read supersedes the old one).
  - **Tested by Claude: 22 / 22 pass** with a real Claude read of a mock Maps screenshot (fake businesses, an ad, street addresses, a cut-off row, Visual Vibe in the list): ad skipped, ranks 1–5 among unpaid, numbers + PlePer categories exact, client spotted, no address / phone saved, no dates invented, search text read; approve updated a typed row instead of doubling it; a rank clash saved nothing; discard path; stale id refused. 2 calls logged in seo_ai_log (~$0.008 each, no image). Test rows removed (0 competitors); the two test reads stay in seo_autofill as approved / rejected (log only). Review popup checked at 1300px and 390px dark.
- **How to test step 4**: GBP check › S1 › Read a screenshot → a real Google Maps screenshot (guest profile, PlePer on) → check the cost → Read it → the review popup opens: untick a row, fix a number, Add rows → rows appear; try again and Discard read. Remove test rows after.
- **4a is complete (steps 1–4)**, all on `phase-4`, not merged. **Next: 4b · GBP care** (Day 7): migration 0023 first, shown to Angel before building.
- Test client: **Visual Vibe Design** (`5c939f2631d6b31bdf4523e5d2f79a2c`): "Day 3" baseline (Nov 28) + the
  November 2026 report (Sent).
- 12 Vercel functions (Hobby cap). Migrations 0001–0022 run and checked.

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

| `49336fb` | **Step 4 · Claude hotspot drafts** (Sitemap + hotspots): "Draft with Claude" → pick up to 12 pages → cost first → one call (Sonnet 5.5, logged as "Hotspots") drafts title / meta / H1 / URL + opening / closing line + notes per page; saved as one "Ready to review" item; "Draft ready" in the list; draft panel on the page with its own counters + checks; "Use this draft" fills the form and **saving approves it**; "Skip draft". Live + keep pages keep their URL; new pages follow the structure (e.g. /web-design/bentonville-ar/); unknown trust signals stay [in brackets]. API: hotspots-estimate / -draft in `api/autofill` (300 s), hotspots-skip in `api/clusters` (still 12) |

**Step 4 tested by Claude on Visual Vibe: one real call for P2 + P3 (~20 s; estimate ~$0.04).** P2 (live, keep):
title "Northwest Arkansas Web Design & Development | [Trust signal]" (60), meta 153 ending "schedule a call today!",
URL kept /web-design. P3 (new): "/web-design/bentonville-ar/", notes ask to confirm local details. No invented
numbers, full state name in titles. Saving P2 approved its draft (1 left), skipping P3 closed the item (approved, 1
page saved from it), P3 unchanged, no redirect; P2 then put back to empty. Fix found: the 12-page limit now counts what
was asked for. Left in the data: the Claude log row ("Hotspots") and the closed draft item; pages unchanged.

| `4daa2cd` | **Step 5 · BrandScript** (Strategy Builder › Day 6 · Page briefs, sidebar item live): 16 fields A–P once per client ("N of 16 filled", Filled / Empty), Save, "Read aloud and confirmed" (a changed answer clears it), "Draft with Claude" (cost first) from Day 1 setup only; Claude's version shown under each field with "Use", plus "Use all" / "Skip draft"; saving approves the draft. Never the address, accounts or free-form notes; unknown facts = [bracketed questions]. API: brandscript* in `api/clusters`, brandscript-estimate / -draft in `api/autofill` (still 12) |

**Step 5 tested by Claude on Visual Vibe: 15 / 15 passed** (confirm before saving refused; unknown key ignored;
confirm; same answers keep "confirmed", a change clears it; 601-character answer refused; emptied again; estimate
~$0.03; real draft ~12 s with all 16 answers, no invented numbers, unknowns as [questions]; skip; second draft).
**Left for Angel: one Claude BrandScript draft open as "Ready to review"** on Page briefs (the BrandScript itself
is empty). Its notes point out that Visual Vibe's Day 1 kickoff answers (ideal client, what makes you different,
12-month success) are empty: filling them in Client setup and drafting again gives a much better BrandScript.

| `b5ca921` | **Step 6 · Page brief** (Day 6 · Page briefs, right card): page picker, **V1** (header + footer) / **V2** (all 11 StoryBrand sections, V2-only ones dimmed in V1), the 9 Day 5 brief fields (opportunity, why first, customer need, buying questions, proof, desired action, links from / to, missing inputs), hotspots summary, section status To write / Drafted / Done, "Draft with Claude" (cost first; V1 ~$0.03, V2 ~$0.07) from the BrandScript + the page's keywords / hotspots + other pages, Claude's version under each field with "Use" / "Use all" / "Skip draft", Save brief (approves the draft), **Copy for Elementor**. "Open page brief ›" on Sitemap + hotspots now works. Never a street address (city + areas served only). API: brief* in `api/clusters`, brief-estimate / -draft in `api/autofill` (still 12) |

**Step 6 tested by Claude on Visual Vibe (P2 Web Design hub): 12 / 12 passed** (empty start; bad page refused;
save keeps known fields / ignores junk / sets statuses; 3001-character section refused; emptied again; V2 estimate >
V1; real V1 draft ~19 s with only sections 1 + 11, all 9 brief fields, no invented numbers, [placeholders], notes end
with the rough-draft question). **Fix found while testing:** the footer asked for a "[Street address]": the prompt
now forbids any street address (city + areas served only) and the redraft has none. **Left for Angel: P2's V1 page
copy draft open as "Ready to review"** (plus the BrandScript draft from step 5).

## How to test step 6 (localhost, Visual Vibe › Strategy Builder › Day 6 · Page briefs)
1. Right card: P2 is picked with Claude's V1 draft waiting (banner + Claude's version under the header, footer and brief fields).
2. "Use all" (or "Use" per field) › edit › set a section to Done › Save brief › the draft banner goes.
3. Switch to V2 › the 9 extra sections open › "Draft with Claude" (cost first, ~$0.07) for the full copy.
4. "Copy for Elementor" › paste somewhere: the sections in order with their names.
5. Sitemap + hotspots › a page › "Open page brief ›" opens that page here.

## How to test step 5 (localhost, Visual Vibe › Strategy Builder › Day 6 · Page briefs)
1. Claude's draft is waiting: banner + Claude's version under each field (A–P) + Claude's notes / questions.
2. "Use" on a few fields (or "Use all") › edit › Save BrandScript › "N of 16 filled", the draft banner goes.
3. Tick "Read aloud and confirmed" › change any answer › Save › the tick clears.
4. Optional: fill the Day 1 kickoff answers in Client setup › "Draft again with Claude" (cost first).

## How to test step 4 (localhost, Visual Vibe › Strategy Builder › Day 5 · Sitemap + hotspots)
1. "Draft with Claude" (top right) › pages without hotspots are ticked › "Work out the cost" › "Draft N pages" (~20 s for 2 pages).
2. Banner "Claude's hotspots for N pages are ready to review"; those pages say "Draft ready".
3. Open one › the draft panel shows title / meta with counters, H1, URL, opening / closing, Claude's notes, checks.
4. "Use this draft" fills the form › fill or keep [Trust signal] › Save hotspots › the draft disappears (approved).
5. "Skip draft" on another › it disappears; the page doesn't change.
6. Settings › Claude usage shows "Hotspots".

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
