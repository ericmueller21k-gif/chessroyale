# Town: a tap on an arrow key moves one square, not two. Opus, high (walking animation and timing). Targeted lane

Branch `claude/town-key-tap` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md` (watch any move or animation change frame by
frame with real taps), `docs/rules/eric.md` (the town's guards), `docs/areas/town-square.md`.

**Eric, Nov 17:** "feel like we should also make when you tap on keys u only move 1 square in the town, not 2".
**Cause (the director's read):** `packages/app/src/town/arrows.ts` `keyWalk` starts a step on the press; `Walker.begin`
(`packages/app/src/town/world.ts`) asks the runner for the next square **as the step begins** ("so a held key runs on with no stop"),
and a tap is still held at that moment, so a second square is queued: a tap walks two.
**Do:** a tap (pressed and released within a step) walks exactly one square and eases to a stop there; a held key still walks on with
no stop or jolt between squares, and stops after the step it's on once released (as now). Pick the simplest way that keeps the
easing smooth (e.g. decide the next square near the step's end rather than at its start, or drop a key-queued square if no key is
held when the step ends, with the step's ease-out right): no position jump, no hitch on the second square of a held walk. The same
for the on-screen arrows and WASD, in the town and inside shop rooms (`keyWalk` is shared).
**Checks:** a unit test in the town tests (a short tap → one square; held across two step-times → two or more, no stop between);
the town's arrow-key e2e if one exists (`e2e/town*.spec.ts`: say which, old → new); watch it frame by frame (`npm run frames:...`
or a quick capture) for the ease. If any guard in `docs/rules/eric.md` covers the arrows' walk, don't edit it: report it. Push;
`.pr-body.md` (short) and `.done`. Commits end with the `Claude-Session:` line only, no model names. No PR, no waiting on CI.
