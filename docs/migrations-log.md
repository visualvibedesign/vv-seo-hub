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

## One-time data fixes (not migrations)

From now on, data problems are fixed in the app: the importer, an Approve step, or a repair action that shows a count
first. A SQL file is used only for a true one-time cleanup.

| File | What it did | Run |
|---|---|---|
| `fixes/0005-remove-second-copy.sql` | Removed the second copy of the waxing templates after 0005 ran twice | Yes |
| `fixes/anassa-accounts-ready.sql` | Set Anassa's 12 Pending accounts to Ready (before "Ready by default" existed) | Yes (UPDATE 12) |
| `fixes/visual-vibe-sams-guide-fixes.sql` | Visual Vibe after the first Sam's Guide import: Primary role on 7 matrix primaries; 9 imported pages' priority → not set. The importer now does both itself | Yes (checked) |

Read-only check, not a change: `checks/rls-check.sql` (RLS on for every `seo_` table, no policies).

## Before go-live: migrations applied automatically (plan, not done)

Goal: nobody runs SQL by hand. A migration is reviewed in a pull request and applied by the deploy step.

1. **Supabase CLI in the repo.** Add the `supabase` CLI as a pinned dev dependency, then `supabase link` to the SEO Hub
   project. The database password lives in CI secrets, never in the repo.
2. **Baseline what's already there.** 0001–0012 were run by hand, and the CLI's history table
   (`supabase_migrations.schema_migrations`) doesn't exist yet. Mark them as applied without running them again:
   `supabase migration repair --status applied 0001 … 0012`. Check with `supabase migration list`.
3. **Shared project with HQ.** The CLI keeps **one** migration history per database. Before step 2, agree with
   Alexia / the HQ repo: either one repo owns all migrations, or both use distinct version numbers (e.g. SEO Hub keeps
   `0001…` while HQ uses timestamps) and neither repo ever runs `db reset`. **Blocker to settle first.**
4. **Deploy step.** On merge to `main`, CI runs `supabase db push`, which applies only new files in order and stops on
   the first error, before the Vercel deploy. Pull requests run `supabase db push --dry-run` so the review shows
   what would run.
5. **Safety checks in CI after each push:** every `seo_` table has RLS on and no policies (`checks/rls-check.sql`), and
   no migration touches a non-`seo_` table (a simple file check that fails the build).
6. **Rules stay:** migrations are re-runnable where possible (`if not exists`), there are no destructive changes
   without Angel's OK, and each new file gets a row in this log in the same pull request.
