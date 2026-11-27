# Next session (updated Nov 28, 2026)

Shareable status note for the reviewer Claude: what was built, commit ids, what's pushed, what to test, what's
waiting on Angel. Updated after every step.

## Where we are
- **Phase 2 is finished** (2a–2g). 2a–2f are live in Production (`main` = merge `324d0f3`, Nov 28). The 2g work and
  the fixes after it are on **`phase-2`** (pushed, Vercel Preview), **not on `main` yet** (needs Angel's OK).
- **Skipped for now:** Whitespark (map grid from a screenshot / CSV): no Whitespark account yet. The map grid stays
  optional and typed in by hand.
- **Next: Phase 3 · Pages** (sitemap, hotspots, site plan, page briefs; Sam Days 5–6). Plan first, no code.
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
1. OK to merge `phase-2` into `main` and push to Production (2g + fixes).
2. Fix the November report notes date yourself (old approved text says "2026-11-27").
3. Approve the Phase 3 plan (`docs/phase-3-plan.md`, coming next) before any Phase 3 code.
4. Later: Whitespark account (map grid from a screenshot / CSV); GBP API (not applied for yet).
5. `ANTHROPIC_API_KEY` set in Vercel Production env (Claude notes + GBP screenshots in Production).

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Never store or show a private address; no images saved from screenshots; secrets only in `.env.local` / Vercel.
- Supabase connector read-only; write SQL shown to Angel first, Angel runs it.
- Claude output is "Ready to review" until Angel approves; log every call.
- Ask before pushing `main` / Production. Stay at 12 Vercel functions.
- Light + dark mode, phone width, no emoji in the UI. Dates in the agency time zone (Asia/Manila).
- Update this note after every step (commit ids, pushed or not, waiting on Angel).
