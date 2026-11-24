# The Boss Battle screen's minutes-long hang in CI (Nov 24). Opus high, targeted lane, an investigation that ends in a fix

Main went red on 2857732 (FLAKY_RED): `[desktop] e2e/boss-bar.spec.ts:301` "a computer: the boss bar is the board's width…" ran 5.1 min
and hit the test timeout. It was stuck in `openSoloBoss` (`e2e/helpers.ts:651`): after the home's "Boss Battle" button is clicked,
`expect(heading "Boss Battle").toBeVisible()` (a 5 s expect) never returned, then "Target page, context or browser has been closed". It
passed on retry in 11.8 s. Run 45383358676, shard 4 (job 138408159734); the first try keeps no trace.

This is the second time. Nov 20, main 72291bb: `[phone] e2e/moo.spec.ts:453` hung 3.7 min at the same wait (the "Boss Battle" heading
after the third `goto`), no trace; 0 of ~20 local repros; it wasn't the moonrise assets (branch `claude/fix-moo-flake`, notes STATUS Nov 20
~16:00). The director's Nov 20 call: "if a 'short expect runs for minutes, no trace' pattern recurs, add a CDP snapshot on step overrun".
A 5 s expect that runs for minutes means the page's main thread didn't answer: a renderer hang (an endless or pathological loop on the
app's side, or the browser stuck), not a slow test. If it's the app, a player's phone could freeze the same way, so it matters beyond CI.

Start: `git fetch origin main && git checkout -B claude/boss-screen-hang origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/ops.md` ("CI e2e"), `docs/areas/hub.md` and the screens the Boss Battle button opens.

1. **Find the cause.** Read what runs between that click and the heading (the Boss Battle screen and everything it mounts: boss tiles,
   the stage, sprites and their frame trimming/decoding, the "?" random pick, the party spots, any fitting/measuring loop, `while`
   loops, retries, recursive renders, effects that set state every render). Look for anything that can spin without end or for minutes
   under a timing or data case (both hangs followed several `goto`s in one test: a viewport loop and repeated loads). Try to reproduce:
   the two tests in a loop with `--repeat-each`, CPU throttling via CDP (`Emulation.setCPUThrottlingRate` 4–6), the CI's Chromium if it
   differs (`docs/areas/ops.md`), under the shared e2e lock (`flock /tmp/claude-0/e2e.lock`). Keep runs bounded (about an hour of runs in
   all).
2. **If you find it:** fix the cause in the app (or in the test helper if the hang is truly the test's own doing, e.g. a click landing
   before the home is ready AND the page then spinning), with one focused unit or e2e check that fails before the fix. Decision note
   (about five lines), area page if it changes how something works.
3. **If you can't find it within the budget:** add the diagnostic the director called for on Nov 20: when a test step overruns (an expect
   or action taking more than, say, 30 s), the e2e helpers take a CDP snapshot first (`Runtime.evaluate` with a timeout and, if that
   fails, the renderer's stack via `Debugger.pause` + `Debugger.paused` call frames, or a `Profiler` sample), and attach it to the test's
   result, so the next hang names the code. Keep it small and in `e2e/helpers.ts` or the fixture; no extra time on passing tests.
   Say clearly in the PR body which of the two this is.
4. PR body in `.pr-body.md` (cause found or not, what changed, player-visible, changed checks old → new). Then `.done`, push, stop. Don't
   open PRs or wait on CI. Helpers reset, never revert. Commits end with only
   `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model names). American English.
