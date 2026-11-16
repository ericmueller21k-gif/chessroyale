# Review: Chandy's rules (PR #739, branch claude/chandy-rules). One quick pass (boss lane), read-only. Opus, high

About 30 to 45 minutes. Read `CLAUDE.md` (the boss lane), `docs/areas/bosses.md` ("The ground rules of every power", "Adding a
boss"), the spec `git show origin/stills/boss-chandy:DESIGN.md`, the build brief `notes/briefs/chandy-rules.md` (on
`claude/director-notes`), then the diff `git diff origin/main...origin/claude/chandy-rules` and `reports/chandy-sim.md`.
No fuzz marathons, no sims, no code changes.

Look for real bugs only, ranked:
- a battle that breaks or hangs (solo, online, a raid): Dodge's vote and its timing (server time, 300 ms grace, no votes = random from
  the seed, a hit ends the battle for everyone), the queen lock's pass under the pass guard (the sim saw it held 39 times in 9
  battles: can the meter stall forever?), the upgrade window's held clock;
- an illegal or engine-refused position, or a crowd left with no legal move (beam walls, scatter squares, shields, dizzy pieces, the
  queen lock's forced move): every power must lift rather than leave none;
- solo vs online disagreeing; anything the server sends that a player shouldn't see (Dodge's safe square before the vote closes);
- the engine steering: a margin that makes him play clearly bad moves; only capturing a LOCKED piece upgrades;
- anything that touches other bosses (shared runner, protocol, refused.ts, the boss bar's second meter row, SIDE_FEEL changes,
  `town-player.test`'s admin-first change) or players (he must stay admins-first);
- the sim: the crowd's score 0.12 against the other bosses' (is that "in the pack" or too hard?).
Each finding: file:line, the failing case, a fix in one line.

Write `review.md` (at most 1 page: verdict, findings by severity, what you checked) to the orphan branch `review/chandy-rules` and
push. End commits with the Claude-Session line only, no model names.
