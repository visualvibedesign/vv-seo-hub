# Next session (updated Nov 28, 2026, after each step)

Shareable status note: what changed, commit ids, what's pushed, what's waiting on Angel.

## Where we are
- **Phase 2a–2f done and live in Production** (`main` = merge `324d0f3`, Nov 28). Visual Vibe Design is the test
  client (`5c939f2631d6b31bdf4523e5d2f79a2c`): "Day 3" baseline (Nov 28) + the November 2026 report (Sent).
- Work goes on branch **`phase-2`**; pushing `phase-2` gives a Vercel Preview. `main` / Production only when Angel says.
- 12 Vercel functions (Hobby cap): new API work = a new action in an existing `api/<group>/[action].ts`.
- Migrations 0001–0019 run and checked. **0020 written, not run** (see "Waiting on Angel").

## Done since Production (on `phase-2`, pushed)
| Commit | What |
|---|---|
| `463aa23` | Fixes: dates sent to Claude written in Manila time ("Nov 28, 2026") + "copy dates exactly"; a Sent report is read-only (server refuses next-action edits too) until "Reopen as draft"; report notes shown once on Results |
| `e346e3c` | Docs: 2g plan in `docs/phase-2-plan.md` |
| `be239db` | **2g step 1, report PDF**: print view `/clients/{site}/results/{report}/print` (team login required, no sidebar, A4, Vibe look, footer "Prepared by Visual Vibe Design · date" + "Page X of Y", approved notes only, never address / accounts / drafts / costs); "Download PDF" on the report. No new function. Tested by Angel ✓ |
| (this note) | 0020 SQL draft + migrations log + this note |

Pushed: `phase-2` up to `be239db` + this note. Not on `main` yet.

## Waiting on Angel
1. **Run migration 0020** in the Supabase SQL Editor (`supabase/migrations/0020_seo_autofill_screenshot_kinds.sql`),
   then say so. It only widens `seo_autofill`'s allowed kinds (+ `gbp_screenshot`, `map_screenshot`); 0 rows change.
   The GBP screenshot server is NOT built until 0020 is confirmed.
2. Fix the November report notes date yourself (old approved text says "2026-11-27"): Reopen → redraft / edit →
   Approve → Mark as sent.
3. Whitespark map grid **sample screenshot / CSV** (map grid from a screenshot waits for it).
4. GBP API: not applied for yet (needs Google approval once applied).
5. Before Claude notes are used in Production: `ANTHROPIC_API_KEY` set in Vercel Production env.

## Next (2g, in order; stop after each step for Angel to check)
1. ~~Report PDF (print view)~~ done (`be239db`).
2. Migration 0020 → waiting for Angel to run it.
3. GBP screenshot server: actions `shot-estimate` / `shot-read` / `shot-approve` / `shot-discard` in
   `api/metrics/[action].ts`; Claude task `gbp_screenshot` (Sonnet 5.5, effort low); estimate first; image shrunk in
   the browser, sent once, **never stored** (only the numbers read); period left empty if Claude can't read it clearly
   (Angel picks it in the review form, never a guess); empty fields, never 0; saved as "Ready to review" in
   `seo_autofill`; counts nowhere until approved.
4. GBP review screen: pre-filled GBP form + screenshot beside it (browser memory only), unread fields marked,
   Approve (normal GBP save) / Discard.
5. Map grid from a screenshot: after Angel's sample.

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Never store or show a private address; no images saved from screenshots; secrets only in `.env.local` / Vercel.
- Supabase connector read-only; write SQL shown to Angel first, Angel runs it.
- Claude output is "Ready to review" until Angel approves; log every call.
- Ask before pushing `main` / Production. Stay at 12 Vercel functions.
- Light + dark mode, phone width, no emoji in the UI. Dates in the agency time zone (Asia/Manila).
- Update this note after every step (commit ids, pushed or not, waiting on Angel).
