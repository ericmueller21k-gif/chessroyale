# Main red (FLAKY_RED) on 2e294655: stranger.spec.ts:98 (phone): the rift drawn before his first sword. Opus, high (animation timing).

Read `notes/briefs/rules-common.md`, `.claude/LESSONS.md`, the Stranger's area page and `packages/app/src/components/Stranger.tsx`.
Branch `claude/flake-stranger-rift` from `origin/main`. Main's run 46121764433, shard 5, `[phone] e2e/stranger.spec.ts:98`
"his Storm of Two Worlds on a phone…", line 232: `expect(rec.early, "nothing of the storm drawn before his first sword").toEqual([])`
received `["rift"]`; it passed on the retry. So once in a while the rift (the crack in the board) is drawn before his first sword. Eric has
complained of exactly this kind of slip ("the tornado before he even jumped", Nov 27): treat it as a player-visible bug until shown
otherwise. Find why the rift can start before the sword (a moment's start time, a frame that reads the next phase early, a lineAt/clock
race, a slow frame…); reproduce it (`--repeat-each`, `CPU_THROTTLE=4`, or the scene's clock stepped by hand) and fix the cause in the app
if a player could see it, else in what the test reads (never a longer timeout or a retry). Watch the opening frame by frame
(`npm run frames:boss` or the spec's record) before and after; one still or MP4 of the corrected opening for the director. Boss lane: no
review loop. Short PR body (plain words, changed checks old → new). Commit AND push `.pr-body.md` and `.done` (`git add -f`), check
`git ls-remote`, stop. About an hour.
