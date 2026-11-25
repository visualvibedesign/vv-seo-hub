# Import a client Sheet (.xlsx): built Nov 26 (migration 0015)

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

## As built (Nov 26)
- **Reader:** `src/lib/xlsx.ts`, our own values-only reader on **fflate 0.8.3** (pinned; 0.8.2 failed `npm audit`). Unzips only the workbook, its relationships, the sheets and shared strings. Guards: 3 MB file, 30 MB unzipped (checked before unzipping), 40 tabs, 20,000 rows, 300 columns. Shared / inline / rich-text strings, XML entities, booleans, errors, formula results (cached value). Text stays text ("1K–10K"); numbers as plain text ("390.0" → "390").
- **The server reads the .xlsx** (not the browser): the dry run and Apply read the same bytes, nothing from the browser is trusted, and a 3 MB file still fits Vercel's 4.5 MB request limit.
- **API:** `sheet-preview` / `sheet-apply` in `api/imports/[action].ts` (no new server function: 12-function Hobby cap).
- **Clusters wins pages:** with a Clusters tab, Sam's Guide Top 10 adds no pages (option `pagesFromClusters`); differences are listed. The Clusters importer still refuses a client that already has pages.
- **Master DB from a Sheet** never replaces filled numbers (no "use the new numbers").
- **Competitors tab:** first table's first column, names only; the client itself skipped; matched ignoring capitals, punctuation and LLC / Inc / Co endings; new names get the next free code C5–C9 and are saved only if ticked.
- **Import history:** the .xlsx is one row (`client_sheet`); each applied tab is its own row with "From <file>". Deleting the .xlsx deletes its tab imports (keyword counts worked out over all of them). Pages from a Clusters tab stay; competitor names a Competitors tab added are removed.
- **Sam's Guide parser (Nov 26, any client):** a bare "Home" register row = Home-A1 (the home page row if the sheet also has Home-A1); "Home page …" = /; a Direct competitors table with a Domain column uses the domain as the name; merged Page 3 Type cells carry down; a type saying "(target keyword)" takes its keyword from the Use / why column; "N/A" / "None" are never keywords. Competitors match ignoring capitals, punctuation, https / www and LLC / Inc / Co (a domain by its name part). New competitor names fill free codes C1 → C9. Anassa: 37 → 0 lines not understood.
