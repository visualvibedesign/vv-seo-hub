# SEO Hub – start here (for Angel)

## Folder setup
```
Projects/
├─ visual-vibe-dashboard/   ← HQ (already there)
└─ vv-seo-hub/              ← this folder
   ├─ START-HERE.md
   ├─ CLAUDE.md
   └─ docs/
      ├─ seo-hub-context-pack.md
      ├─ seo-hub-phases.md
      ├─ local-seo-playbook.md
      └─ vibe-seo-handoff-notes.md
```

1. Make an empty, **private** GitHub repo called `vv-seo-hub` (no README).
2. Open Claude Code in this folder and paste **Prompt 1**.
3. Copy the Supabase URL + keys from HQ's `.env` into the new `.env` (never commit it).
4. Check it on localhost, then paste **Prompt 2** (phase 1).
5. Later prompts: copy them from `docs/seo-hub-phases.md`.

## Prompt 1 · project setup
```
This is the folder for SEO Hub. Read CLAUDE.md and everything in docs/ first, especially docs/seo-hub-phases.md (rules, phase 0, phase 1).
The Visual Vibe HQ code is in ../visual-vibe-dashboard. Read it to copy its setup, styles, components and login check. Do NOT change anything in that folder.

Set up the project only (no features yet):
- same React + Vite setup as HQ
- copy HQ's styles (fonts, colors, cards, buttons, sidebar) so it looks the same
- .env.example with the Supabase keys needed (same Supabase project as HQ), and .env in .gitignore
- a simple placeholder page in the HQ style that says "SEO Hub"
- git init, connect to github.com/<my-account>/vv-seo-hub, but do NOT push yet

Then run it on localhost and tell me how to check it. After that, wait for me to send the phase 1 prompt.
```

## Prompt 2 · phase 1
```
Phase 1 of SEO Hub: clients + keyword database + CSV import + 3×3 matrix + clusters (Sam Days 1–2).
Read docs/seo-hub-context-pack.md, docs/seo-hub-phases.md (rules, phase 0 and phase 1), docs/local-seo-playbook.md (Days 1–2) and the Visual Vibe HQ code in ../visual-vibe-dashboard for its styles, components and login (read only).

No design mockups. Build it directly in the Visual Vibe HQ style (reuse HQ's styles and components so both apps match).

Step 1 (plan only, no code): which HQ styles/components to reuse, Supabase tables (same Supabase project as HQ, SEO tables kept separate, RLS on all), how sign-in works now (same team password) and later (HQ's shared vv_session cookie), folder structure, build steps.
Step 2 (after I approve): build on a local branch, one step per message, and tell me what to test on localhost. Use Anassa's real data.
Step 3: do NOT push, merge or deploy until I say so. When I say, push for a Vercel preview that is behind the team login.

Rules: volumes exactly as exported, skip exact duplicates only, flag missing data, no private address field, team-only.
```

## Before going live
- Ask Alexia: OK to use the same Supabase project as HQ?
- Vercel: Add New → Project → import `vv-seo-hub`, add the same env keys, turn on password protection before sharing the link.
