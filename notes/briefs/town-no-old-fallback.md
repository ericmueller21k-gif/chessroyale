# The town never falls back to the old town (Eric, Nov 13)

Effort high (rendering, WebGL context handling). **Targeted lane.** Branch `claude/town-no-old-fallback` from main.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/town-square.md`.

## What happened
Eric, signed in as admin on his iPhone, Nov 13 ~07:40 UTC, saw the old Canvas 2D town (night, plain checkerboard, Big Boy's Crib and
Sawyer's Woodshed with no streets, no plaza): "How is the town broken? ... it's the old version ... That's a major concern." The live
build was main's (04296293); nothing was rolled back. Cause (very likely): `Town.tsx` `leaveStreet` (Nov 6): the street town's WebGL
context lost twice within a minute, or not back within `LOST_WAIT_MS`, or failing to start, reloads the page at `/town?street=off`,
today's old town. iOS Safari drops WebGL contexts when the app goes to the background or under memory pressure, so two app switches in
a minute can do it.

## What to build
- **Never show the old town to a player.** Remove the `?street=off` fallback for players (keep the param only for tests/admins if the
  e2e needs it; say which).
- **A lost context while the page is hidden doesn't count** (iOS backgrounding): wait for it to come back after the page shows again.
- **A context that doesn't come back**, or WebGL failing to start: reload the street town once (a plain reload of `/town` without the
  param); if it fails again, a plain message in the town's box, "The town couldn't load on this device. Reload" with a Reload button,
  nothing else. Keep reporting each case once (`reportTownFallback` reasons: rename or add as needed, `health.ts` counts).
- Simple beats flashy: the least code. If the old Canvas 2D town's code is then unused by players, leave deleting it to a later
  cleanup unless it's trivial; say which in the PR.
- Decision note (about five lines), the area page.

## Tests
A unit or e2e check for the loss rules (hidden losses ignored; a loss not back → one reload without `street=off`; a second failure →
the message), using the existing lost-context hooks in tests if there are any (`WEBGL_lose_context`). Typecheck, the app unit tests
you touch, the town spec that covers the fallback. List changed checks (old → new). Write `.pr-body.md`, push work in progress at each
real step, then push `.done` and stop. Don't open PRs or wait on CI. No model names in commits. About an hour.
