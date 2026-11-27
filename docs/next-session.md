# Next session (updated Nov 28, 2026, after each step)

Shareable status note: what changed, commit ids, what's pushed, what's waiting on Angel.

## Where we are
- **Phase 2a–2f done and live in Production** (`main` = merge `324d0f3`, Nov 28). Visual Vibe Design is the test
  client (`5c939f2631d6b31bdf4523e5d2f79a2c`): "Day 3" baseline (Nov 28) + the November 2026 report (Sent).
- Work goes on branch **`phase-2`**; pushing `phase-2` gives a Vercel Preview. `main` / Production only when Angel says.
- 12 Vercel functions (Hobby cap): new API work = a new action in an existing `api/<group>/[action].ts`.
- Migrations 0001–0020 run and checked.

## Done since Production (on `phase-2`, pushed)
| Commit | What |
|---|---|
| `463aa23` | Fixes: dates sent to Claude written in Manila time ("Nov 28, 2026") + "copy dates exactly"; a Sent report is read-only (server refuses next-action edits too) until "Reopen as draft"; report notes shown once on Results |
| `e346e3c` | Docs: 2g plan in `docs/phase-2-plan.md` |
| `be239db` | **2g step 1, report PDF**: print view `/clients/{site}/results/{report}/print` (team login required, no sidebar, A4, Vibe look, footer "Prepared by Visual Vibe Design · date" + "Page X of Y", approved notes only, never address / accounts / drafts / costs); "Download PDF" on the report. No new function. Tested by Angel ✓ |
| `63604bc` | 0020 SQL draft + migrations log + this note |
| `e7eda04` | **2g step 3, GBP screenshot server** (0020 run by Angel): estimate / read / approve / discard actions in `api/metrics` (still 12); image checked (type + first bytes, ≤ 3 MB), used for one Claude call, never stored or logged; only the period + 8 numbers come back; unclear = empty (never 0); period empty unless clearly shown with its year ("pick it"); saved as Ready to review in `seo_autofill` (Day 2 auto-fill never lists them); approve = normal GBP save. Tested by Claude with 2 synthetic screenshots (`test-data/gbp-screenshots/`): 8 numbers exact, directions empty, no-year period empty, supersede / discard / refusals OK, no fake address / phone saved, ~$0.006 per read |
| `a6bc5b0` | Next-session note after step 3 |
| `9dce8df` | **2g step 4, GBP review screen**: GBP card › "Read a screenshot" (pick PNG / JPG / WebP → browser shrinks to max 1600 px JPEG, kept in memory only → cost shown → "Read it"); "Ready to review" banner on the card (nothing counts yet); Review = screenshot beside the GBP form pre-filled, unread fields marked orange, unread period empty ("Pick the period yourself"); if the month was typed before, reviews / rating / newest review / note kept from what is saved; Approve numbers = normal GBP save; Discard (confirm); Later. Tested by Claude: review with and without a period, October merge keeps reviews 23 / rating 5, shrink makes a valid JPEG, text file / broken PNG refused |

Pushed: `phase-2` up to `9dce8df` + this note. Not on `main` yet.

## Waiting on Angel
1. **Test the GBP screenshot flow on localhost** with a real GBP › Performance screenshot (steps in the chat, also below), then say go or what to fix. Map grid from a screenshot is the only 2g step left and waits for the Whitespark sample.
2. Fix the November report notes date yourself (old approved text says "2026-11-27"): Reopen → redraft / edit →
   Approve → Mark as sent.
3. Whitespark map grid **sample screenshot / CSV** (map grid from a screenshot waits for it).
4. GBP API: not applied for yet (needs Google approval once applied).
5. Before Claude notes are used in Production: `ANTHROPIC_API_KEY` set in Vercel Production env.

## Next (2g, in order; stop after each step for Angel to check)
1. ~~Report PDF (print view)~~ done (`be239db`).
2. ~~Migration 0020~~ run by Angel, checked.
3. ~~GBP screenshot server~~ done (`e7eda04`), waiting for Angel's check.
4. ~~GBP review screen~~ done (`9dce8df`), waiting for Angel's test.
5. Map grid from a screenshot: after Angel's sample.

## How to test the GBP screenshot flow (localhost, Visual Vibe › Overview › GBP card)
1. "Read a screenshot" › pick a real GBP › Performance screenshot › cost shows › "Read it" (up to ~20 s).
2. Review opens: screenshot beside the form; numbers match the screenshot; anything unclear is orange and empty.
3. If the month wasn't readable: From / To are empty and marked; pick them.
4. If that month was typed before: reviews / rating / newest review are already filled from what's saved.
5. Approve numbers › the GBP card updates (views, actions, donut); Baseline "Ready to save" numbers follow.
6. Try Later (banner stays), Discard (banner goes, nothing changes), and a non-GBP image (refused, nothing saved).
7. Settings › Claude usage shows "GBP screenshot" calls.

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Never store or show a private address; no images saved from screenshots; secrets only in `.env.local` / Vercel.
- Supabase connector read-only; write SQL shown to Angel first, Angel runs it.
- Claude output is "Ready to review" until Angel approves; log every call.
- Ask before pushing `main` / Production. Stay at 12 Vercel functions.
- Light + dark mode, phone width, no emoji in the UI. Dates in the agency time zone (Asia/Manila).
- Update this note after every step (commit ids, pushed or not, waiting on Angel).
