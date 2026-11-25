# Sam's Guide sheet import

**Status (Nov 25):** built (Keywords › Import → "Import a Sam's Guide tab"), migration 0011 ran. Angel's answers:
missing keywords are created "from Sheet"; Page 3 → Later only (no role), Rejected type → Rejected; "More areas" rows are
not keywords: one note on the client (client Notes field until Notes & links exists); KP "no data" → "No data";
"n/a" vs a number is a disagreement (nothing filled, listed); an existing matrix primary is kept unless "replace" is
ticked. One Sam's Guide import per client (delete it in Import history to import again).
Deleting that import removes the keywords it created (and their matrix / page links). Pages, cells, competitors and
the client note stay.

One-time import of a client's "Sam's Guide" tab (exported as CSV) into SEO Hub. Works for any client's sheet:
nothing about Visual Vibe or Anassa is in the code. **Dry run first; nothing is saved until Angel clicks Apply.**

## Where
Keywords › Import → new source **"Sam's Guide sheet"**. Same drop zone, same raw-file rule: the CSV is kept untouched
with the import (`seo_imports`, source `sheet`, report `sams_guide`).

## How the file is read (any client's sheet)
The tab is several "pages" stacked in one sheet, so the reader works by sections, not fixed cell positions:
1. Find each section by its title row ("Page 2", "3×3", "register", "Page 3", "keep for later", "Page 5", "Top 10",
   "competitors"). Unknown sections are skipped and listed.
2. In each section, find the header row (e.g. Service / A1 / A2 / A3, Keyword / Volume / KD, Page / Keyword).
3. Match row labels to the client's own categories (Home, S1–S3 by code or name) and columns to its areas
   (A1–A3 by code or name). Anything that doesn't match is shown as "not understood". It is never guessed.
4. Volumes stay exactly as written: KP ranges stay text ("10–100"), Semrush numbers stay numbers.

## What goes where
| Sheet part | SEO Hub | Rule |
|---|---|---|
| Page 2 register: cell keyword | `seo_matrix_cells` + `seo_matrix_keywords` (primary) | A cell that already has a different primary is a **conflict**: kept as is unless Angel ticks "replace" in the dry run |
| Page 2: close variants in the cell | same cell, kind `backup` | added, never removed |
| Page 2: Pending / N/A cells | cell `state` pending / n_a | N/A only where the area is N/A or the sheet says N/A |
| Page 2: Track checkboxes | `seo_keywords.track = true` | only switches on, never off |
| Page 5 Top 10 per page | `seo_pages` (matched by URL, then name; else new, status planned) + `seo_page_keywords` | add only; a keyword already on another page is a conflict (shown, not moved) |
| Page 3 questions | keyword status `later` (+ role FAQ only if it has no role) | only if the keyword is still `keep` |
| Page 3 rejected | keyword status `rejected` | only if still `keep` |
| Page 3 next pages + target keyword | planned page + its target keyword as primary | add only |
| Competitors C1–C4 | `seo_competitors` (code + **name only**) | no URLs, no addresses |
| Volumes in any section | keyword source rows (`volume_raw` as written); KP range fills `kp_volume` only where empty (marked "from Sheet") | never overwrites typed or exported numbers |

Keywords that aren't in the database yet are **created** (Sam: every Top-10 keyword must be in the database). They
show as "new keyword" in the dry run. Address-like keywords are held back, as on every import.

## Dry run screen
Per section: what was found, what would be added, what's already there (no change), conflicts (with a choice) and
lines not understood. Counts at the top. **Apply** only after Angel checks it. Every write goes through the server
(service key), same as other imports.

## Database (migration 0011, SQL shown before it runs)
- `seo_imports.report` check: add `sams_guide`.
- New `seo_competitors` (client, code C1–C4, name), RLS on, no policies.

## Needs before building
- The Visual Vibe Sam's Guide CSV in `test-data/` (git-ignored), to confirm the section titles and header rows.
- Angel's answers to the open questions (create missing keywords? questions → FAQ role? replace conflicts by default?).
