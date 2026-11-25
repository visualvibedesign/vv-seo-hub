# Import a client Sheet (.xlsx): plan (not built)

An **extra** way in. It doesn't replace anything. These three paths all keep working:
1. **Raw exports** (Semrush / KP CSVs): the main path for new clients, no Sheet needed.
2. **Single-tab imports**: Sam's Guide, Clusters, Master Keyword Database.
3. **Whole Sheet (.xlsx)** (this plan): drop the Sheet once and SEO Hub runs the matching single-tab importers.

## Where
"Import a client Sheet (.xlsx)" on **Uploads** (Day 2) and **Keywords › Import**. Same component in both places.

## How it works
1. Angel downloads the Google Sheet as .xlsx (File › Download › Microsoft Excel) and drops it in.
2. The browser reads every tab into rows (values only, no formulas or formatting) and turns each tab into CSV text.
   The .xlsx file itself is uploaded **untouched** once.
3. Each tab is recognised by its **title and headers**, never by its tab name:

   | Recognised as | How (any client's Sheet) | Importer used |
   |---|---|---|
   | Master Keyword Database | header row has Keyword + Role + Service (today's `detectReport` rule) | existing `master_db` import |
   | Sam's Guide | a "Page 2" / "3×3 register" section with an ID + Primary keyword header | existing Sam's Guide import |
   | Clusters | the Clusters header row (page / primary / secondary / FAQ / priority) | existing `importClustersCsv` (today a script; gets an API) |
   | Baseline Rankings | Position-tracking style headers | **not used yet** (phase 2) |
   | Competitors | a C1–C4 / Name table | **not used yet** (Sam's Guide already brings C1–C4 names); see question 3 |
   | Anything else | — | **not used yet**, listed, never guessed |

4. **One combined dry run.** Per tab: what it was recognised as (or "not used yet"), found / new / already there /
   conflicts / not understood. A **cross-tab check** shows where two tabs disagree (e.g. a keyword on page A in
   Sam's Guide Top 10 but on page B in Clusters).
5. **One Apply.** Tabs are applied in a fixed order: Master DB (keywords + volumes) → Sam's Guide (matrix, pages,
   later, competitors) → Clusters (pages). Each tab is still its own import in Import history (deletable on its own),
   linked to the one .xlsx upload. If a tab fails, the ones before it stay applied and the failed one is undone; running
   it again skips what's already there.

## Same rules as every import
Volumes exactly as written (KP ranges stay text). No addresses (address-like keywords held back, competitor names
only). Nothing overwritten without a "replace" tick. The raw file is kept untouched. Each tab's own rules apply as they
do today (e.g. one Sam's Guide import per client). Works for any client: tab detection uses titles and headers only.

## Build pieces
- An .xlsx reader in the browser (one small library, pinned version; values only).
- `api/imports/sheet-preview` + `sheet-apply` that call the existing importers per tab (no second copy of their rules).
- An API for the Clusters importer (today it's only a script), so a single Clusters tab can be imported from the UI too.
- Migration 0012 (SQL shown first): `seo_imports.report` + `client_sheet` (the .xlsx upload) and
  `seo_imports.parent_import_id` (each tab import → the .xlsx it came from).

## Later (separate)
Paste a Google Sheet link instead of a file (Google Sheets API, read-only). Same detection and dry run.

## Angel's answers (Nov 25) — not built yet
- **Pages conflict:** the **Clusters** tab wins; what Sam's Guide Top 10 says differently is shown as a conflict.
- **Competitors tab:** imported, **names only** (brackets / address-like parts stripped, never stored).
- **Master DB tab:** OK to use. Sheet values **never overwrite real export volumes** (Semrush / KP from the raw
  exports); they only fill empty fields and are marked **"from Sheet"**. Check the current master_db rules against
  this before building.
- **Library:** OK if pinned, well-known, reads values only and passes `npm audit`. **Not** the old npm `xlsx`
  (SheetJS) package. Pick and audit it at build time, and show Angel the choice first.
- **Sample .xlsx:** Angel adds it to `test-data/` later. Build only after it's there.
