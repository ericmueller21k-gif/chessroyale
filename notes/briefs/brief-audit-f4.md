# Audit F4: desktop stops repeating long logic flows; the two slowest spec files split (Nov 10)

Read first: CLAUDE.md, notes/briefs/rules-common.md (branch claude/director-notes), section F4 of
notes/pipeline-audit-2026-11-09.md (same branch), docs/rules/eric.md (Eric's standing rules and their guard tests), docs/areas/ops.md.

## The change
1. **Review the seven desktop flows over ~290 s** (run 1166): boss-challenge, shop, boss-side, town, town-chat, dash, autochess.
   For each test in them: does the desktop run check anything the phone run doesn't (desktop layout, mouse/hover, the side menu,
   wider screens)? If not, tag it `@phone-only` (the tag the config already honors; check how). **Keep on both projects:** every
   layout/size/position check, and every guard test named in docs/rules/eric.md. Look first at why boss-side's desktop takes twice its
   phone time (a real slowness on desktop is a finding, not a tag).
2. **Write the list FIRST** (test name, phone s, desktop s, keep/tag, one-line reason) to `.f4-list.md` at the repo root, push it, and
   stop there: the director signs off the list (or edits it) before you tag anything. Wait for a reply message.
3. Then tag, and **split autochess.spec.ts and crowd.spec.ts** into two files each (no file over ~6 min a project), adding the new
   files to e2e/areas.json under the same areas. No test changes inside the moved tests.

Lane: targeted. Effort high. The PR body lists every test whose desktop run is dropped (that's a changed check). No sims, no stills.
Decision note docs/decisions/2026-11-10-desktop-phone-only.md, at most ~120 words. Push to claude/audit-f4; when done write
.pr-body.md at the repo root and push. Don't open the PR. Another helper is changing e2e/ci-select.mjs and areas.json's traced
section at the same time (F3): touch only the area entries for the split files.
