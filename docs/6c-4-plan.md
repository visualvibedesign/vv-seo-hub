# 6c-4 plan: Claude page suggestions + Day 1 from pasted text (built Nov 25)

> Update: kickoff answers are skipped at our agency. Day 1 auto-fill suggests services, areas and scope / brand words
> only; the kickoff list was removed from the app (the `setup_kickoff` kind stays allowed, unused).

Same rules as 6c-1 to 6c-3: cost first and Run only on click, results Ready to review in `seo_autofill`, approve item by
item, nothing overwritten, every call logged. Claude never invents facts or changes exported numbers. Works for any
client. **No migration needed**: the kinds `clusters`, `setup_services`, `setup_areas` and `setup_kickoff` are
already allowed.

## 6c-4a · Page (cluster) suggestions · Sonnet · Uploads → Day 2 "Clusters · Claude"
**Sends:** the client's categories and service names, area names, matrix cells (primary + backups), existing pages
(name, category, their keywords), and Keep keywords that are on **no page** yet (text, role, service, Semrush, KP).
Capped at 300 keywords per run ("first 300 of N").
**Asks for:**
1. **A page for each matrix cell that has no page yet**: name, category, primary = the cell's primary, secondaries
   from its backups + fitting keywords, FAQ keywords (FAQ role) that belong on it.
2. **Leftover keywords** → which existing or suggested page they fit, as secondary or FAQ, or "none".
**Checks in code (not trusted to Claude):** a keyword only on one page; only ids that were sent; never touches a page's
existing keywords; the primary must be the cell's primary.
**Approve:**
- a suggested page → a **planned** page (no URL; priority "not set") with its keywords
- a leftover keyword → added to that page, only if it's still on no page
- reject → nothing
Approve all doesn't include it.

## 6c-4b · Day 1 from pasted text · Sonnet · Uploads → Day 1 "Fill from notes"
A box where you paste **kickoff notes or the client's Services page text**. Only what you paste for that run is sent,
nothing else about the client except its current category / service / area names (so Claude doesn't repeat them).
**Asks for, each with the exact sentence it came from:**
- **Services** grouped as Home / S1–S3 (a suggested category name each), plus services the text says they *don't*
  offer → suggested **out-of-scope words**
- **Areas** (cities served) → A1–A3 suggestions; neighbourhoods → suggested **neighbourhood words**
- **Kickoff answers:** 12-month success, USP, ideal client
- **Brand words** (the business name as written)

**Checks in code:**
- every suggestion must quote a sentence that's really in the pasted text, otherwise it's dropped (no invented facts)
- anything that looks like a street address is dropped, never stored
- phone numbers and emails are dropped

**Approve:** fills **only empty** fields: adds services that don't exist yet (you pick or confirm the category),
fills A2/A3 only if N/A, kickoff answers only if empty, and adds words to the scope / brand lists.
**The pasted text itself isn't stored.** Only the suggestions and the usual log row (tokens, cost) are kept.

## Order
6c-4a first (uses the matrix you're testing now), then 6c-4b. Each: build → you test → commit.

## Questions
1. Pasted text not stored (only suggestions): OK?
2. Day 1 services: Claude suggests the category; you confirm per service on Approve. Or always pick yourself?
3. Suggested pages: no URL (planned), or a suggested URL from the template's URL pattern (e.g. `/web-design-bentonville-ar/`)?
