# SEO Hub (vv-seo-hub)

SEO dashboard web app for Visual Vibe Design: one place for every SEO client's strategy, data and (later) automation. Built by Angel. Sister app of Visual Vibe HQ (`../visual-vibe-dashboard`).

## Read first
- `docs/seo-hub-context-pack.md`: who, goals, rules, Anassa test data, look
- `docs/seo-hub-phases.md`: phases 0–6, what "done" means, prompts
- `docs/local-seo-playbook.md`: Sam's 10-Day Rank Yourself process (the flow the app follows)
- `docs/vibe-seo-handoff-notes.md`: Vibe SEO plugin, check-in API, routes (phase 5)

## Hard rules
- Never push, merge or deploy until Angel says so. Work on local branches.
- Never change files in `../visual-vibe-dashboard` (read only) or the Vibe Admin plugin. Never log in to WordPress admin.
- Team-only. Login = HQ's shared team password + signed `vv_session` cookie. No Supabase Auth, no user list.
- Same Supabase project as HQ; SEO tables kept separate from HQ's; RLS on every table. `.env` is never committed.
- Never store or show a client's private address.
- No Semrush API: CSV imports only, volumes kept exactly as exported (KP ranges stay text like "10–100").
- GSC + GA4 via free Google APIs. GBP typed in. Whitespark CSV or screenshot. Rank tracking stays in Semrush.
- Don't rebuild what other tools do (Yoast, ClickUp tasks, rank tracking).
- Claude drafts are never published without review.

## Look
Same as Visual Vibe HQ: reuse its styles and components. Fraunces headings with a purple italic word (#7C5CE6), Inter body, bg #F7F5FF, text #131314, sidebar #EEEAFF, active pill #BFAFFF, white 22px cards with #ECE8FB border, lime #BAD657 pill buttons, light + dark mode, phone layout. Role tags: Primary teal, Secondary light blue, FAQ orange, Near me gray.

## How to work with Angel
- Plan first, build after approval, one step per message, then say what to test on localhost.
- Short answers, bullets/tables, casual.
- Test client: Anassa Wax & Beauty (data in the context pack).
