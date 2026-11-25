# SEO Hub – start here (for Angel)

**Updated Nov 25, 2026. Website first, plugin later.**

## Folder setup
```
Projects/
├─ visual-vibe-dashboard/   ← HQ (read only for SEO Hub)
├─ vv-seo-hub/              ← SEO Hub app (this folder)
│  ├─ START-HERE.md
│  ├─ CLAUDE.md
│  └─ docs/
│     ├─ BUILD-ROADMAP.md        ← every phase, in order
│     ├─ seo-hub-phases.md       ← SEO Hub phases in detail + prompts
│     ├─ seo-hub-context-pack.md
│     ├─ local-seo-playbook.md
│     ├─ vibe-seo-plugin-plan.md
│     ├─ vibe-seo-handoff-notes.md
│     └─ design/                 ← exported design screens
└─ vibe-seo/                ← Vibe SEO plugin (later, after SEO Hub phase 4)
```

## Where we are
- Done: phase 0 portal in HQ, SEO Hub repo + Vercel, phase 1 steps 1–4 (database, sign-in, clients, CSV import) on branch `phase-1`, full design.
- Now: redo phase 1 to match the design (keep what already matches), then phases 2 → 3 → 4.
- Later: the Vibe SEO plugin + site connection (see `docs/BUILD-ROADMAP.md`).

## Steps
1. **Back up:** `git add -A` → `git commit -m "Backup before redesign"` → `git checkout -b redesign`.
2. **Docs:** replace `CLAUDE.md`, `START-HERE.md` and `docs/` with the new files. Don't touch `src/`, `CONTEXT.md` or `.env.local`.
3. **Design:** export the screens into `docs/design/` (Main, Clients, NewClient, Templates, TemplateEditor, Client, Guide, Autofill, Keywords, Notes, Sidebar).
4. **Key:** add `ANTHROPIC_API_KEY=...` to `.env.local` (never committed).
5. **Paste the audit prompt** below → read `docs/redesign-audit.md` → approve or adjust.
6. **Paste the build prompt** → test each step on localhost (phone + dark mode) → "next".
7. **Phase 1 done** (checklist in `docs/seo-hub-phases.md`) → only then say push for a Vercel preview → share with Alexia.
8. **Phases 2, 3, 4:** prompts in `docs/seo-hub-phases.md`.

## Prompt · audit (no code)
```
The plan changed. Read CLAUDE.md, docs/BUILD-ROADMAP.md, docs/seo-hub-phases.md, docs/seo-hub-context-pack.md, docs/local-seo-playbook.md and every screen in docs/design/. We build the website first; the site connection waits for the plugin.

Compare what's already built (database, sign-in, clients, CSV import, sidebar, styles) with the design, phases and logic. Make a table: Keep (already matches), Change (what and why), Remove (only if it conflicts), New (missing). Include the database tables and the SEO Hub logic (auto-fill rules vs Claude API, review/approve, templates, guide progress).

Save it as docs/redesign-audit.md. Plan only, no code. Don't delete any data or tables without asking me.
```

## Prompt · build phase 1
```
Approved. Build phase 1 on the redesign branch following docs/redesign-audit.md and docs/seo-hub-phases.md › Phase 1, in this order:
1. Layout + new sidebar (hub mode / client mode, foldable groups, client switcher)
2. All clients + Add client wizard
3. Client overview + step-by-step guide
4. Keywords (database, 3×3 matrix, clusters, import) updated to the design
5. Templates + editor
6. Uploads + auto-fill (Day 1 + Day 2) with the Claude API
7. Notes & links
One step per message. After each: tell me what to test on localhost, then commit locally. Do NOT push, merge or deploy until I say so.
```

## Never
- Push, merge or deploy until Angel says so.
- Change Visual Vibe HQ or Vibe Admin. Log in to WordPress admin.
- Delete data or tables without asking. Store a private address or keys in tables.
