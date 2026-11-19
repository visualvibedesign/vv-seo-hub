# Vibe SEO plugin – handoff notes for SEO Hub

From Alexia's handoff (Nov 19, 2026): Vibe-SEO-handoff-Angel.zip + live doc https://claude.ai/artifact/16FpwdrWz5JNpYroz1Mv28

## Ownership
- **Vibe SEO 1.0.0 is Angel's** to own and change.
- **Vibe Admin 1.38.0 stays Alexia's.** Never change its files.
- Vibe SEO needs Vibe Admin 1.38.0+ and stops with a notice without it.
- Install on a test site: Vibe Admin first, then Vibe SEO.
- Release on the hub (app.alexialynn.co/plugins/): upload Vibe SEO's folder first, then Vibe Admin.

## What lives where
- **Vibe Admin** (every site, visitor-facing): branding, login, dashboard, Business Info, redirects, 404, schema, hub check-in, Push changes, monthly client email.
- **Vibe SEO** (add-on): SEO dashboard, Strategy, Weekly care, Link ideas, Build (setup, sitemap, QA, Launch Kit), ClickUp sync, Search Console (Site Kit), Clarity, weekly SEO email, monthly SEO reports, CRO insights, 5-step SEO setup wizard.
- Removing Vibe SEO never breaks a live site.
- Old VVDA_* class/option names were kept, so no data moved. New code uses the VVDS_ prefix.

## SEO Hub check-in API (phase 5: SEO Hub builds the receiving side)
Each site with Settings → Agency → **SEO hub address** set sends this once a day, and right away when the address is first saved.

- `POST {seo_hub_url}/api/vibe/checkin`, JSON body.
- Headers:
  - `X-Vibe-Site`: the site's home URL
  - `X-Vibe-Time`: unix seconds
  - `X-Vibe-Signature`: `sha256=` + hex HMAC-SHA256 of `"<X-Vibe-Time>.<raw body>"`, keyed with the site's connection key (the same key the agency hub uses; the key is never sent)
- Verify: HMAC over the **raw body before JSON parsing**, constant-time compare, reject times more than 10 minutes off.
- Any 2xx counts as success. Other codes show on the site as "Last sent …".
- Body: `site` holds:
  - `id`: md5 of host + path, lowercase, no www., no trailing slash. It's the same id the agency hub uses.
  - `name`, `url`, `admin`, `vvda`, `vseo`, `plan`, `seo_plugin`
  - `seo`: pages, score, missing_desc, missing_kw, long_title, no_image, dup_kw, missing_alt, orphans, stale, checklist_done/total. Null when the site has no SEO plugin.
  - `seo_client`
  - `weekly`: visitors, views, top pages, sources, plus keywords / GSC / Clarity when connected. Null unless the site is an SEO client.
  - `build` (shown, finished), `clickup` (list ids), `time`
- To add fields: `VVDS_Link::payload()` in `includes/class-seo-link.php`.

## Routes SEO Hub must support
- `{seo_hub_url}/clients/{site id}`: the agency hub's "SEO client" badge, site name and SEO report button open this once seo_hub_url is set on the agency hub.
- Page list from a site: signed `POST /?rest_route=/vvda/v1/hub/pages`, body `{t, sig}`, sig = HMAC-SHA256 of `"pages|<t>"` with the key (in Vibe Admin's VVDA_Hub).

## Hub pieces SEO Hub will replace over time
These run on app.alexialynn.co today, through Vibe SEO in hub mode:

| Today | Class / options | Note |
| --- | --- | --- |
| SEO overview (all clients) | VVDA_SEO_Overview | Same seo + weekly data as the check-in |
| Client workspace (overview, keywords, pages, plan, reports, CRO, log, notes) | VVDA_SEO_Workspace · vvda_seo_ws, vvda_seo_log | |
| Site plan (sitemap planner, redirects queue) | VVDA_SEO_Plan · vvda_site_plan, vvda_redirect_queue | Redirects reach sites in the agency hub's check-in reply |
| Monthly SEO reports | VVDA_Monthly · vvda_seo_reports | |
| Weekly SEO email (Mondays) | VVDA_Weekly | Sent from the agency hub |
| ClickUp proxy for sites without a token | VVDA_ClickUp (hub route) | Keep on app.alexialynn.co or give sites a token |

## Each Vibe SEO release
- Bump `Version:` + `VVDS_VERSION` in vibe-seo.php, Stable tag + changelog in readme.txt.
- Update version + changelog (newest first) in plugins/vibe-seo/info.json.
- Needs a newer Vibe Admin? Raise `VVDS_NEEDS_ADMIN`.
- Log it in ClickUp "Vibe Admin Plugin" list as "Vibe SEO X.Y.Z", status complete.
- Smoke test before shipping. The full list is in the handoff PDF.
