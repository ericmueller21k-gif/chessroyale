# live-window.spec.ts:114 [desktop] passed only on its retry on main (Nov 18, after #803). Opus, high

Branch `claude/live-window-votes` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/hub.md` (the live window),
`docs/rules/eric.md` (is this spec a guard? then fix the app, or `.question`).

**What failed:** main's run on 8fc582a (shard 13), first try, line 140: the real match's line stayed "The match is on" for 90 s,
never `^(White|Black)'s crowd: \S+ \d+` (`components/LiveWindow.tsx` `realFrame`: ply > 0 with an empty `votes`). Passed on retry.
Unrelated to that merge (the boss board layer).

**Director's lead (check it, don't assume it):** `lobby.ts` `noteLiveVotes` stores `liveVotes.ply = board.history.length` when the
crowd's round settles, and `liveSummary` shows the votes only while `votes.ply === b.history.length`. If the board's history moves on
between (the other side's reply, a boss move, the bot fill), every report can carry an empty `votes`; `lobby-do.ts` `reportLive`
dedupes by `ply:votes.length` and throttles to `lobbyReportMs`. A real watcher would then see "The match is on" instead of the votes,
so it's likely a real app bug: fix the app (e.g. keep the votes for the move they're on, keyed by that move's ply, and show the latest
known), then make the test wait on the thing it means, not a longer timeout.
Prove it: reproduce (repeat-each on that test, desktop, under the shared e2e lock) or show the race in a unit test of `liveSummary`;
then the same passing. Typecheck; touched units. Done: `.pr-body.md` (under 25 lines, changed checks old → new) and `.done`; push, end.
