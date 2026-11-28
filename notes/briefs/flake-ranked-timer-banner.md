# Main red (FLAKY_RED) on 13320d59: ranked-1v1.spec.ts:141 (phone): the "Timer: Blitz 3+2" banner not seen. Opus, medium. Targeted.

Read `notes/briefs/rules-common.md` (and `.claude/LESSONS.md`: a random position's moves are never assumed; watch frame by frame).
Branch `claude/flake-ranked-timer-banner` from `origin/main`. Main's run on 13320d59, shard 5, `[phone] e2e/ranked-1v1.spec.ts:141`
"two players: one tap to queue, the vote on the game's own board…", line 202: `expect((await overlay.seen()).timer).toBe(true)` got
false, then passed on the retry. So once in a while the "Timer: Blitz 3+2" banner over the board was not seen. Find out whether a
player could miss it (the banner skipped, cut short or covered when the vote ends at a certain moment) or only the test's watcher misses
it (it starts after the banner, a frame it doesn't sample). Reproduce (`--repeat-each`, `CPU_THROTTLE=4`); fix the app if a player could
miss it, else what the watcher waits on (never a longer timeout or a retry). Short PR body (plain words, changed checks old → new).
Commit AND push `.pr-body.md` and `.done` (`git add -f`), check `git ls-remote`, stop. About 45 minutes.
