# Flake on main 1e1fe3a: Squads' "Cheat lines" drew 2 arrows, not 3. Opus, medium. Targeted

Read `notes/briefs/rules-common.md` first. Branch `claude/flake-squads-cheat` from `origin/main`. Main's run on 1e1fe3a, shard 5,
`[phone] e2e/squads-test-tools.spec.ts:42` at `:84` `expect(arrows(page)).toHaveCount(3, { timeout: 30_000 })`: over 30 s the count
was 0 (4 polls), 2 (20 polls), 0 (9 polls), never 3; passed on the retry. Find why only 2 of the top 3 lines show (a position with two
moves only? two lines sharing an arrow (same from-to) drawn as one? the engine answering MultiPV 2 under load, or a deadline cutting
the third? the arrows cleared and redrawn as the Relay turn moves on?). Fix the cause: the app if a third line is lost or merged
(say what the player sees), the test if the position legitimately has fewer than 3 distinct arrows (then assert what the app promises).
Reproduce slowed and show the fix holding. Push, `.pr-body.md` (short), `.done`. Commits end only with your Claude-Session line.
