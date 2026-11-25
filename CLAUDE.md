# SEO Hub (vv-seo-hub)

SEO dashboard web app for Visual Vibe Design: one place for every SEO client's strategy, data and (later) automation. Built by Angel. Sister app of Visual Vibe HQ (`../visual-vibe-dashboard`).

## Read first
- `docs/BUILD-ROADMAP.md`: **master list** of every phase (SEO Hub + Vibe SEO plugin), in order, with status and prompts
- `docs/seo-hub-phases.md`: SEO Hub phases 0–6, screens, what "done" means, tables, prompts
- `docs/seo-hub-context-pack.md`: who, goals, rules, Anassa test data, look
- `docs/local-seo-playbook.md`: Sam's 10-Day Rank Yourself process (the flow the app follows)
- `docs/vibe-seo-plugin-plan.md`: Vibe SEO releases (1.3.0 / 1.4.0 / 1.5.0), per-site SEO Hub key, how a site connects
- `docs/vibe-seo-handoff-notes.md`: check-in API, routes, hub pieces (from Alexia)
- `docs/design/`: exported screens from the design canvas (source of truth for the UI)

## Build order
Website first (SEO Hub phases 1–4), then the Vibe SEO plugin + site connection. Until then, screens that need site data show an empty state "Connect the site (coming soon)". Never fake site data. Current work: redo phase 1 to match docs/design/ on branch `redesign`, keeping what already matches.

## Hard rules
- Never push, merge or deploy until Angel says so. Work on local branches.
- Never delete data or tables without asking Angel. Show SQL before running it.
- Never change files in `../visual-vibe-dashboard` (read only) or the Vibe Admin plugin. Never log in to WordPress admin. The Vibe SEO plugin lives in `../vibe-seo` (its own Claude Code session); this app only receives its check-ins and sends approved pushes.
- Team-only. Login = HQ's shared team password + signed `vv_session` cookie. No Supabase Auth, no user list.
- Same Supabase project as HQ; SEO tables kept separate from HQ's; RLS on every table. `.env` is never committed.
- Never store or show a client's private address.
- No Semrush API: CSV imports only, volumes kept exactly as exported (KP ranges stay text like "10–100").
- GSC + GA4 via free Google APIs. GBP typed in. Whitespark CSV or screenshot. Rank tracking stays in Semrush.
- Don't rebuild what other tools do (Yoast, ClickUp tasks, rank tracking).
- Claude drafts are never published without review.
- Site connection: per-site SEO Hub key, generated in SEO Hub, stored hashed/encrypted server-side, shown once. `/api/vibe/checkin` checks the HMAC over the raw body (10-minute window, constant-time compare).
- Auto-fill: plain code rules for exact work (CSV parsing, duplicates, near me / FAQ patterns, citation waves); the Claude API (ANTHROPIC_API_KEY, server-side only, same account as HQ) for judgment and writing. Claude output is saved as "Ready to review" until Angel approves. Claude never changes exported numbers or invents facts. Log every Claude call (task, client, tokens).
- Screens follow the design canvas exported in docs/design/. Sidebar: hub mode never lists clients; client mode has grouped, foldable sections (see docs/seo-hub-phases.md).
- Supabase connector (claude.ai Supabase MCP): use only our SEO Hub project (the same one as `.env.local`). Never touch other projects; never pause or create projects.
- Only `seo_` tables. Never read or change HQ's tables.
- Reads are fine: counts, RLS checks, duplicate checks, test SELECTs.
- Writes (migrations, insert, update, delete): show Angel the exact SQL + how many rows it affects. Angel runs it in the Supabase SQL Editor; the connector stays read-only. Deletes always start with a count.
- Never print or store keys or tokens.

## Look
Same as Visual Vibe HQ: reuse its styles and components. Fraunces headings with a purple italic word (#7C5CE6), Inter body, bg #F7F5FF, text #131314, sidebar #EEEAFF, active pill #BFAFFF, white 22px cards with #ECE8FB border, lime #BAD657 pill buttons, light + dark mode, phone layout. Role tags: Primary teal, Secondary light blue, FAQ orange, Near me gray.

## How to work with Angel
- Plan first, build after approval, one step per message, then say what to test on localhost.
- Short answers, bullets/tables, casual.
- Test client: Anassa Wax & Beauty (data in the context pack).
