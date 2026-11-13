# The street town for everyone (Eric, Nov 13)

Effort high (the town's world, every player's town; drawing and camera). **Full lane** (it changes what every player sees and about 8
of 13 town e2e specs): add the `full-e2e` label request to your PR body. Branch `claude/street-for-everyone` from main.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/town-square.md`, `docs/rules/eric.md` ("The town never shows an old version").

## Why
Eric (Nov 13): "The old town should never load because people could exploit something ... if the current town doesn't load and it's
genuinely because they can't run it, then they just can't play." PR #675 stopped admins falling back. But `STREET_TOWN` is admin-only
(`packages/app/src/town/admin-town.ts`), so every non-admin and guest still gets the old Canvas 2D town. This job makes the street
town everyone's town and takes the old town out of players' reach entirely.

## What to build
- `STREET_TOWN` for everyone (guests and players). `ADMIN_TOWN` keeps gating only admin-first bosses' homes and admin tools.
- Everything the old town did for players that the street town doesn't yet do: check it (bots, chat bubbles, homes and doors, the
  Colosseum, the minimap, AFK, music, the Hidden Boss's walk-up, guests' limits). List any gap in the PR body; fix the small ones.
- The old Canvas 2D town: unreachable for players by any path. Delete its code if nothing else needs it (preferred: less code, no old
  code to exploit); if something still does, say what in the PR body.
- Rework the town e2e specs that test today's town as a non-admin (start 22,17, park, lamps...) onto the street town. Keep each spec's
  intent. A spec that guards one of Eric's rules: keep the rule's check, move it onto the street town, and list it (old → new). 
- Frame rate: run the `@perf` town specs (phone) before and after; the street town for guests must hold the frame budgets.
- Decision note (short), the area page.

## Tests
Typecheck; app unit tests you touch; the town e2e specs on both projects under the e2e lock; `@perf` (phone). List every changed check
(old → new). Write `.pr-body.md`, push work in progress at each real step, then push `.done` and stop. Don't open PRs or wait on CI.
No model names in commits. About two hours.
