# Fix main: town-controls.spec:347 (minimap) passed only on retry: a held arrow key didn't move you within 5 s (Nov 25). Opus medium

Main 025406c (#926, crates page tidy: not town code) went red by FLAKY_RED: `[phone] e2e/town-controls.spec.ts:347` "the minimap: ...",
run 45503476042, shard 10: `arrowStep` (line 175) `page.waitForFunction(dataset.you !== from, {polling: "raf", timeout: 5000})` timed out
after `drag(page, 0.5)` (a look round a quarter) and `expect.poll(dot.deg === 90)`: a held ArrowUp didn't leave the square in 5 s. The
retry passed (56 s on a slow runner). The renderer watchdog (30 s) didn't fire.

Find the cause ("flake" is not a cause): e.g. the key going down while the look-drag's hold/turn is still settling so the first step is
swallowed; a keydown landing before the town's focus/keyboard listener is ready after the drag; the camera's base-lock re-reading the key;
or the town's frame loop starved. Reproduce (phone project, `--repeat-each`, CPU throttling via CDP 4-6x), fix it at the cause in the app
(or in the test only if the test's own timing is wrong and the app is right, with the reason written down), prove it with repeats. Start:
`git fetch origin main && git checkout -B claude/fix-town-arrowstep origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md` (guard tests), `docs/areas/town-square.md`. Decision note (about five lines). PR body in `.pr-body.md` (cause, fix,
changed checks old → new). `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
