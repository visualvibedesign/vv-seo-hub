# Phase 4 plan · GBP check, GBP care, links (Sam Days 4, 7, 8–9)

Written Nov 29, 2026 on branch `phase-4` (from `phase-3` = `main` + docs). **Plan only: no code until Angel approves.**
Designs: `docs/design/GBP.png`, `GBPCare.png`, `Links.png`. Playbook: `docs/local-seo-playbook.md` › Days 4, 7, 8, 9.
Scope list: `docs/seo-hub-phases.md` › Phase 4. Test client: Visual Vibe Design.

## What exists already
- Strategy Builder sidebar has **Day 4 · GBP check**, **Day 7 · GBP care**, **Days 8–9 · Links** as "P4" placeholders.
- `seo_competitors` = the 4 Backlink Gap competitors C1–C4 from Sam's Guide (Visual Vibe has 4). **Not** the Maps
  competitors per service: those get their own table.
- Templates already in Templates: "GBP 13-week posts", "Review request email", "Citation waves" (+ salon versions).
- GBP numbers are typed monthly / read from a screenshot (Phase 2). No GBP API (not applied for). No Semrush API.
- Claude pattern: estimate first → one call → "Ready to review" → Angel edits + saves (= approves); logged.

## Split into three parts (each: migration → server → screen, stop after each step)

### 4a · GBP check (Day 4) · `strategy/gbp` · design GBP.png
- **Competitors per service** (S1 / S2 / S3 tabs): the Maps search used (e.g. "web design rogers ar", Chrome guest
  profile, ads skipped), date checked, then rows: rank, business name, primary category, additional categories,
  reviews, rating, newest review date. The client's own row pinned at the bottom (from the GBP numbers when typed).
  Pills: **top-10 average reviews** (total ÷ results counted), **competitor pace** (reviews / month from the newest
  dates, a ballpark), **goal** ("beat the pace with a monthly review ask of N"). Code works out the numbers; empty =
  "—", never 0.
- **Claude reads a Maps / Pleper screenshot** into the competitor rows (optional, same as the GBP screenshot: image
  never stored, unclear = empty, "Ready to review", approve fills the rows).
- **Whitespark top map factors** checklist for the client: #1 primary category, #3 keywords in the real business
  name, #5 open at search time (hours + holiday hours), #7 address showing (hidden for service-area / home
  businesses), #8 additional categories, #9 reviews with text, #11 review recency, #15 website name + phone match
  GBP. Each: To check / OK / Needs work / N/A + a short note.
- **Business details** (public only, must match the website): name, website, phone, email, primary + additional
  categories, service areas, hours (+ holiday hours note), socials, booking link, review link, description (750
  characters, no em dashes, ends with a call to action), "address shown on GBP?" **yes / no only**, date checked,
  "waiting on Google" + check-again date. **The private address is never stored**: there is no field for it, and
  the box under the card says so (design).
- **Profile check** (Day 4 worksheet 4): name / hours, categories, description, attributes, main services,
  phone / website / booking tested, photos / logo (720×720) / cover (1024×576): ticks + note.

### 4b · GBP care (Day 7) · `strategy/gbp-care` · design GBPCare.png
- **Products**: one card per service page (from the sitemap, P-codes), name, 2–3 sentence description (Claude drafts
  from the page brief / hotspots; reviewed), "image 720×720 ready", links to the **service page, not Home**; status
  Not added / Added / Page not live yet (from the page's status).
- **Reviews**: target this round (default 5, editable) + progress "0 / 5"; **review email** from the client's Review
  email template, filled with the client's name, service + city and review link (Copy review email); **tracker**:
  customer ref (short, no names / emails / phones), date asked, channel (email / text / in person / other), result
  (waiting / reviewed / no reply / declined), one follow-up date. Nothing else is kept (CLAUDE.md).
- **Post calendar**: 13 weeks from a start date. "Draft 13 weeks" (Claude, from the GBP posts template, live pages,
  the BrandScript and last quarter's posts so nothing repeats): week, date, topic, takeaway, body, CTA "Learn more"
  → a real page with UTM (utm_source=google, utm_medium=organic, utm_campaign=gbp-post), image need (1200×900).
  Status Not drafted / Drafted / Approved / Scheduled / Live. Drafts first 3 + plan for the rest is fine; all
  reviewed.
- **Care routine** (weekly / monthly reminders) as a small checklist with "next post batch" date.

### 4c · Links (Days 8–9) · `strategy/links` · design Links.png (+ Day 9 tabs)
- **Citations · 3 waves**: BrightLocal list (CSV import, or paste) → rows numbered in list order → **wave by row:
  1, 4, 7… / 2, 5, 8… / 3, 6, 9…** (plain code), YP network row in each wave, who does it (BrightLocal / me),
  domain authority as exported, verification needed, status Planned / Submitted / Live, wave start (default week 6
  of the client) + "takes ~30–40 days". Totals: planned, live, wave 1 start.
- **Backlink Gap** (Semrush CSV, root domain, up to 4 competitors C1–C4): keeps the "matches" count (e.g. 4 of 5),
  Authority Score as exported, **hides AS below 3 by default**, flags domains already on the citation waves so
  nothing is added twice; "Add to opportunities".
- **Opportunities** (Day 9): exact page, domain, found via (R / S / C / Cit / Sp), Authority Score, competitor
  matches, why it fits, how to get on it (claim / apply / contact / join), cost, next action + date, and **This
  week / Sent / Approved / Live as separate ticks** (Live only after the link is clicked and checked). Filters by
  those ticks.
- **Local + premier**: premier relationships (chamber, trade groups, certifications, referral partners, vendors,
  organizations → page or route in → next action), editorial idea, **sponsorships** (2–3: event, tier + cost, why,
  sponsor page public / on main site / stays up, shows name / logo / profile / link).
- **SERP searches** log: search run (customer-style + lister-style) → promising opportunities.
- **Pace + authority**: weekly link pace per client (2–10) vs links live this week; **authority checks typed in** at
  month 3 / 6 / 9 / 12 (Authority Score, referring domains, backlinks).

## Rules (all parts)
- Never store or show the private address, on any table or listing. GBP: "address shown?" yes / no only.
- Review tracker keeps only ref, date, channel, result (+ follow-up date).
- Numbers exactly as exported / typed; missing = "—", never 0. No GBP API, no Semrush API (CSV + typed).
- Claude output is "Ready to review"; nothing changes until Angel saves; every call logged; no invented facts.
- Sent / Approved / Live stay separate. Check the wave list before adding a citation as an opportunity.
- Still 12 Vercel functions: new actions in existing `api/*/[action].ts` files (Claude calls in `api/autofill`).

## Migrations (one per part, shown before each part is built; none written yet)
- **0022 (4a)**: `seo_map_competitors` (client, service S1–S3, rank, name, primary category, additional
  categories, reviews, rating, newest review, is_client, note), `seo_map_searches` (client + service: search used,
  checked on, results counted), `seo_gbp_factors` (client + factor: status, note), `seo_gbp_profile` (client: public
  fields above, `address_shown boolean`, no address column), profile check ticks; autofill kind
  `map_competitors_screenshot`. RLS on every table.
- **0023 (4b)**: `seo_gbp_products`, `seo_review_requests` (ref ≤ 40, date, channel, result, follow-up),
  `seo_gbp_posts` (quarter start, week 1–13, topic, takeaway, body, CTA, page, UTM URL, image need, status, date),
  client review target; autofill kinds `gbp_products`, `gbp_posts`.
- **0024 (4c)**: `seo_links` (citations: row, wave, domain, authority, verification, owner, status, live URL),
  `seo_link_opportunities`, `seo_premier_relationships`, `seo_sponsorships`, `seo_serp_searches`,
  `seo_authority_checks`, client weekly link pace; `seo_imports` reports `brightlocal_citations`, `backlink_gap`.

## Decisions for Angel
1. **Order**: 4a GBP check → 4b GBP care → 4c Links? *Recommended* (follows Sam's days).
2. **CSV samples** for 4c: a BrightLocal Citation Builder export and a Semrush Backlink Gap export. Until they come,
   citations / gap rows can be pasted or typed (same as Whitespark). OK?
3. **Maps / Pleper screenshot → competitors (Claude)**: build it in 4a (last step), or later? *Recommended: in 4a*,
   it saves the most typing.
4. **Review target per round**: default 5 (Sam), editable per client. OK?

## Test steps (each part, on Visual Vibe; Claude tests first, then the reviewer)
- 4a: add S1 search + 5 competitors → averages / pace / goal show; factors set; business details saved (no address
  field anywhere); a Maps screenshot read fills rows for review.
- 4b: products from the sitemap pages (service pages only, link to the page); review email copies with the client's
  name / city / link; tracker refuses an email or phone in the ref; Claude drafts 13 weeks with real pages + UTM.
- 4c: a citation list of 9 rows → waves 1/4/7, 2/5/8, 3/6/9; gap CSV hides AS < 3 and flags wave duplicates;
  opportunity ticks stay separate; authority check typed in.
