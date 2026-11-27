# Phase 2 plan · Google numbers, rankings, map grid, GBP → Overview, Baseline, Results

Plan only (Nov 26, 2026). Nothing built. SQL draft: `supabase/migrations/0016_seo_phase2.sql` (**not run**).
Site connection (Vibe SEO check-ins, Site check data) stays out: it comes with the plugin after phase 4.

## Goal

Fill the client Overview area (designs in `docs/design/overview/`) with **real numbers only**:

| Page | Fills with |
| --- | --- |
| **Overview** | Sources row (connected / last pull / last CSV), KPI tiles (impressions, clicks, CTR, avg position + sparkline + baseline), Search performance chart, Website traffic (GA4 organic), Top searches, Top pages, Keyword rankings (buckets + biggest moves), Map grid, GBP, Baseline vs now. Range: 28 days / 3 months / 12 months. |
| **Baseline (Day 3)** | The six source cards saved with their exact dates (Semrush CSV, Search Console, GA4, GBP, Whitespark; Site check stays "comes with Site check"). "Save baseline" freezes a copy; "Start a new baseline" keeps the old one. |
| **Results (Day 10 + monthly)** | Wins, every number vs baseline per month, clicks per month, Day 10 check (already live), report notes (Claude draft → approved), monthly reports (draft / sent). |

Rules: numbers exactly as the source gives them; a missing day / month is "—", never 0; Semrush stays in Semrush (CSV only);
no address anywhere (map grid centre = a town / area name); Claude drafts are reviewed before saving.

## Decisions for Angel

> **Answered Nov 26:** 1 service account (key in env vars only) · 2 Whitespark typed for now, sample CSV later · 3 GBP typed monthly · 4 one daily Vercel cron + "Update numbers" · 5 health folded into auth (done in 2a).

1. **Google access: one agency service account (recommended) or OAuth?**
   - **Service account (recommended):** a Google Cloud service account (free). Its email is added once per client as a
     user on the client's Search Console property and a Viewer on the GA4 property. Its key lives only in Vercel / `.env.local`
     (`GOOGLE_SERVICE_ACCOUNT_JSON`), never in the database. No consent screen, no tokens to store or refresh. We sign
     the token request ourselves with Node's `crypto` (no Google library to add).
   - **OAuth (agency Google login):** "Connect Google" button, a refresh token stored encrypted in the database, an
     OAuth consent screen to set up. More moving parts; only needed if a client won't add a service-account user.
2. **Whitespark:** send a sample CSV export (and a screenshot) of one scan, so the import matches the real columns.
   Until then the map grid can be **typed** (5×5 ranks) or left empty.
3. **GBP numbers:** typed in once a month (form: views, calls, directions, website clicks, reviews, rating, newest
   review date). Reading a screenshot with Claude can come later (2g).
4. **Daily pull:** a Vercel cron once a day (Hobby allows daily) + an "Update numbers" button. OK?
5. **Server functions (12 max):** the Google + metrics actions need one new route `api/metrics/[action].ts`. To stay
   at 12: move `api/health.ts` into `api/auth/[action].ts` as action `health`, and keep `/api/health` working with a
   rewrite in `vercel.json` (rewrites aren't functions). OK?

## How each source works

### Search Console + GA4 (free Google APIs)
- **Per client** (Overview › "Connect Search Console + GA4"): pick / paste the GSC property (`sc-domain:example.com` or
  `https://example.com/`) and the GA4 property id (`properties/123456`). A **Test** button pulls 7 days and shows the
  result before saving. Stored in `seo_google_links` (property ids only).
- **Search Console** (`searchanalytics.query`, scope `webmasters.readonly`): daily clicks, impressions, CTR, position
  for the last 16 months on the first pull, then the last 10 days on each daily pull (Google revises recent days).
  Top queries and top pages per period. Optional **query words** per client (city + service words) for the
  "local searches" view, as the phases doc asks.
- **GA4** (Data API `runReport`, scope `analytics.readonly`): daily sessions, engaged sessions, users, key events and
  average engagement time, filtered to `sessionDefaultChannelGroup = Organic Search`.
- **Same date-range length** everywhere: "last 28 days vs the 28 days before", "3 months", "12 months"; baseline vs
  now compares periods of the same length.
- Stored daily in `seo_metric_daily` (one row per client / source / metric / day), exactly as Google returns them.

### Semrush Position Tracking CSV (Baseline + rankings)
- Uploads Day 3 → "Position Tracking export". Format checked on Anassa's file: a metadata header (`Report type:
  position_tracking_rankings_overview`, `Period: 20261117 - 20261118`), then `Keyword` + per-date columns
  `<domain>_<YYYYMMDD>` (position), `_visibility`, `_type`, `_landing`, plus `_difference`, CPC, volume, KD.
- One row per keyword per date in `seo_rank_snapshots`: position exactly as exported (`-` / empty = not in the top 100,
  stored as empty, never 0), landing URL, visibility. Matched to the client's keywords by keyword key; unmatched ones
  are listed (not created).
- **Swapped page:** landing URL ≠ the page that owns the keyword (Clusters) → flagged on Overview and Results.
- The raw CSV is kept untouched in Import history, like every import.

### Whitespark map grid
- CSV (columns from Angel's sample) or typed 5×5. Stored as `seo_map_grids` + `seo_map_grid_points` (rank per point,
  empty = not found). Avg rank and "in top 3" worked out from the points. Drawn as the 5×5 circles (green 1–3,
  amber 4–7, red 8+, grey = not found).

### GBP (typed)
- Overview › GBP › "Add this month's numbers": a period (from / to) + the numbers. `seo_gbp_snapshots`.

**2d built (Nov 26, no SQL: tables from 0016):** GBP form (period defaults to last month; same period replaces; empty = unknown, never 0; rating 1–5; typed-by remembered per browser) and a typed map grid (keyword, date, 5×5 or 7×7, spacing, area name only: anything with a digit is refused, so no street address or ZIP). Grid colours: green 1–3, amber 4–7, red 8+, grey = not found / 20+. Avg rank = average over the points where the business was found (Whitespark's own ARP comes with the CSV). Both feed Overview cards, the Sources popover and the Baseline cards; each has "All months / All scans" with Remove (confirm). Actions live in `api/metrics/[action].ts` (`local`, `gbp-save`, `gbp-delete`, `map-save`, `map-delete`): still 12 functions. Whitespark CSV import waits for Angel's sample.

## Baseline (Day 3)
- **Save baseline** copies the current numbers of each source **with their own dates** into `seo_baselines` +
  `seo_baseline_values` (a frozen copy: re-pulling Google later never changes it). Each source card shows "Saved · date"
  or "Missing". The Day 3 checklist (already live) ticks "starting numbers" automatically once 4 of 5 are saved.
- **Start a new baseline** keeps the old one (history) and marks the new one current.
- **Decided Nov 28:** the map grid (Whitespark) is **optional** until a client has a scan. Required = Search Console,
  GA4, Semrush, GBP (+ Whitespark once scanned). Sources reads "N of 4" (map grid "Optional · not set up"), the
  Baseline pill "N of 4 saved", and the Day 3 "Starting numbers" task ticks itself when every required source is in
  the current baseline.
- **2e step 1 built (Nov 28):** `server/services/baselineService.ts` (live numbers per source with their own dates:
  GSC + GA4 = last 28 days to each one's last pulled day, same totals as the Overview; Semrush = latest CSV; GBP =
  latest period; map grid = latest scan), saved via `seo_save_baseline()` (0018; `new` / `fill`, a saved source is never
  overwritten). Actions in `api/metrics/[action].ts`: `baseline`, `baseline-history`, `baseline-save` (still 12).

## Results (Day 10 + monthly)
- **Monthly report** per client per month (`seo_reports`): a frozen copy of the month's numbers vs the baseline,
  status Draft → Sent, sent date. The Day 10 review is the first one.
- **Every number vs baseline** table: baseline + each month + change (same-length periods).
- **Wins:** the three biggest improvements, worked out by code (no Claude).
- **Notes for the report:** Claude drafts from the numbers (what moved, likely why, next 30 days) → Angel edits and
  approves; only the approved text is saved in the report. Logged in `seo_ai_log` like every call.
- **Up to 3 next actions** (`seo_report_actions`: type, text, owner, due date, done).
- **PDF:** later (2g); the report page prints cleanly first.
- **Decided Nov 28:** a report's Search Console + GA4 numbers = the 28 days ending on the month's last pulled day
  (the month's end, or the last pulled day if earlier), same length as the baseline. Titled "November 2026 report"
  with the exact dates under it. Semrush = latest CSV dated in the month; GBP = the month's typed period; map grid =
  latest scan in the month. Nothing for the month = "missing" with the reason (never 0 or an older month).
- **2f step 1 built (Nov 28):** `server/services/reportService.ts` + migration 0019. Actions in `api/metrics`:
  `reports` (list + last 6 months + clicks per month), `report`, `report-preview` (read only), `report-create`,
  `report-refresh` (draft only), `report-status` (draft / sent + sent date), `report-actions` (up to 3). Still 12.
- **Decided Nov 28:** reports start from the month the current baseline ends in (Visual Vibe: November 2026). Earlier
  months aren't offered and the server refuses them.
- **2f step 2 built (Nov 28):** Results page: Create report (month + preview of dates / missing), wins (code, latest
  report vs its baseline), every number vs baseline (last 3 reports), clicks per month, reports list, report view
  (?report=id) with Refresh / Mark as sent / Reopen and up to 3 next actions.
- **2f step 3 built (Nov 28):** report notes. "Draft with Claude" (task `report_notes`, Sonnet 5.5, effort medium,
  estimate first, logged in seo_ai_log) gets the frozen numbers + dates, missing, next actions, last approved notes,
  business name / city / services / areas (no address). Saved as "Ready to review" (notes_draft); Angel edits and
  approves (only approved text = notes). Numbers check (src/lib/notesCheck.ts) flags any number not in the report
  (never removes). Sent reports lock their notes. Actions: `report-notes-estimate`, `-draft`, `-approve`, `-discard`.

## Build steps (each: plan OK → build → Angel tests → commit; stop at the end of phase 2)

| Step | What | Needs |
| --- | --- | --- |
| 2a | SQL 0016 + `api/metrics` route (health folded into auth) + Google token signing + "Connect Search Console + GA4" per client with Test | Decision 1, 5; service account set up |
| 2b | Daily pull (cron + Update numbers), Overview KPI tiles, Search performance, Website traffic, Top searches / pages, range switch | 2a |
| 2c | Semrush Position Tracking import (Uploads Day 3) → Keyword rankings, biggest moves, swapped-page flags | — |
| 2d | GBP typed form + Whitespark (typed now, CSV when the sample is in) → Overview cards | Decision 2, 3 |
| 2e | Baseline: save / start new, six cards with dates, Baseline vs now on Overview (**built Nov 28**: Visual Vibe "Day 3" saved; map grid optional until a scan) | 2b–2d |
| 2f | Results: monthly reports, every number vs baseline, wins, Claude report notes (reviewed), next actions | 2e |
| 2g | Report PDF (print view), GBP numbers from a screenshot (Claude, Ready to review), map grid from a screenshot (optional). **Planned Nov 28, waiting for OK** (see "2g plan" below) | 2f |

Test data for 2c and 2e: Visual Vibe's real Position Tracking CSV (Nov 19–25, 27 keywords, uploaded Nov 26). Anassa's Nov 17–18 CSV stays in `test-data/anassa/` for when she is re-added.

**2c export facts (Visual Vibe file):** one position column per date (`<domain>_<YYYYMMDD>`, plus `_visibility`, `_type`, `_landing`), and `<domain>_difference` / `_visibility_difference` = change since the period start (`Period: 20261119 - 20261125`). So a 7-day export has ONE date column; Change and Biggest moves use the difference column (vs the period start). `_type` = `organic` / `local` (local pack, map pin) / `ai overview` (other SERP feature). No estimated-traffic column in this export. Search Volume, KD, CPC, Intents kept as text exactly as exported; read from the stored raw file (no extra table columns).

## SQL (0016, draft, not run)

New tables (RLS on, no policies, server only; every one cascades with the client):
`seo_google_links`, `seo_metric_daily`, `seo_metric_top`, `seo_rank_snapshots`, `seo_map_grids`,
`seo_map_grid_points`, `seo_gbp_snapshots`, `seo_baselines`, `seo_baseline_values`, `seo_reports`,
`seo_report_actions`. Plus `seo_imports`: report `position_tracking`, `whitespark_grid`; source `whitespark`.
No existing rows change. Full SQL in the migration file.

## 2g plan (Nov 28) · waiting for Angel's OK, no code yet

### a) Report PDF

**Way: a print view + the browser's "Save as PDF"** (not a server PDF).
- New page `/clients/{site id}/results/{report id}/print`: the report laid out for A4, light mode always, no sidebar,
  Vibe look (Fraunces headings with the purple italic word, Inter body, lavender table header, lime / green change
  pills). "Download PDF" on the report view opens it in a new tab and opens the print dialog once fonts are loaded.
- Content, in order: header (Visual Vibe Design · client name · site domain), title ("November 2026 report") with the
  period (Search Console window) and "vs Day 3 baseline, saved Nov 28, 2026"; baseline vs this month table (value +
  dates + change, same rows and rules as the report view); "Not available this month" reasons; wins (code, same as
  Results); approved notes only (a draft or no notes = the section is left out and the screen warns before printing);
  next actions (status, category, owner, due). Footer: "Prepared by Visual Vibe Design · {sent date or today}" and
  page numbers (CSS `@page` margin boxes).
- Never printed: the client's private address, account logins / links, internal Notes & links, Claude costs, Claude
  drafts, anything from other clients. Uses only what the report already holds (frozen numbers, approved notes,
  actions) + client name / domain.
- **Vercel functions: none added (stays at 12)**. The page is a front-end route; it reads the existing `report` action.
- Why not a server PDF: a headless-browser PDF (Chromium) is too big for a Vercel Hobby function; a JS PDF library
  (`@react-pdf/renderer`) would fit inside `api/metrics` (still 12) but needs its own second layout, bundled font
  files and makes every metrics call load it. Print CSS keeps one layout and the exact Vibe fonts. If we later need
  to email PDFs automatically, revisit then.

### b) GBP numbers from a screenshot (+ map grid, optional)

- GBP card › "Read a screenshot": pick a GBP › Performance screenshot (PNG / JPG). The browser shrinks it (max
  1600 px wide, JPEG) so the upload stays under Vercel's 4.5 MB request limit. **The image is never stored** (a GBP
  screenshot can show the address / phone): it goes to Claude once and only the read numbers are saved.
- Estimate first, like the notes: model, tokens in (free count, image included), tokens out, about $ (expect
  ~$0.01–0.02 per image on Sonnet 5.5). Then "Read it".
- Claude (task `gbp_screenshot`, Sonnet 5.5, effort low, structured output) returns only: the period shown (from /
  to, or empty if not visible), profile views, the 4-way views breakdown, calls, website clicks, directions, plus a
  list of fields it couldn't read. Rules: copy numbers exactly as shown, empty when not visible (never 0, never a
  guess), ignore names / addresses / phone numbers. Logged in `seo_ai_log`.
- Saved as **"Ready to review"** (one open read per client; a new read supersedes the old one). It counts nowhere
  (Overview, Baseline, reports) until approved. Review = the existing GBP form, pre-filled, with the screenshot shown
  beside it while it's still in the browser, fields Claude couldn't read marked. Approve = saved through the normal GBP
  save (same checks), the read marked approved; Discard = marked rejected.
- Map grid (optional, same plumbing): task `map_screenshot` reads a Whitespark grid screenshot into the typed grid
  form (keyword, date, size 5×5 / 7×7, spacing, rank per point; area name only, digits refused as today). Review +
  approve through the existing "Type in a scan" form.
- Vercel functions: none added. New actions in `api/metrics/[action].ts`: `shot-estimate`, `shot-read`,
  `shot-approve`, `shot-discard`; open reads come back with `local`.

### c) Migration, files, test steps, order

**Migration 0020 (draft, not written yet):** reuse `seo_autofill` (it already has "Ready to review", one open item
per client + kind, `superseded`, the Claude log link). Only its kind list grows. `step` = 2 (Day 3, the numbers step).
```sql
alter table public.seo_autofill drop constraint if exists seo_autofill_kind_check;
alter table public.seo_autofill add constraint seo_autofill_kind_check check (kind in (
  'setup_services', 'setup_areas', 'setup_kickoff', 'roles', 'services', 'services_ai', 'intent', 'triage', 'scope',
  'matrix', 'clusters', 'gbp_screenshot', 'map_screenshot'));
```
Rows affected: 0 (it only widens the allowed list; the 15 existing rows all use kinds already in it). The PDF needs
no migration.

**Files**
- PDF: `src/pages/client/ReportPrintPage.tsx` (new), `src/App.tsx` (route), print styles (`@media print`, `@page`) in
  `src/styles/`, `src/components/results/ReportView.tsx` ("Download PDF"), shared rows / wins from `src/lib/baseline.ts`.
- Screenshots: `server/services/screenshotService.ts` (new: estimate, read, approve, discard), `api/metrics/[action].ts`,
  `src/lib/aiModels.ts` (2 tasks), `src/lib/imageShrink.ts` (new), `src/types/seo.ts`, `src/lib/api.ts`,
  `src/hooks/useLocal.ts`, `src/components/overview/LocalCards.tsx` (buttons + review), migration 0020.

**Test steps on localhost (Visual Vibe)**
1. PDF: open the November 2026 report › Download PDF › A4 preview: header, period, table with dates, missing reason,
   wins line, approved notes, 3 actions, footer page numbers; no address / accounts; light mode even when the app is
   dark; phone "Share › Print" works.
2. GBP screenshot: read a real GBP Performance screenshot › estimate shows › read › "Ready to review" with the
   numbers in the form next to the image › fix one number › Approve › the GBP card + Sources update; Settings shows
   the call. Discard path; a blurry / wrong screenshot gives empty fields, not zeros.
3. Map grid screenshot (if built): same flow into the grid form.

**Order:** 1) PDF print view (no SQL). 2) 0020 + screenshot server (GBP). 3) GBP review UI. 4) Map grid screenshot
(optional, after your OK and a sample screenshot).
