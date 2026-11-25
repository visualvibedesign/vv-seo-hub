# SEO Hub: database migrations log

Every change to the database, in order. The SQL is in `supabase/migrations/`. All SEO Hub tables start with `seo_`,
have RLS on, and have no policies: only the server (service key) reads or writes them. HQ's tables are never touched.
Same Supabase project as Visual Vibe HQ.

**Run** = applied to the live database. Until go-live, Angel runs each file in the Supabase SQL Editor after reviewing
it. "Checked" = confirmed afterwards with a read-only query. Dates are when the file was written (2026). The day each
file was run wasn't recorded before this log existed.

## Migrations

| # | File | What it changes | Written | Run |
|---|---|---|---|---|
| 0001 | `0001_seo_phase1.sql` | Phase 1 tables: clients, service categories + services, areas A1–A3, account checklist, imports (raw file in Storage `seo-imports`), keywords + where each came from, 3×3 matrix (cells + keywords), pages + page keywords; RLS on all | Nov 20 | Yes (checked) |
| 0002 | `0002_seo_client_industry.sql` | `seo_clients.industry`: the industry picked in the Add client wizard | Nov 25 | Yes (checked) |
| 0003 | `0003_seo_guide_progress.sql` | `seo_guide_progress`: step-by-step guide progress per client (steps + ticked tasks) | Nov 25 | Yes (checked) |
| 0004 | `0004_seo_templates.sql` | Templates: `seo_templates`, `seo_template_items`, `seo_client_templates` (a copy stored per client) + 7 generic built-ins | Nov 25 | Yes (checked) |
| 0005 | `0005_seo_templates_waxing.sql` | Adds the "Waxing & beauty salon" version of the 7 templates (data only). Re-run guard added after it ran twice once (see fixes) | Nov 25 | Yes (checked: 7) |
| 0006 | `0006_seo_autofill.sql` | Auto-fill: `seo_autofill` (suggestions, Ready to review → approved / rejected) and `seo_ai_log` (every Claude call: task, client, tokens, cost, ok/error; never the prompt) | Nov 25 | Yes (checked) |
| 0007 | `0007_seo_autofill_kinds.sql` | Allows more auto-fill kinds (`services_ai`, `triage`) | Nov 25 | Yes (checked) |
| 0008 | `0008_seo_scope_words.sql` | Per client: `out_of_scope_words`, `neighbourhood_words`; auto-fill kind `scope` | Nov 25 | Yes (checked) |
| 0009 | `0009_seo_industries.sql` | `seo_industries` list (the fixed list becomes rows; new ones added from the app); clients/templates point at it; `seo_clients.brand_words` | Nov 25 | Yes (checked) |
| 0010 | `0010_seo_account_links.sql` | `seo_client_accounts.link` (a per-client link, https only, no logins); new account rows start Ready | Nov 25 | Yes (checked) |
| 0011 | `0011_seo_sams_guide.sql` | Import type `sams_guide`; `seo_competitors` (C1–C4, names only) | Nov 25 | Yes (checked) |
| 0012 | `0012_seo_page_priority_unset.sql` | `seo_pages.priority` can be empty ("not set yet", shown as "Medium (default)") | Nov 25 | Yes (checked) |
| 0013 | `0013_seo_page_url_suggested.sql` | `seo_pages.url_suggested`: a URL that is only a suggestion (from the template pattern), shown as "suggested" | Nov 25 | **No** |

## One-time data fixes (not migrations)

From now on, data problems are fixed in the app: the importer, an Approve step, or a repair action that shows a count
first. A SQL file is used only for a true one-time cleanup.

| File | What it did | Run |
|---|---|---|
| `fixes/0005-remove-second-copy.sql` | Removed the second copy of the waxing templates after 0005 ran twice | Yes |
| `fixes/anassa-accounts-ready.sql` | Set Anassa's 12 Pending accounts to Ready (before "Ready by default" existed) | Yes (UPDATE 12) |
| `fixes/visual-vibe-sams-guide-fixes.sql` | Visual Vibe after the first Sam's Guide import: Primary role on 7 matrix primaries; 9 imported pages' priority → not set. The importer now does both itself | Yes (checked) |

Read-only check, not a change: `checks/rls-check.sql` (RLS on for every `seo_` table, no policies).

## Go-live: one place owns all database migrations (Option A, Angel's decision, plan, not done)

SEO Hub and Visual Vibe HQ share one Supabase project. Plan: **one small repo owns every database change for both
apps**, with one Supabase CLI history, applied by CI. Nobody runs SQL by hand.

### Where things stand (read-only check, Nov 25)
| | HQ (`../visual-vibe-dashboard`) | SEO Hub |
|---|---|---|
| How it changes the DB | Hand-written `supabase/migrations/0001…0006`, each "run once in the SQL Editor" | Same: `0001…0012`, run by Angel in the SQL Editor |
| CLI / automation | None. CI (`checks.yml`) only runs typecheck, lint and page tests | None |
| Tables in the live DB | 15 (team_members, projects, tasks, daily_updates, snapshots, alerts, sod_drafts, build_plans, sync_logs, settings, task_status_changes, daily_digests, client_updates, wins, win_comments): **matches its 6 files** | 21 `seo_` tables: **matches its 12 files** |
| Outside any file | Storage bucket `wins` (only a comment in 0006) | Storage bucket `seo-imports` (made in the dashboard) |

Also in the live DB: RLS on for all 36 tables, **0 policies** (incl. storage), extensions `pgcrypto`,
`uuid-ossp`, `pg_stat_statements`, `supabase_vault`, one function (`seo_touch_updated_at`), no scheduled jobs, and **no
CLI history table** (`supabase_migrations.schema_migrations` doesn't exist).
**Clash:** both repos number their files `0001…`. The CLI needs every version to be unique, so the old files can't
simply be copied into one folder.

### The new home: a small private repo `vv-database`
```
vv-database/
  supabase/config.toml            linked to the shared project (no secrets in the repo)
  supabase/migrations/
    20261201000000_baseline_schema.sql        one file = the live schema today (both apps)
    20261201000001_baseline_storage.sql       the two buckets, re-runnable ("on conflict do nothing")
    2026MMDDhhmmss_hq_<what>.sql              new HQ changes
    2026MMDDhhmmss_seo_<what>.sql             new SEO Hub changes
  checks/                          safety checks CI runs (below)
  migrations-log.md                this log, moved here (both apps' rows)
```
Why a repo and not a folder inside one app: neither app owns the other, and the database deploy runs on its own
(before either app deploys).

### Moving to it without touching any data
1. **Freeze:** no SQL by hand while switching (minutes).
2. **Create `vv-database`** (Angel): `supabase init`, then `supabase link --project-ref <project>` with the database
   password kept locally / in CI secrets only.
3. **Baseline = read only.** `supabase db dump --schema public` writes the live schema (tables, checks, indexes, RLS,
   triggers, the function) to `…_baseline_schema.sql`. **No data rows** (it's a schema dump). Add the two storage
   buckets as a re-runnable file. Check that the dump has no `insert`/`copy` lines before committing.
4. **Mark the baseline as already applied, without running it:**
   `supabase migration repair --status applied 20261201000000 20261201000001`. This only creates the CLI's own
   history table and writes 2 rows to it. No HQ or SEO table is touched.
5. **Prove it matches:** `supabase migration list` (local = remote) and `supabase db diff` must show **no differences**.
   If it shows any, stop and look before going on.
6. **Archive the old files** in each app repo: move `supabase/migrations/*` to `supabase/migrations-archive/` with a
   README ("already applied, history only; new changes go to vv-database"). The SEO Hub side I can do. **HQ's side is
   done in HQ's own session** (this repo never changes HQ files).
7. **CLAUDE.md in both apps:** "database changes = a PR in vv-database", replacing "Angel runs it in the SQL Editor".

### How a change works after that
1. A PR in `vv-database` with one new file `…_seo_<what>.sql` or `…_hq_<what>.sql` + a row in the log.
2. CI on the PR: `supabase db push --dry-run` (shows exactly what would run) + safety checks:
   every `public` table has RLS on; no new policy unless the PR says why; `_seo_` files touch only `seo_` tables,
   `_hq_` files never touch `seo_` tables; `drop` / `delete` / `truncate` fail the check unless the file has an
   explicit "approved by Angel" line.
3. Angel reviews and merges → CI runs `supabase db push` (applies only new files, in order, stops at the first error).
4. **Then** the app change deploys (app PRs link the DB PR). App code keeps tolerating a missing column for one release,
   as SEO Hub does today, so the order can't break the live site.
5. Fixes are forward-only (a new file). Before go-live: check the plan's backups / point-in-time restore in Supabase.

### Who does what
- **Angel:** creates `vv-database`, adds CI secrets (`SUPABASE_ACCESS_TOKEN`, DB password), runs steps 2–5 once (or
  lets CI do 4–5 with the dry-run output shown first), merges DB PRs.
- **SEO Hub session (me):** baseline file, storage file, checks, CI workflow, moving SEO Hub's files to the archive,
  the log.
- **HQ session:** moving HQ's files to the archive + its CLAUDE.md line.
