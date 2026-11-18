# Big Boy: a tower turn alters the board only when a block takes a move away (Eric's (b), Nov 18). Opus, xhigh (fair play + the Last Stand)

Branch `claude/bigboy-powerturn` from main. About 1-1.5 h. Read CLAUDE.md, `.claude/agents/fairplay.md`, `.claude/LESSONS.md`,
`docs/decisions/2026-11-18-bigboy-tower*.md` (the balance note's fair-play proposal and the review's Last Stand note), `docs/areas/bosses.md`
(Big Boy; the boss template's `powerTurn`), `docs/areas/fairplay.md`.

**Eric, Nov 18:** "B seems like the obvious choice". The choice: today the tower or its blocks stand nearly every turn from turn 2, so nearly
every turn is a power turn (no fair-play signal) and a Last Stand sit-out (`boardAltered`). (b): a tower/scatter turn counts as a power turn /
altered board **only when a block actually removes a legal move** (the crowd's for fair play; for the Last Stand, the one it would replay).
`powerTurn` needs the position (a `BossRules` interface change: do it so every other boss is unchanged). Keep it the same solo and online.
Tests: a turn with a tower that takes no move away counts for fair play and allows the Last Stand; one that does, doesn't; other bosses
unchanged (boss kit). Full lane for fair play: the director runs the review. Typecheck; chess/server/app tests touched; e2e bigboy phone.
Done: `.pr-body.md` (under 40 lines) and `.done`, end. No PRs, no CI waits.
