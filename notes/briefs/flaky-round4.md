# Flaky round 4: fix the causes (Eric, Nov 13: "fix the cause, not add a checker")

Effort high. New branch `claude/flaky-round4` from `origin/main`. Read CLAUDE.md "Fix the cause, not add a checker",
`.claude/LESSONS.md`, `docs/decisions/2026-11-14-flaky-causes.md` and round 3's notes (git log --grep "flaky" on main; `settled()` and
`Press.up(key, at)` from #705). For each: **is the game wrong, or the test?** Game first. Guard tests in `docs/rules/eric.md`:
game-side fixes only; if the test is at fault, write the proposed change in .pr-body.md (Eric's OK needed), don't change its checks.

Look for a shared cause first: several of these are "a town figure wanders between reading its point and the click".
1. **sound.spec.ts:61** [phone] "coming back from another app…": Big Boy wanders behind or in front of his crib (or your pawn) between
   `__townAt('boss','bigboy')` giving the point and the click; the tap opens "Big Boy's Crib" instead of his card. Fails 1 in 3 on main
   locally (`--repeat-each 3 --retries 0`). Error seen: "Big Boy drawn".
2. **town.spec.ts:1049** [desktop] "tables full: a bot's Play is greyed…": "bot 9 is drawn" (new, Nov 14 run 43585687715 shard 2).
   Probably the same wander/point race.
3. **town-street.spec.ts:155** and **town-street.spec.ts:528** [desktop] "the Hidden Boss's walk-up…" `not.toBeNull()`.
4. **hidden-boss-room.spec.ts:313** [Eric's guard: game-side only].
5. **alfil.spec.ts:247**.
6. **town-chat.spec.ts:1367 / 1370** [phone] "two signed-in players see each other's lines…" `toHaveCount`.
7. **fairplay.spec.ts:65** [phone, Eric's ban guard]: after clearing cookies+storage, `/` showed the guest home instead of the landing.
8. **shop.spec.ts:238** [phone] "?fps in a room… going out": read 4 vs > 4.
Get the current list of retry-passes and failures from main's last few full runs first (the `result` job lists flaky tests with
shard and file:line; `gh` isn't available: read the run's annotations through the public API,
https://api.github.com/repos/ericmueller21k-gif/chessroyale/commits/<sha>/check-runs then /check-runs/<id>/annotations) and add any
new ones. Do 1-4 for sure; the rest as time allows (list the rest under "Not done"). Prove each fix (`--repeat-each 3` locally on the
project that failed, before and after where reproducible). Typecheck; unit tests of packages you touch. Push at each real step;
`.pr-body.md` (a table: test, game or test, cause, fix; checks changed old -> new; Eric's OK needed for any guard change); `.done`.
No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1.5 hours.
