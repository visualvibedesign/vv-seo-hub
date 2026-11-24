# Vibe SEO plugin plan (Angel)

Nov 25, 2026. **Goal:** build SEO Hub and Vibe SEO together so they work as one system. Order of all phases: `BUILD-ROADMAP.md`.
- **Only Vibe SEO changes. Vibe Admin is never changed** (Alexia's). Vibe SEO may *use* Vibe Admin's existing public functions and hooks, read-only.
- **Add only, never remove.** Every existing Vibe SEO feature stays as it is (SEO dashboard, Strategy, Weekly care, Link ideas, Build, Launch Kit, QA scan, ClickUp sync, reports, setup wizard, hub screens). New releases only add things.

## The integration plan (7 steps)
SEO Hub becomes the main place to work. Everything of Alexia's keeps running. They connect, they don't compete.

| # | Step | Alexia's work | Our idea |
| --- | --- | --- | --- |
| 1 | **Keep both running.** Her hub screens + every plugin feature stay. New SEO work happens in SEO Hub | Untouched | SEO Hub is the main place |
| 2 | **Use her bridge:** once SEO Hub is ready, set **SEO hub address** on her agency hub (`VVDA_Hub::seo_link`). Her "SEO client" badge + report buttons then open SEO Hub `/clients/{site id}` | Built by her, no code change | Everyone lands in SEO Hub |
| 3 | **Vibe SEO 1.3.0 (add-only, read-only):** SEO Hub key, pages list, duplicate keyphrases, link ideas, QA summary, "Check in now", "Open in SEO Hub" link | QA work reused, not changed | SEO Hub gets real page data |
| 4 | **SEO Hub receives check-ins early (phase 2):** form entries, "what changed", care progress | Uses data her code already sends | Fills Overview, Reports, Work log |
| 5 | **One-time import of old hub data:** client workspaces, site plans, monthly reports copied into SEO Hub (read-only copy) | Her data stays where it is | No starting from zero |
| 6 | **Vibe SEO 1.4.0 (writes):** push title / meta / keyphrase, redirects, applied log, target keyword column in WordPress | Uses her redirect function, unchanged | Plan → push → live |
| 7 | **No double work:** one weekly email (hers keeps sending until SEO Hub's is ready, then switch with her OK). Search Console from SEO Hub's Google API; the plugin's numbers are the backup | Asked, not removed | Clean workflow |

**Order:** ask Alexia → SEO Hub phase 1 → Vibe SEO 1.3.0 + SEO Hub receives check-ins (phase 2) → old data import → phases 3–4 → Vibe SEO 1.4.0 with phase 5 → 1.5.0 later.

## Where we start: Vibe SEO 1.2.0 (live on the hub, released Nov 21)
- **1.1.0:** "Hand it off to Claude": copy or download the latest QA scan as a Markdown brief.
- **1.2.0:** mark QA items done by hand (who + stays checked), checked items stop counting as problems, last scan shows when the tab opens.
- **Start from the 1.2.0 code**, not the 1.0.0 handoff zip. Agree with Alexia who edits Vibe SEO so releases don't clash.

Already in the code: `VVDS_Link` daily signed check-in to `{seo_hub_url}/api/vibe/checkin` (ignores the reply today) · `VVDA_SEO::save_field()` saves title / meta / keyphrase to Yoast or Rank Math · `VVDA_SEO::audit()` / `summary()` have every page's SEO data · `VVDA_Weekly::data()` (visitors, views, forms, score, gsc, clarity, top, sources, changed, updates, wins, links, care) · Vibe Admin's public `VVDA_Redirects::import()` adds redirects (used read-only).

## Connection key (decided: per-site SEO Hub key)
Today Vibe SEO signs with Vibe Admin's `hub_key`, which is **one key for all sites** (the agency hub checks it the same way for everyone). If SEO Hub stored it, one leak = every site. So:
- **Vibe SEO 1.3.0 adds its own field:** Settings › Vibe SEO › **SEO Hub key** (one per site).
- **If the field is empty, it falls back to `hub_key`**, so nothing breaks for sites already sending (add-only).
- SEO Hub stores each site's key on the server only (hashed/encrypted, never shown again, never sent back).

## How a site connects to SEO Hub
1. **SEO Hub › client › Site › Connect site:** SEO Hub works out the site id (md5 of host + path, no www, no trailing slash) and **generates the SEO Hub key**. Shown once, with a Copy button.
2. **The site:** paste the key into Vibe SEO › **SEO Hub key**, and set **SEO hub address** (e.g. https://vv-seo-hub.vercel.app, later seo.visualvibedesign.com).
3. Saving sends a check-in right away ("Check in now" also does), then once a day.
4. **SEO Hub** checks the signature, matches the site id to the client → **Connected · last check-in**. Wrong key / no check-in in 48h → "Not connected" + why.
5. **The site** shows "Last sent … OK" on its SEO Hub card.
6. **Lost key / staff change:** SEO Hub › Regenerate key → old key stops working right away → paste the new one.
- Needs SEO Hub's `/api/vibe/checkin` first; that route must stay reachable when previews are password-protected (the signature protects it instead).

## Updates, ranked (value + safety)
| # | Update | What SEO Hub gets | Risk | Version |
| --- | --- | --- | --- | --- |
| 1 | SEO Hub key field (fallback to `hub_key`) + SEO Hub status card + "Check in now" + "Open in SEO Hub" link | Safe per-site connection | Low | 1.3.0 |
| 2 | Pages list in the check-in: URL, status, SEO title, meta, keyphrase, score, missing image/alt, orphan, last edited | Pages + hotspots "live now", swapped pages, Overview SEO table, push "before" | Low (read-only) | 1.3.0 |
| 3 | Duplicate keyphrases + link ideas in the check-in | Keyword owner conflicts, Links | Low | 1.3.0 |
| 4 | QA scan summary (open vs checked, last scan date) | Client overview + "Needs you" | Low | 1.3.0 |
| 5 | Apply SEO pushes from SEO Hub's check-in reply (title / meta / keyphrase via `save_field()`) | Push to site works | Medium | 1.4.0 |
| 6 | Applied-changes log (before → after, who, when), sent back next check-in | Work log + Day 10 | Low | 1.4.0 |
| 7 | Redirects from SEO Hub via `VVDA_Redirects::import()` (Vibe Admin unchanged) | Site plan redirects queue | Medium | 1.4.0 |
| 8 | Target keyword column in WP Pages list + approved hotspots shown read-only | Builders see targets in WP | Low | 1.4.0 |
| 9 | Planned pages from SEO Hub → drafts (Build's existing create pages) | Site plan "+ Add page" lands in WP | Medium | 1.5.0 |

Pushes ride on the check-in reply (same pattern Vibe Admin's agency hub uses): the site only talks out, works behind caching and firewalls; "Check in now" makes it instant.

## Duplicates and who owns what (nothing removed)
| Thing | Today (Alexia) | Plan |
| --- | --- | --- |
| Client workspace, site plan, monthly reports | Agency hub | Stay. Copied once into SEO Hub (step 5); new work in SEO Hub |
| SEO overview table | Agency hub | Stays. SEO Hub has its own from check-ins |
| Weekly email | Vibe Admin weekly | Keeps sending until SEO Hub's weekly is ready, then switch with her OK |
| Search Console numbers | Plugin | SEO Hub uses the Google API; plugin numbers = backup |
| Notes | Agency hub | Stay. SEO Hub has Notes & links |
| Hiding hub SEO screens | — | Only later, only as an option, only if she wants |

## Safety rules for every release
- SEO fields only: title, meta description, focus keyphrase (+ redirects through Vibe Admin's import). Never content, users, plugins or settings.
- Every request signed (HMAC of `"<time>.<raw body>"`), 10-minute window, constant-time compare. Each push has an id and is applied once only.
- Nothing applied without a confirm in SEO Hub first. Everything logged on both sides.
- Removing or turning off Vibe SEO never breaks a live site.

## Open questions (ask Alexia)
1. Who edits Vibe SEO now (she released 1.1.0 + 1.2.0)? Can she send the 1.2.0 files? Who uploads releases to the hub?
2. OK to add a per-site **SEO Hub key** in Vibe SEO (falls back to `hub_key` if empty)?
3. OK for Vibe SEO to call `VVDA_Redirects::import()` for SEO Hub redirects?
4. OK to copy her hub's client workspaces, site plans and monthly reports into SEO Hub once (read-only)?
5. Weekly email: switch to SEO Hub's later, with her OK?
6. Later, an option to hide the hub's SEO screens once SEO Hub covers them (never removed)?
7. Domains: when can we get `seo.visualvibedesign.com` / `hq.visualvibedesign.com`?

## How we work on it
- Own folder + private repo `visualvibedesign/vibe-seo`, from the 1.2.0 code. CONTEXT.md + CLAUDE.md first.
- Every release: bump `Version:` + `VVDS_VERSION`, readme Stable tag + changelog, `info.json`; test on the staging site first (point only staging at test files with `VVDS_UPDATE_INFO_URL` in wp-config.php); smoke test; then upload Vibe SEO's folder to `app.alexialynn.co/plugins/vibe-seo/` (sites with auto-updates on install it themselves); log "Vibe SEO X.Y.Z" in ClickUp "Vibe Admin Plugin" list.
- Never deploy or upload without Angel's OK.
