# Local SEO Playbook (Sam's Rank Yourself method + our agency tools)

Standard local SEO process for every client site. Based on Sam's 10-Day Rank Yourself SEO Challenge (Local SEO Academy) guides, worksheets (samsarsten.com/10day-worksheet1 … worksheet9) and videos, adjusted to how our agency works. First used on Anassa Wax & Beauty, Nov 2026. Day 10 will be added when it comes.

**Videos (Days 1–9):** [Day 1](https://www.youtube.com/watch?v=euNC0aNL_Iw) · [Day 2](https://www.youtube.com/watch?v=P_5S33738yE) · [Day 3](https://www.youtube.com/watch?v=A6sGzviQfiM) · [Day 4](https://www.youtube.com/watch?v=oIAxdwHHYRY) · [Day 5](https://www.youtube.com/watch?v=jv-m3bOy-Ks) · [Day 6](https://www.youtube.com/watch?v=DUMr4S5CIm0) · [Day 7](https://www.youtube.com/watch?v=0YeOuk54oaU) · [Day 8](https://www.youtube.com/watch?v=WIdB0gpFm5I) · [Day 9](https://www.youtube.com/watch?v=2B2uumZN7ak). Transcripts: YouTube "...more" → "Show transcript".

**Order of work:** Day 1 what matters + kickoff → Day 2 keywords → Day 3 tracking + baseline → Day 4 Google Business Profile → Day 5 ideal sitemap + SEO hotspots → Day 6 build/improve one page → Day 7 GBP care (services/products, reviews, posts) → Day 8 citations (BrightLocal, 3 waves) → Day 9 backlinks (opportunity list) → (Day 10 compare to baseline).

**Example deliverable (Anassa, use as the template):** Google Sheet "Anassa – Master Keyword Database": https://docs.google.com/spreadsheets/d/1-2eOHF19IGriVokfAhJ_1Gdh7DHhjjOcBRzfCoxYMxA/edit (tabs: Sam's Guide → Master Keyword Database → Clusters → Competitors → On-page fixes → Baseline Rankings).

**Agency differences from Sam's suggestions**
- Rank tracking: **Semrush Position Tracking**, not SerpFox.
- Tracking target: **United States (national)**, per the agency lead. Local view comes from the geogrid.

---

## Day 1 · What actually matters in local SEO

**The search results page (SERP), top to bottom**
- Local service ads (pay per call; some industries only) → sponsored ads (1–5% of clicks) → AI overview (sometimes) → **map pack** (about half of searchers stop here) → organic blue links.
- Fewer than ~10% of searchers stop at the ads. What we work on: map pack (GBP), organic (website), AI visibility.

**The big three:** Google Business Profile, website, authority (backlinks). Based on the Whitespark ranking factors (see checklist below).
- **GBP:** right primary category (#1), proximity (can't control), keywords in the real business name, a **steady stream of reviews** (rating, count, recency — the factor we control most), then ongoing GBP management. Posting is low on the list: about one post a week is enough. Geotagging photos doesn't help.
- **Website:** a **dedicated page for each service** (#1 organic) + mention **where** you do it (#2). SEO = relevancy (what you do + where) + authority (local and industry backlinks). Keep GBP and website in sync; check the title tag of the page GBP links to.
- **AI visibility:** GEO (ChatGPT, Claude, etc.) is still small; AEO (Google AI overviews / AI mode) is growing. Businesses that win the map pack and organic usually win AI overviews too.
- **Home-based / service-area businesses** can have a GBP: register the home address and hide it. Hidden address costs a little, but still ranks.
- Map pack reach is mostly the main city (area 1); other cities are won with website pages.
- **3×3 matrix:** a page for each top-3 service in each top-3 area puts you ahead of most competitors.

**Kickoff call questions (ask the client)**
1. "After 12 months working with us, how will you know this was a success?" (Expect: rank higher, more leads/business. Rankings are what we control and report first.)
2. Why would someone choose you over a competitor? (unique selling point)
3. Who is the ideal client and what do they need?
4. Top 3 services (most money or most wanted) and top 3 areas (population + where the client actually wants work / where the money is).

**Account inventory:** domain/DNS, hosting, website platform, GBP, Search Console, Analytics, SEO tools (rank tracker, geogrid), plus extras (Cloudflare, Clarity, Google Ads, AI visibility tool).

---

## Day 2 · Keyword research

**Extra tips from the video**
- "Do SEO, not guess-SEO": every page target needs search data behind it.
- Tools: Semrush (free = 10 searches a day, top 10 results), Google Keyword Planner (free through a Google Ads account, no campaign needed), Ahrefs free keyword tool (quick check of which wording has more volume), and a paid AI plan for sorting.
- **Steps per service:**
  1. Semrush Keyword Magic Tool: type the plain service ("web design"), national level, screenshot the top 10. Then add include "near" to see local-intent wording ("web design near me").
  2. Exclude junk/brand terms (e.g. brand names, products) to clean the list.
  3. Keyword Planner: search the plain service, set location = area 1, sort by volume, download CSV. Smaller nearby cities usually follow the same pattern, so area 1 is often enough.
  4. Keyword Planner often misses city keywords ("web design bend oregon"): check those in Semrush (search "service city").
- Give AI all screenshots + CSVs + the worksheet prompt (S1–S3, A1–A3, ideal client) → it builds the 3×3 register with a primary keyword per cell. Then ask for less duplication across the 9 pages, with volume next to each.
- **Rule of thumb:** the primary keyword is usually **service + city + state** (sometimes city + service, service + city, or "near me").
- Low volume (10–30) is still worth it: one lead can be a big job. Real volume shows up once keywords are tracked (rank tracker, then Search Console).
- Top-left cell (top service, top city) = most volume and most competition. Smaller cells can win first.
- Web design / SEO are extra competitive (out-of-town agencies target every city); most local trades only compete locally.
- **Keyword Gap** (paid Semrush): you + 4 competitors' ranking pages → look at "untapped" keywords, filter by city, then check the SEO titles of the page-1 results.
- Similar cities (e.g. North Myrtle Beach vs Myrtle Beach): start with both pages, watch the tracker, merge if one page covers both.
- Homework: a 3×3 register with at least one primary keyword per cell + backups, ready for tracking.

### Set the targets first (Day 1)
- **S1–S3 = the client's 3 main service categories** (Anassa: Brazilian & Bikini, Face & Brows, Body Waxing — the same 3 sections as the home page). Each category gets one main keyword + page, plus backup keywords for its other services.
- **Home row:** the general keyword (e.g. "waxing staten island") that the home page targets. Label it "Home", not "W".
- **Areas A1–A3.** If the client targets one area only (Anassa: Staten Island as a whole), A2 and A3 are N/A. No neighborhoods unless the client wants them.
- Check the live site first (page sitemap): which service, FAQ and First Timers pages already exist, and which are not live yet.

### Steps
1. **Seed list** from the client's Services page: each service × city / "near me" / price / questions.
2. **Keyword Planner**, location = the client's area: *Discover new keywords* (10 seeds at a time) and *Get search volume and forecasts* (Historical metrics), download CSVs.
3. **Semrush** (paid, US database): Keyword Magic Tool per service with "Include keywords" = city (click **Update metrics** if a row has no data, then export); bulk Keyword Overview for keywords still missing volume.
4. **Master Keyword Database tab** (Google Sheets table, purple header): Keyword, Role (Primary teal / Secondary light blue / FAQ orange / Near me light gray), Service, Intent (Semrush-like light colors), Keyword Planner vol (range as shown), Semrush vol, KD %, CPC. Keep every relevant keyword (that's why it's long); only remove off-topic terms.
5. **Sam's Guide tab** (first tab): Page 1 Semrush seeds; Page 2 3×3 register (+ Home row, Track checkboxes); direct competitors; Page 3 keep for later (questions, rejected, next pages + target keyword); Page 4 Keyword Gap; Page 5 top 10 per page; Page 6 checklist. Every Top-10 keyword must also be in the database.
6. **Keyword Gap** (Semrush): competitors' *local* pages, filter by city. Label numbers as **Google positions** (lower = better; 1–10 = page 1). Note which client page Google shows (swapped pages = cannibalization).
7. **Clusters tab:** one row per page: Category, Page, Priority (High / Medium / Low, colored), Primary keyword, Volume · KD, Secondary keywords ("- " bullets), FAQ / content ideas ("- " bullets), Why (start with "Live page" / "Not live yet"). Match existing pages (e.g. separate /faqs/ and /first-timers/); no duplicate keywords across pages. Add a small color-coded "Why there's a Priority column" table under it. No suggested titles here.

### Sam's rules
- Keep raw files untouched. Record volume exactly as shown (KP ranges, not the 0/50/500 stand-ins). Never add, round or average.
- Keep sources and cities separate. Remove only exact duplicates; group close variants.
- Every primary keyword traces back to a source. Generic "near me" terms stay in the database but aren't page targets.
- N/A for pairs you don't serve; Pending when the page or data isn't ready.

### Report tips
- The Sheet is a report for the agency lead: don't name her in it, avoid worksheet wording ("you noticed", "my register"), define KP / Semrush / KD.
- Never put the client's private address in the Sheet or in tracking.
- ClickUp comments: link each tab with its `#gid=` link; list tools used; explain why the database is long.

---

## Day 3 · Tools and baseline ("Track before you touch anything")

**Why:** no "vibes reporting". If we can't show results, we can't sell SEO. Your own site is your first case study. Save the starting numbers now so Day 10 (and monthly reports) can prove results.

**TLC: what SEO should lead to**
| Step | Meaning | Measure in |
|---|---|---|
| Ranking | Every service × every city, not one keyword | Rank tracker + geogrid |
| Impressions | Seen on Google | Search Console, GBP views |
| Traffic | Visits the site | Google Analytics (GA4) |
| Leads | Forms and calls | GBP calls, form tracking |
| Clients | Money | Client's business |

- We directly affect rankings; the rest follows. Biggest map pack lever: a steady stream of good reviews.
- Two Rs: relationships and results. Keep humans in the loop.

**Tools**
- **Rank tracker: Semrush Position Tracking** (agency standard). Sam suggests SerpFox, but we don't use it.
- Geogrid (map pack by location): Whitespark Local Ranking Grids (free trial, ~$10/mo) or Local Falcon. Shows the actual rank at each grid point.
- Google Search Console (Domain property, DNS TXT verification; data takes 2–3 days).
- Google Analytics GA4 (install with WPCode or Elementor Custom Code; goal "generate leads").
- GBP access (Manager invite, or agency account group code).
- Microsoft Clarity (free heatmaps + session recordings).
- Domain/DNS access for TXT-record verification.
- Privacy check before enabling Analytics/Clarity: privacy policy, cookie policy, consent banner (CookieYes, Complianz, Cookiebot, Termageddon). Not legal advice.

**Rank tracking setup (Semrush Position Tracking)**
1. Projects → client domain → Position Tracking.
2. Target: **United States (national)**, Google. Location-level is an optional upgrade (needs a paid multi-target plan).
3. Business name (for local pack), ~10 keywords (top keyword per page from the Day 2 register, tagged S1/S2/S3/Home), up to 4 competitors, weekly email.
4. Don't trust the first 24 hours; record the baseline the next day.
5. Export: top of the page → **Export** (next to PDF/Share) → CSV. Gives position + landing page for each keyword. Fill the Ranking page column to spot pages Google swaps.

**Starting numbers to save** (same date-range length every time; write exact dates)
- Search Console → Performance → Search results: total impressions, total clicks.
- GA4 → Reports → Acquisition → Traffic acquisition: sessions (+ Organic Search row).
- GBP → Performance: views (Overview), calls and website clicks (Engagement tab).
- Re-check after 30 days with the same settings (shift the range by one month).

**More from the video (setup walk-through)**
- **Rank tracking:** track both national and by location if the plan allows. Star the primary keywords so they sit at the top for reports.
- **Keyword budget:** with ~100 keywords and ~20 pages ≈ 5 per page, but give the top-left pages up to 10 and the far cells 2–3. Base set per page: service + city + state, service near me, plain service.
- **Geogrid (Whitespark):** only for the top 1–3 services in the main city. For a service-area business, drag the pin to the center of the main city. 5×5 grid, ~2-mile spacing, untick points in empty areas. 1 credit per point per keyword (3 keywords × 18 points = 54 credits). Run an instant scan first and recalibrate.
- **Search Console:** add a **Domain** property, copy the TXT record, add it in the host's DNS zone editor, then verify. Data takes 2–3 days.
- **GA4:** create account + property + web stream; goal "Generate leads". Add the tag via Elementor Custom Code or WPCode. Test the install.
- **GBP access:** owner adds you as **Manager**, or use the GBP agency account group code. Then use Performance for reporting.
- **Clarity:** free, heatmaps + session recordings. Watch recordings monthly at first to find bottlenecks.
- **Baseline:** wait a day for the tracker to settle; for new Search Console/GA, go back after 2–4 days and record an early day as the baseline. Screenshots in a folder are fine.
- **Change log:** log every change (ClickUp task or a sheet).

**Worksheet (4 pages)**
1. Tool setup: rank tracker, geogrid, Search Console, GA4, GBP, UX tool → Ready / Pending / N/A + next action.
2. My keywords: keyword, target area, reported volume/range (exactly as shown), first rank + date, Day 10 rank + date, notes. Not found = current visibility. Replacing a keyword = new row with its own first-reading date.
3. Starting numbers: geogrid ×3 keywords, Search Console impressions + clicks, Analytics sessions, GBP views, calls, website clicks → starting reading + date range, Day 10 reading. Mark processing data as Pending.
4. What I did: day/date + one line per useful action (or link the ClickUp tasks).

---

## Day 4 · Audit and optimize the Google Business Profile

**Order Sam follows**
1. Re-check the Day 3 baseline: pick the keywords with demand but weak rank as the ones to push.
2. Competitor audit in Google Maps with Pleper: categories first (#1 and #8 factors), then reviews (count + how recent). Posting is ~#140, low priority.
3. Write down your business details (NAP) in one place, then make the website footer/contact match GBP.
4. Optimize = fill out everything in Edit profile, one section at a time.
5. Reviews: reply to all, set a recurring review-ask task.

**Tips**
- Look at **each top result's own categories**, not just the category Maps shows for that search.
- Skip ads when counting reviews. Ballpark is fine (e.g. "top 10 average ≈ 30").
- **Review velocity:** sort by newest and check the last 3–5 dates. If competitors get ~2 per quarter, a monthly task of 2–3 beats them. Fast-job industries need 5–10+ a month.
- If local competitors are weak at SEO, benchmark against the next bigger town.
- Categories: only what the business really does. Changing the primary category can trigger re-verification or suspension: tell the client first.
- Description: written for humans, 750 characters, keywords naturally, ends with a call to action, no em dashes.
- Fill in: name (legal/DBA, no stuffing), categories, description, opening date, phone, website, social profiles, service areas, hours + **special/holiday hours**, attributes, logo 720×720, cover 1024×576, real photos, **booking link**, review link + QR code.
- Products and services: wait until the ideal sitemap is done (Day 5), then add one product per service page (Day 7). Delete services Google added automatically.
- Check your own rankings in a Chrome **guest profile**, not incognito.
- Effort split: GBP ~5–10%, authority ~5–10%, website 70–80%.

**Business details (NAP):** name, phone, email, website, primary + secondary categories, address shown or hidden, service areas, hours, social profiles. Must match the website and later citations. Private side (hidden address, verification contacts) is never published.

**Worksheet**
1. Competitor benchmark per S1–S3: Maps search used, competitor categories, results counted, competitor average reviews, my reviews (count + newest date), one decision.
2. Review counts working space (10 boxes per service → total, average).
3. Business details: public vs private. When a fact changes: update this page first, log it, then update listings.
4. Profile check: name/address/hours, categories, description, attributes, main services, phone/website/booking tested, photos/logo/cover. Waiting on Google + check-again date.
5. Service-content queue: S1–S3 wording to refine + page (for Day 7). Review link.

---

## Day 5 · Ideal sitemap ("Give each priority search a destination")

**Tips**
- Fill the 3×3 from real tracker data: reorder S1–S3 by search volume; areas by population.
- No volume for a small town? Edit tracked keywords early (week 1): drop low-value variants, test "[service] near me" tracked by location.
- One page ≈ one keyword cluster. For each keyword decide the owner: **homepage, service page or location page**. Search it to see which page Google shows; if it flips between pages, that's cannibalization (de-optimize the other page).
- **3 site structures:**
  - **Service first** (most common): /service/ = service in main city, children /service/city/. Homepage targets an umbrella term.
  - **Location first** (physical locations / contractors): /city/ hubs + /city/service/. Homepage then targets mostly the brand.
  - **Flat / mixed:** /service-city/ off the homepage. OK to start with if few pages; redirect later.
- Counties and ZIP codes rarely have volume. Regional names sometimes do: check.
- State abbreviation in URLs, full state name in SEO titles.
- Not every cell needs a page. Small nearby towns can be covered in a service-area section. Quick wins often come from smaller cells.
- Mark each page **Existing · keep / Existing · improve / Proposed · new**.
- Draft SEO hotspots with AI → 60–70% done, then edit by hand.

**Worksheet (5 pages)**
1. My matrix (+ why these are the priority service/area; expansion list).
2. Page list: ID, page name/URL, status (keep / improve / new), primary keyword + related terms, useful info it adds. Site structure choice + one sentence why.
3. Sitemap sketch: homepage → service/location pages → supporting pages (About, Contact, FAQ, reviews), P numbers, important internal links incl. route to contact.
4. First page brief for Day 6: opportunity, page ID, why first, customer need, audience, keywords, 2–3 real buying questions, proof, desired action, linked from / links to, missing inputs.
5. SEO hotspots table per page: SEO title (50–60 chars), meta description (150–160), H1, permalink, notes.

**SEO hotspots AI prompt (paraphrased):** using the keyword research, matrix, page list and business brief, draft hotspots for each page ID. For each page show service/area, primary keyword, reported volume/range, source geography and secondary keywords (data exactly as reported; flag gaps). Draft SEO title, URL decision, meta description, H1, opening paragraph and closing paragraph with a next step. Primary phrase near the start of the title; human-readable H1; include character counts. Keep sensible existing URLs; short hyphenated slugs for new pages. No unverified claims or invented locations.

---

## Day 6 · Build one useful page (on-page SEO)

- On-page SEO = **SEO hotspots** (title, meta, URL, H1, the bigger lever) + **page copy**.
- **V1 / V2:** V1 can be just updating the hotspots on an existing page (can move a page from not ranking to page 3–5). V2 adds reviews, case studies/projects, FAQs, full copy.
- **Step 1 BrandScript (StoryBrand), written once and reused everywhere:** A company / B customer want / C what they need / D problem + E feeling / F–G belief / H solution / I–K 3-step plan / L–M don't, instead / N–O next action / P success.
- **Step 2 page copy** (StoryBrand landing page, 11 sections): 1 header (eyebrow "Service in City, State", headline, subheadline with a semantic triple "X is a ___ that…", CTA), 2 stakes, 3 value proposition, 4 guide (empathy + real authority), 5 social proof (optional V1), 6 path (3 steps), 7 optional pricing, 8 services, 9 failure vs success, 10 optional lead magnet, 11 footer. Customer is the hero. Only real facts; [brackets] for anything unconfirmed. SEO title leads with trust signals, not the brand name. Meta description ends with a CTA.
- **Step 3 build:** AI output = wireframe/mockup. Build in the page builder (Elementor MCP / WordPress MCP beat raw HTML). Don't break locked templates.
- **Step 4 review, link, index:** keyword density ~1–2%. Internal links in body copy (better than menu links; you control anchor text); link parent ↔ child pages; avoid over-mentioning other areas. Request indexing in Search Console (URL inspection → Test live URL → Request indexing). Log every change. Wait a few days, then check the tracker.

**Worksheet (5 pages)**
1. My page (ID, URL, create/improve, primary + secondary keywords) + BrandScript project instructions (never invent services, guarantees, prices, testimonials, results; label assumptions).
2. My BrandScript (A–P fill-ins) + "read aloud and confirmed" check.
3–4. Landing-page copy fields for all 11 sections + Copywriter instructions (11 sections in order, customer is the hero, plain local copy, keywords naturally, exactly 3 steps, only supplied facts, [placeholders]).
5. Critical SEO review (keyword use in title, H1, opening, closing; URL and meta; exact-phrase count + word count; flag invented claims and broken contact actions; suggest internal links) + internal links table + before-publishing checks (mobile, links/contact work, claims real, public, no noindex) + status (draft/live/blocked).

---

## Day 7 · GBP care (finish setup, reviews, posts)

**SEO phases:** Strategy Sprint (Days 1–5, ~month 1) → Build (Day 6 pages + finish GBP setup) → Care (ongoing: reviews, posts, facts, photos, replies).

**1. Finish GBP services + products**
- **Services:** clean up the list (keep / rename / add / remove), 2–3 sentence description each, taken from the real service page. Leave price blank if unsure.
- **Products:** one product card per service, linked to its **service page** (not Home). Optional test: product categories by city with a unique description per city.
- Product image **720×720** (1:1, content centered). Real/branded images, not AI images.
- AI can draft descriptions — always review before saving.

**2. Reviews come first**
- Goal: **at least 5 new reviews** (if 0 now, get the first 3).
- Send by **email**: thank you → ask for a Google review → review link + QR code → tips: 2–5 sentences, add photos, mention the **service** and **city/neighborhood** → link again → signature.
- No reply after 1–3 days → **one** follow-up.
- **When to ask:** right after the job is done / a big early win. Never pay for reviews. Reply to every review fast.
- Private tracker: customer ref, date, channel, result.

**3. GBP posts (a quarter at a time)**
- Posts are a small ranking factor (~#140) but help conversions and AI overviews. No daily AI slop.
- Plan **12–13 weekly posts** in one sitting. Cycle: intro the business → each service (area 1) → real project/process → team → CTA post. Repeat for area 2, 3… Next quarter: give AI last quarter's posts so it doesn't repeat.
- Each post: topic, takeaway, CTA **Learn more** → a real page (add **UTM** to links), real image **1200×900** (4:3, centered).
- Schedule natively in GBP: Posts → Add post → Schedule this post.

**4. Care routine:** weekly reviews, inquiries, posts; update when hours/services/page links change; monthly real photos; set the next post-batch date; log work.

**Indexing tip:** after changing a page, request indexing 2–3 times over a few days (quota ~10–12/day per property). Test live URL first and check the canonical.

**Worksheet (4 pages):** 1 Services/products table · 2 Review invitation + follow-up + tracker · 3 Post calendar (13 weeks: drafted / scheduled / live) · 4 Post prompt, Care routine, "Before you finish" checklist.

---

## Day 8 · Citations (first authority)

**Why:** SEO = **relevancy** (Days 1–7) + **authority** (quality of local + industry backlinks, reviews, mentions). Quality beats quantity. Pages get stuck on page 3–7 until authority grows.

**Citation** = a listing/mention of the business name, address, phone, website (NAP). Keep NAP identical everywhere. **Service-area / home business: hide the address everywhere.**

**Natural backlink profile:** Premier links (few, spread over the year) · SERP links (a couple/month) · Citations (~100, in 3 waves) · Competitor-research links (~5/week). Day 9 covers the others.

**BrightLocal Citation Builder (free account, pay per citation)**
1. Add location with the Day 4 business details (or connect GBP); mark service-area if needed.
2. Citations → Citation Builder → it scans existing listings.
3. Aggregators: always **YP network** (~$30); Data Axle / Neustar optional (one per wave). Skip "cleanup" unless the business moved.
4. Untick ones you already have (Google, Yelp, Facebook) and verify-heavy ones better done yourself.
5. Take the top ~75 and split into **3 waves**: Wave 1 = rows 1, 4, 7, 10… · Wave 2 = 2, 5, 8… · Wave 3 = 3, 6, 9… (each wave gets high + medium + low).
6. ~$3.20 per citation → 25 + YP ≈ $110/wave. Worth it if the client pays ~$1,000+/month; otherwise build them manually.
- Each wave takes ~30–40 days. Start wave 1 around **week 6** of the client (after pages are built), then wave 2 after it finishes.
- Never buy the directories' ads/upsells.

**Worksheet "What's going in Wave 1?":** row #, directory domain, domain authority (from BrightLocal), verification needed · who does it (me / BrightLocal). Bring this list to Day 9.

---

## Day 9 · Backlinks ("Build a natural backlink profile")

**Video guide:** Sam's Day 9 video "Find Backlinks Worth Pursuing": https://www.youtube.com/watch?v=2B2uumZN7ak (1 h 12 min). Worksheet: 3 pages, uses the Day 8 Wave 1 list, brings the opportunity list to Day 10.

**Extra tips from the video** (timestamps to jump to)
- **Authority today = quality, not count** (5:17). Google no longer publishes it; Semrush / Ahrefs Authority Score is a rough estimate and the best we have.
- **Bag of marbles** (6:54): premier links = a handful (2–5 per client) · SERP links ≈ 10–20 · citations ≈ 90–100 (BrightLocal) + aggregators · competitor-research links = nearly unlimited, mostly low value. **Space them out over the year**: a bit of high, medium and low each month, never top-down (that looks unnatural). Manual link building happens between citation waves, then continues on its own.
- **Chamber is a no-brainer** (12:52). If the big-city chamber is pricey, join the next town's (Sam: Bend ~$500/yr AS ~32 vs Redmond ~$275/yr AS 27). Join even if you never go to events. A client who refuses the chamber is holding back their own SEO.
- **Fill out every profile fully** (14:21), mainly on premier and SERP sites: AI tools pull business info from them (an audit Sam ran pulled everything from a chamber profile).
- **Quarterly strategy session** (15:05), around the end of the client's first quarter, 1 hour: show wins + misses + plan; ask about trade associations, certifications and profiles they already have (e.g. a half-filled Zillow profile on an AS-90 site = a 5-minute link); collect content for V2 pages.
- **Referral partners** (16:33): only link to each other if you really do business together and it's relevant. Linking out gives away some authority. No link swaps or "backlink pods", no random local sites (e.g. an auto parts store that isn't a client).
- **Vendors / industry sites** (18:35): e.g. Clutch, DesignRush for agencies. Paying ~$150/mo just for a partner badge link isn't worth it. A link can fit more than one bucket; it doesn't matter which. End goal: a list of links with their **Authority Score**, ranked by it.
- **Sponsorships** (19:25): set a yearly giving budget ($250 / $500 / $1,000), pick the top 3 causes, then compare: event page AS, does it link to sponsors, how long the link stays (usually one year). Cheaper routes: host a chamber event or lunch-and-learn. Mentions without a link still help AI visibility.
- **SERP links** (23:45): search each service + city, go through ~10 pages (~100 results). Look for listicles and directories, **not competitors' sites**. ~10 min per search, ~1 hour total, yields ~10–20 decent links.
  - Yelp: spruce up the profile (photos). Don't ask for Yelp reviews; just share the link.
  - Old Reddit thread ranking for the keyword: a happy client who already uses Reddit can add a genuine recommendation. Reddit punishes anything that looks like promo.
  - Check each site's AS **and traffic trend** in Semrush. High AS with flat traffic = probably not worth the effort.
- **Footer credit links on client sites** (39:55) count, but less than a link in the page copy. Treat them as a free ad.
- **Backlink Gap setup** (44:47): set all 5 domains to **root domain** (not URL). Sorted by Matches: start with the "4 of 5" rows, then 3 of 5, and so on. Filter **Authority Score from 3** to cut most AI-generated slop; skip adult, fake or spammy sites. Ahrefs has a similar tool.
- **Paid listings** (53:21): free profile yes (e.g. Agency Spotter free vs $2,800 paid). Over ~$20 is rarely worth it; ~$15/yr on an AS-30 site maybe.
- **Volume** (54:22): a gap report of ~400 referring domains usually gives ~20–50 legit ones. Export it and delegate the checking. Then swap in the next 4 competitors, then the same industry in a bigger city, then similar businesses in town (e.g. pressure washers → roofers).
- **Pace math** (55:55): e.g. 3 premier + 10 SERP + 90 citations + 250 competitor ≈ 360 links/year ≈ 30/month ≈ 7.5/week (high end). Most industries: **2–5/week**; competitive ones ~10.
- **Calibrate** (58:33): check the client's Authority Score at month 3, 6, 9, 12. Far from the target AS = speed up; close = slow down.
- **Spam line** (59:13): Sam no longer looks at AS 2 or below; **AS 3+** is OK to pursue from competitor research. A few quality links (chamber, industry) beat hundreds of AS-3 links, but there are only so many, so it's a balance.
- **Profile health check** (1:02:25): Semrush Domain Overview (free) → AS trend. **Referring domains vs backlinks** should be close (1:1 to ~2:1); a huge gap means lots of links from one site. Sort referring domains by AS to review. Testimonials you give vendors are another link source.
- **"Noise of the internet"** (1:05:09): thousands of backlinks from crawler / backlink-checker sites are normal and likely ignored by Google. Don't show clients full backlink lists. Don't buy links (social bookmarks, Fiverr packages); tier-2 links aren't worth it. Skip the disavow tool (likely does nothing).
- **First 20 links** (1:09:24): about 2 hours with Claude helping, ~4 alone. Day 10 = reporting + turning results into a case study.

**Goal:** map where the links will come from and start a list **bigger than you'll work this week**. Mix of high-, medium- and lower-authority links from legitimate places; keep sourcing over time.

**Words:** backlink = clickable link from another site to yours · citation = also a backlink when it includes the website link · mention = names the business without linking.

**Four link sources** (one opportunity can fit more than one)
- **Premier:** chamber, trade association, local publication, partner or community organization. Highly relevant; some bring recognition, referrals or leads.
- **Competitor-sourced:** a few big ones and many everyday ones. Several similar businesses on one site = a clue you can get listed too.
- **SERP:** a directory or roundup that shows up when you search the service. Worth it even if it never sends an inquiry.
- **Citations:** straightforward listings; the Day 8 Wave 1 list gets this moving.
- Authority Score is one signal only: a local chamber can score far lower than a big directory and still deserve as much attention.

**1 · Premier links (start with relationships you already have)**
- Existing memberships/partnerships = quick wins: look for a public member page, partner page, event page or directory.
- Table: relationship → public page or route in → next action. Rows: chamber of commerce · trade groups and associations · certifications · referral partners · manufacturers and vendors · organizations you've worked with.
- **Editorial idea:** expertise, a local story or a useful example a publication could feature.
- **Sponsorships (pick 2–3, "lead with your heart"):** community fit first; local relevance and online recognition break a tie. Per sponsorship: event or cause, tier + cost, why support it, sponsor page (public / on main site / stays up), shows (name / logo / profile / link). Paid links are usually marked sponsored or nofollow.

**2 · Search results (same service and area as the whole challenge)**
- **Like a customer:** [service] in [city] · best [service] in [city] · [service] near me.
- **Like a lister:** [industry] directory · [industry] association member directory · [city] business directory.
- Open promising directories, roundups, industry pages. Check the exact category and location. Find the route in: claim a profile, apply, contact an editor, or join.
- **Ask:** is this a legitimate page for the business, and can it actually get listed? Audience and leads are a bonus.
- Log: search run → promising pages (row # on the opportunity list).

**3 · Competitor research (where most of the volume comes from)**
- Semrush → **Backlink Gap**: client domain + up to 4 direct competitors from the same service and area (C1–C4 from Sam's Guide). **Prospects for** = client domain. **Matches** = common sources; **Authority Score** = stronger domains. Then open the actual source page.

| Competitors on the site | What to do |
|---|---|
| All or most | Open it early. Legitimate + qualifies → go after it (normal place for businesses in that market). |
| Some | Still worth a look (real local directory or niche association?). Check how they got on. |
| None, found elsewhere | Found via search, relationships or industry research with a legitimate route in → pursue it. A gap report won't surface it. |

- **Modest site?** Keep it if the business legitimately belongs, even with a low score. Skip irrelevant or spammy sites.
- Out of competitors? Same industry in a bigger city (niche sources) + similar businesses in town (local sources). No Semrush? Build from searches, memberships, relationships.

**4 · Opportunity list (bring to Day 10)**
- **Weekly pace:** 2–10 links a week, based on the competition.
- Start with 12 rows. Tick **This week** on the few to start, each with a dated next action. Over time: up to **100 possibilities**, about **20 qualified**. Some weeks = several easy listings, others = one pitch or sponsorship. Keep sourcing.
- Columns: # · exact page · found via (R relationship, S search, C competitor, Cit citation, Sp sponsorship) · why it fits · how to get on it (claim, apply, contact) · cost · next action + date · this week · sent · approved · live.
- Before adding a citation, check the Day 8 Wave 1 list so it isn't added twice.
- Keep sent, approved and live separate. Tick **Live** only after clicking the link and checking where it goes (Day 10 compares done vs actually in place).

**Our agency setup:** the list lives in the **Link Opportunities** tab of the client's Master Keyword Database sheet (same columns + an **Authority Score** column, as Sam recommends). Backlink Gap competitors = C1–C4 on Sam's Guide. Never use a client's hidden address on any listing.

---

## Whitespark Local Search Ranking Factors 2026 (checklist)
Source: https://whitespark.ca/local-search-ranking-factors/ (47 experts, 187 factors). Use it to check the client's GBP + site and to compare competitors (Pleper for secondary categories).

- GBP signals ≈ 32% of map pack weight; 8 of the top 10 map factors are GBP fields.
- Reviews ≈ 16–20% and rising; recency is the strongest review factor.

**Top 20 Maps / local pack factors**
1. Primary GBP category
2. Proximity to searcher
3. Keywords in GBP business name (real name only)
4. Physical address in city of search
5. Open at time of search
6. High rating (4–5)
7. Address showing on GBP
8. Additional GBP categories
9. Number of Google reviews with text
10. Map pin placement
11. Review recency
12. Proximity to city centre
13. Click-through rate from Maps
14. Steady flow of reviews
15. Website NAP matches GBP
16. GBP completeness
17. Keywords in the GBP landing page title tag
18. City/neighborhood content
19. Removing spam listings
20. Keywords in the GBP landing page headings

**Top 20 local organic factors**
1. Dedicated page for each service
2. City/neighborhood keyword relevance of content
3. Quality/authority of inbound links
4. Keywords in the GBP landing page title tag
5. Links from industry-relevant sites
6. Internal linking across the site
7. Service keyword relevance site-wide
8. Keywords in the GBP landing page headings
9. Niche focus
10. Keywords in inbound link anchor text
11. Keywords in title tags site-wide
12. Link diversity
13. Links from local sites
14. Volume of quality content site-wide
15. Keywords in headings site-wide
16. Mobile-friendly
17. Content volume on service pages
18. HTTPS
19. Keywords in internal link anchor text
20. Organic click-through rate

**Competitor GBP check columns:** primary + additional categories (Pleper) · keyword in name · rating + review count · latest review date · hours · address shown or hidden · phone · Book online button · products · posts/updates · Maps top 10 for each main search.

---

## How these map to our agency SEO tasks (ClickUp Phase 2–4)
- Day 2 → Build & clean master keyword database; group keywords into service/location clusters.
- Day 3 → Rank tracking & baseline (Semrush); baseline map scans; record baselines; confirm analytics & lead tracking.
- Day 4 → Competitor review (Maps categories + reviews + Whitespark checklist); GBP optimization; NAP record.
- Day 5 → Ideal sitemap; SEO hotspots; cannibalization checks.
- Day 6 → Service/location page template; build / reoptimize pages; internal linking; request indexing.
- Day 7 → GBP services/products, review requests, scheduled GBP posts, monthly GBP care.
- Day 8 → Citation building (BrightLocal waves); NAP consistency; start of link database.
- Day 9 → Link Opportunities tab: premier links, sponsorships, SERP links, Semrush Backlink Gap; weekly link pace.
