# Review: the Hidden Boss's hearts (PR #744, branch claude/recluse-hearts). One quick pass (boss lane), read-only. Opus, high

About 30 minutes. Read `CLAUDE.md` (the boss lane), `docs/areas/bosses.md` (his phase 2), the brief `notes/briefs/recluse-hearts.md`
(on `claude/director-notes`), then the diff `git diff origin/main...origin/claude/recluse-hearts`. Never write his name in anything
you push. No fuzz, no sims, no code changes.

Real bugs only, ranked: a phase 2 board that hangs or a battle that never ends (a player out of hearts, out of time, a bot's hearts,
a reconnect mid-slash, the pause); solo vs online disagreeing; the server's 6.5 s judged from the right moment (when the board became
that player's, not when the client saw it; the boss's own think time not counted against them); the hidden allowance leaking into any
player-visible text; the "+N" layer change (`body > .dk-plus`) breaking any other mode's clock or covering a sheet/menu it shouldn't;
removed fields (`slow`, `lastSlow`, `ultAt`) still read anywhere (an old client, the FAQ, the results); per-frame cost of the slash.
Each finding: file:line, the failing case, a fix in one line. Write `review.md` (at most 1 page) to the orphan branch
`review/recluse-hearts` and push. Commits end with the Claude-Session line only, no model names.
