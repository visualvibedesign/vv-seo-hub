# Next session (written Nov 26, 2026)

## Where we are
- **Phase 1 is built** and merged into `main` **locally** (not pushed, not deployed). Work continues on `redesign`.
- Phase 1 checklist (`docs/phase-1-checklist.md`): §1–§3 run and passed; §5–§8 tested earlier the same day; a quick §4
  (one KP CSV + the Anassa .xlsx with the wrong-client tick, Sam's Guide counts, delete undo) and §9 (archive + delete
  the test clients) are the last hand steps. Found #1–#5 all fixed (see the Found table).
- Migrations 0001–0015 run. **0016 (phase 2) is a draft, not run.**
- 12 server functions (Vercel Hobby cap). New API work = a new action in an existing `api/<group>/[action].ts`.

## Start here
1. Read `CLAUDE.md`, `docs/BUILD-ROADMAP.md`, `docs/phase-2-plan.md`, `docs/migrations-log.md`.
2. Phase 2 needs Angel's answers first (`docs/phase-2-plan.md` › Decisions): Google service account vs OAuth,
   a Whitespark sample, GBP typed, daily cron, folding `api/health.ts` into `api/auth` to stay at 12 functions.
3. Then show 0016 again, Angel runs it, build step 2a. One step per message, tell Angel what to test, commit locally.

## Client areas (since Nov 26)
- `/clients/{id}` = **Client Overview** (results + quick access): Overview, Baseline (Day 3), Results (Day 10 +
  monthly), Site check, Site connection, Notes & links.
- `/clients/{id}/strategy/…` = **Strategy Builder** (the work): Days 1, 2, 4, 5, 6, 7, 8–9. Old addresses redirect
  (`legacyClientPath` in `src/lib/clientSetup.ts`). Guide step numbers never change (they're stored).
- Hub: Overview · Clients · Templates · Settings (Industries, Claude usage, Automation).

## Standing rules (short)
- Never push, merge to a remote or deploy without Angel. Local commits only.
- SQL: show it, Angel runs it, log it in `docs/migrations-log.md`. Data fixes go through the app, not one-off SQL.
- Works for any client (Anassa = test data). No fake numbers, no addresses, links only (never logins).
- Claude output is "Ready to review" until approved; every call logged in `seo_ai_log`.
