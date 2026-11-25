# Next session (written Nov 26, 2026, end of day)

## Where we are
- **Phase 2a–2d are on `main` and pushed** (merge `7db7ee9`, Nov 26): Vercel deploys it to Production. Work continues
  on the `phase-2` branch; push to `phase-2` for a Preview, `main` only when Angel says.
  - 2a: connect Search Console + GA4 per client (service account, key in env only).
  - 2b: daily pull (Vercel cron 09:00 UTC, Production only) + "Update numbers"; Overview KPI tiles, Search performance
    chart (impressions pink / clicks purple), GA4 organic traffic, top searches / pages.
  - 2c: Semrush Position Tracking CSV (Overview › Keyword rankings › Upload CSV, or Baseline › Semrush). Change uses the
    export's `_difference` columns (vs the period start). Card: stacked bar, rings (visibility, local pack, AI
    overview), opportunities, badges with tooltips, no emoji (inline Lucide-shape icons in `src/components/ui/Icon.tsx`).
  - 2d: GBP typed monthly (+ optional Profile views breakdown → donut) and the Whitespark map grid typed in (area name
    only, digits refused). Sources popover + Baseline cards read both.
- Test client: **Visual Vibe Design** (only client). Anassa was deleted; re-add her later from her .xlsx.
- Migrations 0001–0016 run. **0017 (GBP views breakdown) written, NOT run yet**: Angel runs it in the SQL Editor, then
  mark it in `docs/migrations-log.md`. Until then the 4 breakdown boxes give a clear "needs 0017" message.
- 12 server functions (Vercel Hobby cap). New API work = a new action in an existing `api/<group>/[action].ts`.

## Start here
1. Read `CLAUDE.md`, `docs/BUILD-ROADMAP.md`, `docs/phase-2-plan.md`, `docs/migrations-log.md`.
2. Ask whether 0017 has run; test the GBP breakdown + donut on Visual Vibe.
3. Whitespark CSV import: waiting for Angel's sample export + screenshot.
4. Next step in the plan: **2e Baseline** (Save baseline / start a new one, six cards with dates, "Baseline vs now" on
   the Overview), then 2f Results.

## Rules to keep
- Works for any client; never hard-code a client. No fake numbers: empty = "—" / unknown, never 0.
- Supabase connector read-only; any write SQL shown first, Angel runs it.
- Light + dark mode, phone width, no emoji in the UI.
