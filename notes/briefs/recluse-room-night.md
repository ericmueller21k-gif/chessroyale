# The Hidden Boss's building follows the town's time of day (Eric, Nov 14)

Effort high (drawing). Light/targeted lane. New branch `claude/recluse-room-night` from `origin/main`. Read
`docs/areas/town-square.md`, `.claude/LESSONS.md`, CLAUDE.md "Simple beats flashy". Never write the Hidden Boss's name anywhere
(player text, commits, PR text): the code's `recluse` ids are fine.

Eric (screenshot of the child's room on the top floor, the window full of sun, a sun patch on the rug): "it's always light in that
room, and it should be according [to the time of day]: the outside shining should be like a moon at night."

- The town already has a time of day: `packages/app/src/town/sky.ts` (`skyWeights(minutes)`: dawn, day, dusk, night from the
  device's clock; `?sky=day|dawn|dusk|night` overrides it; `render.ts` ~962 reacts when the look changes). Interiors don't use it yet.
- Make his top-floor room (`shops/recluse-art.ts`, the window ~line 56 and the sun's two panes on the floor ~135-160) follow it,
  reusing the same weights (no second clock):
  - day: as now;
  - dusk/dawn: warm low light, the window's sky orange/pink, the floor panes longer and warmer and dimmer;
  - night: a dark blue sky with a moon and a few stars in the window, a lit window or two in the brick building across the street,
    the floor panes pale cool moonlight (dim), the room itself darker overall (a gentle tint, not black: the kid, the board and the
    rug must stay easy to see).
  - Prefer the cheapest way that looks right: e.g. a few pre-drawn window variants plus a tint over the room and a recolor of the
    floor panes, chosen when the look changes, not per frame.
- The stairs' hall and landing (`shops/recluse-stairs-art.ts`, the landing's window ~219, its light ~333) follow it the same way
  (a darker window at night; the sconce still lit).
- The summoning scene in that room (`shops/recluse-scene.ts`: its spotlight and light beats) must still read right at night; check it.
- Mockup first: stills of the room and the landing at day, dusk and night (`?sky=`), phone and computer, pushed to branch
  `stills/recluse-room-night` (never commit images under docs/). Then build it in the game, the same branch.
- Frame rate: the drawing changes, so measure the town's room frames once (`npx playwright test --grep @perf --project phone`
  for the town square's perf spec, under the shared e2e lock), before and after, in the PR body.
- One focused check added to an existing spec (or a unit test of the look -> window/tint choice), not a new spec file.
Typecheck; unit tests of packages you touch. Push at each real step; `.pr-body.md` (short: what changed, player-visible, checks old ->
new, perf numbers); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only).
About an hour.
