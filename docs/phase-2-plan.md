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

## Build steps (each: plan OK → build → Angel tests → commit; stop at the end of phase 2)

| Step | What | Needs |
| --- | --- | --- |
| 2a | SQL 0016 + `api/metrics` route (health folded into auth) + Google token signing + "Connect Search Console + GA4" per client with Test | Decision 1, 5; service account set up |
| 2b | Daily pull (cron + Update numbers), Overview KPI tiles, Search performance, Website traffic, Top searches / pages, range switch | 2a |
| 2c | Semrush Position Tracking import (Uploads Day 3) → Keyword rankings, biggest moves, swapped-page flags | — |
| 2d | GBP typed form + Whitespark (typed now, CSV when the sample is in) → Overview cards | Decision 2, 3 |
| 2e | Baseline: save / start new, six cards with dates, Baseline vs now on Overview | 2b–2d |
| 2f | Results: monthly reports, every number vs baseline, wins, Claude report notes (reviewed), next actions | 2e |
| 2g (later) | GBP / map grid from a screenshot (Claude), report PDF | — |

Test data for 2c and 2e: Visual Vibe's real Position Tracking CSV (Nov 19–25, 27 keywords, uploaded Nov 26). Anassa's Nov 17–18 CSV stays in `test-data/anassa/` for when she is re-added.

**2c export facts (Visual Vibe file):** one position column per date (`<domain>_<YYYYMMDD>`, plus `_visibility`, `_type`, `_landing`), and `<domain>_difference` / `_visibility_difference` = change since the period start (`Period: 20261119 - 20261125`). So a 7-day export has ONE date column; Change and Biggest moves use the difference column (vs the period start). `_type` = `organic` / `local` (local pack, map pin) / `ai overview` (other SERP feature). No estimated-traffic column in this export. Search Volume, KD, CPC, Intents kept as text exactly as exported; read from the stored raw file (no extra table columns).

## SQL (0016, draft, not run)

New tables (RLS on, no policies, server only; every one cascades with the client):
`seo_google_links`, `seo_metric_daily`, `seo_metric_top`, `seo_rank_snapshots`, `seo_map_grids`,
`seo_map_grid_points`, `seo_gbp_snapshots`, `seo_baselines`, `seo_baseline_values`, `seo_reports`,
`seo_report_actions`. Plus `seo_imports`: report `position_tracking`, `whitespark_grid`; source `whitespark`.
No existing rows change. Full SQL in the migration file.
