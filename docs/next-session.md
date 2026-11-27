# Next session (written Nov 28, 2026)

## Where we are
- **Phase 2a–2f are done and live**: on `main` (merge `324d0f3`, Nov 28), deployed to Production by Vercel. Work
  continues on the `phase-2` branch; push `phase-2` for a Preview, `main` only when Angel says.
  - 2a–2d: Search Console + GA4 connected per client, daily pull, Overview numbers, Semrush Position Tracking CSV,
    GBP typed monthly (analytics card: actions by month, actions per 100 views from the typed actions, rating ring),
    map grid typed in.
  - 2e Baseline: save / fill missing / start new, past baselines, "N of 4 saved", Baseline vs now on the Overview.
    The map grid is **optional** until a client has a scan (Sources "N of 4", Day 3 auto-tick on required sources).
  - 2f Results: monthly reports from the month the baseline ends in (create with preview, refresh while draft,
    sent / reopen, up to 3 next actions), wins (code), every number vs baseline, clicks per month, Claude report
    notes (estimate → "Ready to review" → Angel approves; numbers check; logged as "Report notes").
  - Dates: server "today" checks allow the team's today (Manila is ahead of UTC); every saved-at date in the UI and
    in Claude prompts uses the agency time zone (Asia/Manila, `src/lib/agencyTime.ts`).
- **Test client: Visual Vibe Design** (`5c939f2631d6b31bdf4523e5d2f79a2c`), the only client. It has the "Day 3"
  baseline (Nov 28) and the November 2026 report. Anassa comes back later from her .xlsx.
- Migrations 0001–0019 run and checked (`docs/migrations-log.md`).
- 12 server functions (Vercel Hobby cap). New API work = a new action in an existing `api/<group>/[action].ts`.
- Claude notes in Production need `ANTHROPIC_API_KEY` in Vercel's Production env (check it's set).

## Waiting on
- **Whitespark CSV import**: waiting for Angel's sample export + screenshot. Until then the map grid is typed in.
- **GBP API**: not applied for yet; it needs Google's approval once applied. Until then GBP numbers are typed in
  monthly.

## Next: 2g
- **PDF report**: the monthly report as a PDF (the report view prints first; then a downloadable PDF).
- **GBP / map grid from a screenshot**: Claude reads a screenshot into the typed form, saved as "Ready to review"
  until Angel checks it (never saved straight in; numbers exactly as shown).
- Plan first (no code), show any SQL, then one step per message.

## Start here
1. Read `CLAUDE.md`, `docs/BUILD-ROADMAP.md`, `docs/phase-2-plan.md`, `docs/migrations-log.md`.
2. Ask whether the Whitespark sample or the GBP API approval has arrived.
3. Plan 2g.

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Supabase connector read-only; any write SQL shown first, Angel runs it.
- Claude drafts are never published without review; log every call.
- Light + dark mode, phone width, no emoji in the UI.
