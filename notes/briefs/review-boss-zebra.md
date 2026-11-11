# Review: Don Dough (PR #627, branch claude/boss-zebra). One quick pass (boss lane), read-only. Opus, high

About 30 minutes. Read `CLAUDE.md` (the boss lane), `docs/areas/bosses.md` ("Adding a boss"), Eric's words `notes/zebra-eric.md`
and the build brief `notes/briefs/brief-zebra-rules.md` (both on `claude/director-notes`), then the diff
`git diff origin/main...origin/claude/boss-zebra`. No fuzz marathons, no sims, no code changes.

Look for real bugs only, ranked: a match that breaks or hangs (solo, online, a raid); an illegal or engine-refused position (a rise,
the gold filter and its lift, the judge/bots over the filtered moves); solo vs online disagreeing; the timers or dough drawn wrong or
shifting the layout (phone/computer, 50 v 50); per-frame work; anything that touches other bosses (the shared `speech.tsx`, `Battle.library`,
`BossPowers` multi-part lines, the board's `gold` prop); Eric's words not followed (timer per move, one minute each side, squash by
landing, Gold Plate ~10 s and its line, opening comment once). Each finding: file:line, the failing case, a fix in one line.

Write `review.md` (≤ 1 page: verdict, findings by severity, what you checked) to the orphan branch `review/boss-zebra` and push.
