# The Hidden Boss's cutscene (Eric's 17 lines), wired into the fight

Effort high (animation, timing). **Boss lane.** Branch `claude/recluse-cutscene` from main, then merge in `origin/claude/hidden-boss-cutscene`
(12b7265: the mockup: `RecluseCutscene.tsx`, the spotlight, the poof-and-land, `RECLUSE_CUTSCENE` settings, the 17 lines, ~104 s,
`npm run preview:cutscene`). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md`, and on branch `claude/director-notes`:
`notes/briefs/hidden-boss-house-NOTES.md` ("the cutscene between the adult form and the cyborg", "Eric's version", "Eric's big update").

## Build
- **Plays after his adult form is beaten and before the transformation**, solo and online: everything dims, the soft circular spotlight on
  the board's center, the ghost kid poofs in above the board, drops and his knees buckle; Eric's 17 lines, each its own typed box (two
  sentences: type, hold ~1 s, type; err slow); the kid fades; the man on his knees (a kneeling pose: add it to his sprite set); then the
  existing transformation (book, beam, chant lines, crack) carries on.
- **Music:** the cutscene's theme (`themes.json`; ask nothing: use what's there, the switching rules in `music.ts`).
- **Online:** the online job (`claude/recluse-online-phase2`, in parallel) adds a server hold `RECLUSE_CUTSCENE.holdMs` and an event
  `recluseCutscene` with its start time. Play the scene from that event online (everyone in sync) and set `holdMs` to the scene's length.
  If that job isn't on main yet, wire solo first, merge `origin/main` often, and wire online when it lands (say so in the PR body).
- **Paging:** his absorb line ("All game you leaned on an engine. Now see how you like it.") is cut off on the phone bar: page it as the
  chant lines are (`paced-line.ts`).
- **No skip button** unless the code already has one for cutscenes; the admin 🏆 doesn't skip it.
- The name never appears anywhere.

## Parallel jobs
The online phase 2 job owns the server, protocol and lobby; the child form job owns the first form. You own the scene, its sprite
poses and its timing, app side. Small, separate commits.

## Tests
A unit test for the scene's timeline (line timings from settings, total = holdMs); e2e: a solo fight with 🏆 on the adult form shows the
scene's first and last lines, then the transformation (a test switch may speed the scene up: test-only). `npm run frames:boss` on the
poof-and-land and the kneel. Typecheck. List changed checks (old → new). Push work in progress at each real step; write `.pr-body.md`,
push `.done` and stop. Don't open PRs or wait on CI. No model names in commits. Never stop silently.
