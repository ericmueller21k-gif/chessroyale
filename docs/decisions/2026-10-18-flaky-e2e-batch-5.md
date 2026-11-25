# Two flaky e2e tests: an evaluate held over the engine, and a check that moved Sawyer's saw (Oct 18, 2026)

CI's `e2e` run listed these as flaky (they passed only on the retry). Each was traced from CI's logs and the failing
tries' page snapshots (the HTML reports keep `error-context.md` for the failing try; only the retry has a trace), then
checked locally. No assertion was loosened, skipped or given a longer timeout, and no sleep was added. Both were the
tests' own doing; the game is right in both. A third cause, a real one in the game, turned up while the Sawyer test ran
locally: see the end.

## The engine awaited inside an evaluate: `crowd.spec.ts:178` "Crowd 50 v 50: plays your team's turns…" (phone)

- **Seen:** "page.evaluate: Execution context was destroyed, most likely because of a navigation" at line 195, 4 times
  in the last 59 CI runs (Oct 17-18: runs 38987376526, 39082415012, 39121951999 on #275's e4579a0, 39128935054 on
  #277's 2734d28). The failing try's page (39121951999) is the Black team's first move, "0/49 picked", the clock still
  on 20 s: no navigation, the page carrying on.
- **Cause:** the test awaited the engine's search inside `page.evaluate` (`await Promise.race([m.runner.topMovesFor(fen),
  12 s])`), holding a `Runtime.callFunctionOn` open while the page works. Playwright reports any protocol failure of
  that call as "Execution context was destroyed…" (`rewriteError` in its `crExecutionContext.js`). It's the pattern
  `.claude/LESSONS.md` names ("A navigation that never happened", Oct 9), which listed this test as still to move.
- **Fix:** the test uses `engineTop(page, "judged", 12_000)`, which starts the search in the page, keeps its answer on
  `window` and polls for it, so no evaluate stays open over a search. Same 12 s for the engine, same fallback after it
  (a teammate bot's planned pick, in the same position), as `formats.spec.ts` already does.
- **Local runs** (phone, 4 workers on 4 cores, no retries): the old test and the new one side by side, 10 each: 10 of 10
  passed for both (the old failure didn't come up locally); the new one 10 more: 20 of 20 in all. CI had it 4 in 59.

## A check that left no edge to saw: `sawyer.spec.ts:192` "Sawyer's board saw (?power=boardsaw)…" (desktop)

- **Seen:** on #277's run (2734d28), no SAW CUT! banner on the 4th turn. The failing try's page, at "move 4", says
  "Your king's in check! Answer it." The same test failed on main at 7807feb (run 39083777037) a turn earlier, its
  allowed moves `undefined` under the board saw; that page, at "move 3", says "Check! Shield the king."
- **The rule:** a saw cut goes on an edge between two squares of the crowd's half that one of its legal moves crosses
  straight (`chooseCut`); with none, it waits a turn (`passive` in `bosses/sawyer.ts`). A limit that stops none of the
  crowd's moves, or would stop them all, gives no allowed moves (`crowdAllowed`: null, every legal move is).
- **Cause:** Sawyer's reply gave check. A check leaves only a few answers: when they are all diagonal, a knight's or
  outside the crowd's half (a king taking on f2, say), there is no edge for the cut, so it came on the 5th turn; when
  they all stay on one side of the middle, the board saw stops none of them, so there are no allowed moves. The test
  assumed the 4th turn and a list of allowed moves whatever the position. Checked on such a position
  (`rnb1kbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1qPP/RNBQKB1R w`, only Kxf2): `chooseCut` null, `crowdAllowed` under the
  board saw null; on an ordinary 4th-turn position from a local run, an edge and a list.
- **Fix:** the test expects what the rule says in the position reached. Under the board saw: the allowed moves never
  cross, or, with none, every legal move is on the same side (none crosses, or all do). The cut: after each of the
  crowd's moves from the 3rd, if there is an edge for it (`chooseCut` on the position), the cut is on the board from
  that turn for `sawTurns`; if not, there's no cut yet and it plays on (within three turns of the saw's). Then the
  banner and its caster, watched from before the 3rd turn's move, as before.
- **Local runs** (no retries): before, 0 of 60 failed this way (both projects, 4 workers: every 4th-turn position had an
  edge; CI had it 2 in 75); a copy of the old test against a Sawyer patched to give check when he can, 0 of 6 (he
  rarely could). After, at CI's load (2 workers, as Playwright gives a 4-core runner), 40 of 40 passed, both projects.
  The new branches are checked on the rules, on the position above, not live: forcing a real check on the 3rd or 4th
  turn in the app didn't work.

## Found on the way, not fixed here: the big saw's sound skipped on a slow frame (a game bug)

- **Seen locally**, only with 4 workers on 4 cores (twice the load CI gives), never on CI: every check passed but the
  sounds, which had no `sawyerBigSaw` (the big saw's run was seen on screen). 1 of 60 before the change, 1 of 6 for the
  old copy, 5 of 40 after it (a busier stretch of the machine: one of those runs also missed the board's 280 ms jolt,
  so a frame of over 280 ms). At CI's load (2 workers): 0 of 40.
- **Likely cause** (from the code, not yet watched frame by frame): the big saw's sound is the cue of the `boardSaw`
  animation's first frame (90 ms, `characters/sawyer.ts`). The figure switches from `rev` to `boardSaw` by remounting
  (`Figure`'s key in `components/Sawyer.tsx`), and a new `SpriteAnim` plays only the cue of the frame it first draws
  (`framesSince` with no frame before). When that render comes more than 90 ms after the run's start, the first drawn
  frame is the second, and the sound never plays. A slow phone would miss it the same way.
- **Why not here:** it's the boss's animation and sound code (its own lane, watched frame by frame before it changes),
  and this PR is tests only. Handed to the director with this note.
