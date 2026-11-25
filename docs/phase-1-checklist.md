# Phase 1 wrap-up checklist

One full run on a **fresh test client**, start to finish, touching every feature built in phase 1 (redesign steps 1–7,
the imports, the two client areas and Settings). Tick each line on localhost. Anything that fails: note it under
**Found** at the bottom; it gets fixed before phase 1 is called done.

**Not run yet.** Written Nov 26, 2026.

## 0. Before you start

- [ ] On branch `main` (or `redesign`), clean tree, `npm run dev`, signed in with the team password.
- [ ] Migrations 0001–0015 all show "Yes (checked)" in `docs/migrations-log.md`.
- [ ] `ANTHROPIC_API_KEY` is set in `.env.local` (the Claude steps cost a few cents; each shows its estimate first).
- [ ] Test client: **"Test Wax Studio"**, site `https://test-wax-studio.example`, city Staten Island, NY. It reuses
      Anassa's test exports in `test-data/` (same city), so nothing real is touched. Never use a real client for this run.
- [ ] Files ready: `test-data/anassa/sheet-master-keyword-database.csv`, `test-data/anassa/sheet-clusters.csv`,
      `test-data/Anassa –SE0 (1).xlsx`, a Keyword Planner and a Semrush export (any you have for Staten Island waxing).

## 1. Hub (no client open)

- [ ] **Sidebar:** Overview · Clients · Templates · Settings, + Add client. No clients listed in the sidebar.
- [ ] **Overview (/):** every active client, where they are in Sam's days, "Needs you" items. No made-up numbers.
- [ ] **Clients (/clients):** list with day pill, counts, "Needs you"; search works; phone shows cards.
- [ ] **Add client wizard (/clients/new):**
  - [ ] Site URL → site id shown; a URL another client uses is refused.
  - [ ] Industry picker: pick "Waxing & beauty salon"; "+ New industry" adds one inline.
  - [ ] Services per category (Home, S1–S3), areas A1 (A2 / A3 or N/A). No address field anywhere.
  - [ ] Accounts start as Ready; Open goes to the tool; a per-client link can be pasted (https only; `user:pass@` refused).
  - [ ] Save → lands on the Strategy Builder guide.
- [ ] **Add clients from CSV (/clients/import):** a 3-row CSV (name, URL, city, state, industry): preview shows new /
      already there / refused rows; an address-like row is refused; nothing saved before "Add". (Delete the extra test
      clients afterwards only with Angel's OK.)

## 2. Client Overview area (/clients/{id})

- [ ] Opening the client lands on **Overview**: "Test Wax Studio, at a glance.", Sources row, Google not-connected
      card, Keyword rankings, Map grid, GBP, Baseline vs now, Accounts tiles, Notes. Every missing number is "—".
- [ ] **Accounts:** tiles open the tools; **Edit** → set one Pending + add a client link → **Done**; "x of 6 ready" updates.
- [ ] **Notes & links (/notes):**
  - [ ] Links: Website + account links + "+ Add link" (edit, remove; `http://` refused).
  - [ ] Notes: add a Note, a Decision (Day picker defaults to the current day; name remembered after reload),
        a Rule ticked "Agency rule" → shows on every client; delete it.
  - [ ] "Studio at 123 Main St" is refused (no addresses).
  - [ ] Text in Client setup → Notes shows as "Earlier notes"; **Move to notes** makes a Day 1 Note and empties the box.
- [ ] **Baseline (/baseline):** Day 3 checklist ticks and stays after reload; Mark Day 3 done; 6 source cards empty.
- [ ] **Results (/results):** Day 10 checklist; everything else an honest empty state.
- [ ] **Site check (/site-check):** shows "No pages in the plan yet" until Clusters has pages (re-check after §4).
- [ ] **Site connection (/site):** not-connected shell, "Generate SEO Hub key" disabled.
- [ ] **Strategy Builder →** button goes to the Strategy home.

## 3. Strategy Builder: Day 1 (/clients/{id}/strategy/…)

- [ ] **Strategy home:** Sam's days (Day 3 / Day 10 as thin "→ in Overview" lines), Services & areas.
- [ ] **Sidebar:** ← Client overview, switcher, Strategy home / guide / uploads, one group per day, current day open.
- [ ] **Client setup (/strategy/setup):** edit services, areas, out-of-scope words, neighbourhood words, brand words; Save
      → back to Strategy home. Cancel works.
- [ ] **Guide (/strategy/guide):** 7 days + 2 thin lines; ticking a task sticks; auto tasks tick themselves
      (services, areas, accounts); Mark day done jumps to the next Strategy day; "x of 7 days done".
- [ ] **Uploads · Day 1:** "What I need" list ticks from real data; paste the client's notes / Services page text →
      **Estimate** (cost shown) → **Run** → services (with a suggested category) and areas listed as Ready to review;
      approve some, reject one; the pasted text isn't stored. Kickoff answers aren't asked.

## 4. Strategy Builder: Day 2 (keywords)

- [ ] **Import (single CSV) (/strategy/keywords/import):**
  - [ ] Keyword Planner export → detected; KP ranges stay text ("10–100"); totals rows kept apart.
  - [ ] Semrush Keyword Magic / Overview / Gap → detected; numbers exactly as exported; blank = "—", never 0.
  - [ ] Duplicates skipped; different numbers listed with "use the new numbers"; address-like keywords held back.
  - [ ] More than 500 new rows shows the warning first.
  - [ ] Master Keyword Database CSV (`sheet-master-keyword-database.csv`): roles, services, KP "from Sheet" fill empties only.
  - [ ] **Import history:** each import with counts; download the raw file; **Delete this import** shows counts first.
- [ ] **Whole client Sheet (.xlsx)** (Uploads Day 2 or Import):
  - [ ] Choose `Anassa –SE0 (1).xlsx` → **red warning** "This Sheet looks like it's for Anassa Wax & Beauty, not Test
        Wax Studio"; Apply stays off until "Yes, it's for Test Wax Studio" is ticked.
  - [ ] Tabs recognised: Master DB, Sam's Guide, Clusters, Competitors; the other 4 "Not used yet".
  - [ ] Sam's Guide counts agree with the lists ("keep for later · to save", "not understood", "sections skipped").
  - [ ] Competitors: "(us)" row isn't saved (another business); new names unticked until you tick them (C1 → C9).
  - [ ] Tick, Apply → per-tab result; Import history shows the .xlsx row + one row per tab ("From …").
  - [ ] **Delete the .xlsx import:** confirm says its tab imports go too; afterwards the keywords it added, the matrix
        primaries / backups and cells Sam's Guide added, and the competitor names are gone. Then import it again.
  - [ ] A non-.xlsx or a file over 3 MB is refused before upload.
- [ ] **Uploads · Day 2 auto-fill:**
  - [ ] Plain-code rules: roles, services, near me / FAQ patterns, out-of-scope → Rejected, neighbourhoods → Later.
  - [ ] Claude tasks, each **Estimate → Run → review → approve / reject**: Intent, Leftover services, No-rule keywords
        (triage), 3×3 matrix, Page suggestions. Own-brand keywords never sent; near me never a page target; generic
        keywords only on hub pages.
  - [ ] Delete an import with open suggestions → the stale-suggestions banner / auto-retire.
- [ ] **Matrix (/strategy/keywords):** pick primaries and backups, N/A and Pending cells; a hand-picked primary gets the
      Primary role; replacing one shows the "replaced" note; **Export tracked list**.
- [ ] **Database (/strategy/keywords/database):** role pills with counts, Needs role, filters (status, missing data,
      source), sort, 100 per page, bulk bar, KP cell edit + bulk set, Track on/off, "Not a primary anywhere".
- [ ] **Clusters (/strategy/keywords/clusters):** pages per category, priority ("Medium (default)" when not set), suggested
      URL pill, one keyword on one page only.
- [ ] Back in **Overview › Site check**: the Clusters pages are listed with their keyword owner.

## 5. Templates (/templates)

- [ ] Industry dropdown filters the cards; generic falls back when an industry has no own version.
- [ ] Detail panel: what's in it, **Preview for Test Wax Studio**, Apply to a client (copy stored on the client).
- [ ] **+ New template** / Edit: name, type, Sam day, industry, variables `{service} {city} {st} {state} {brand}`, live preview.
- [ ] Editing a template doesn't change a client it was already applied to.

## 6. Settings (/settings)

- [ ] Claude usage: this month / all time / calls / tokens; per client (Test Wax Studio now listed), per month, per task.
- [ ] Industries: add one, rename it, client counts right; it appears in the Add client wizard and Templates.
- [ ] Automation card (phase 5). `/automation` lands here.

## 7. Everywhere

- [ ] **Old links redirect:** `/clients/{id}/edit`, `/guide`, `/uploads?day=day2`, `/keywords/database`, `/reports` land on their new pages.
- [ ] **Client switcher** keeps you on the same page (Matrix → the other client's Matrix).
- [ ] **Phone width (375px):** no sideways scroll on every page above; the Menu opens the sidebar.
- [ ] **Dark mode:** every page readable (toggle in the header).
- [ ] **Big client:** Visual Vibe (4,000+ keywords): Database, Matrix and imports load everything (no 1,000-row cut).
- [ ] **Rules hold:** no fake numbers anywhere; no street address stored; links only, never logins; Claude output
      always "Ready to review" until approved; exported numbers never changed.
- [ ] **Errors:** a broken panel shows its own error box, not a blank page.
- [ ] **Sign out** works; a signed-out link asks for the password and then goes to the page.

## 8. After the run

- [ ] Note what failed under **Found**.
- [ ] `npm run build`, typecheck, lint all pass.

## 9. Last step: delete Test Wax Studio

- [ ] **Client setup** of Test Wax Studio: the **Delete client** box says to archive first; **Delete client…** isn't offered yet.
- [ ] Set **Status: Archived** → Save. The client leaves the sidebar switcher (still opens from Clients, with its name in the sidebar).
- [ ] **Delete client…** shows what goes (keywords, imports + raw files, pages, notes, matrix, links, accounts, guide).
- [ ] The red button stays off until "Test Wax Studio" is typed exactly (a typo or wrong case keeps it off).
- [ ] Delete → back on Clients; Test Wax Studio is gone; its old address shows "This site isn't an SEO Hub client yet".
- [ ] Settings › Claude usage still counts its calls (as "Deleted client"); agency rules still show on other clients.
- [ ] Also delete the extra clients added from the bulk CSV in §1 the same way.

## Found

| # | Where | What happened | Fixed in |
| --- | --- | --- | --- |
| 1 | §1 Add client | City "Staten Island, NY" + State "NY" showed "Staten Island, NY, NY" | `d3c98a2`: a trailing ", <same state>" is dropped from the city and area names on save (Add client, Client setup, CSV) |
