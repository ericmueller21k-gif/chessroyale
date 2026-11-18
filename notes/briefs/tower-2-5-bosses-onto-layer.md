# Battle Tower PRs 2-5: today's bosses onto the board layer, one family a PR (Nov 18). Opus, xhigh, alone, one PR per run

Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-18-battle-tower-design.md` (section 2 and build-plan rows 2-5),
`docs/decisions/2026-11-18-board-layer.md` (PR 1's calls and **the list of places today's code differs from the layer**),
`packages/chess/src/board-layer.ts`, `docs/areas/bosses.md`.

The families, in order (one per run, its own branch and PR):
- **PR 2, held pieces** (branch `claude/tower-layer-held`): Ginger, Moo, Folio, Chandy, Boingo: each `held`.
- **PR 3, square marks** (`claude/tower-layer-squares`): Boingo's pies, Big Boy's `toyStops`, Puddles' plants, Chandy's scatter and
  beam, Don Dough's lumps.
- **PR 4, edges** (`claude/tower-layer-edges`): Sawyer's `crossesCut`, `crossesMiddle`, `sawStops`; Folio's `crossesCrease`.
- **PR 5, shields** (`claude/tower-layer-shields`): Don Dough's `pawnOnGold`, `zebraStop`; Chandy's shields.

**The rule: no boss battle changes, not one move.** Each boss's power writes its marks into the layer and the dispatcher reads
the layer, instead of the boss's own check. Prove it with a **twin test**: for every move in a broad set of real positions
(seeded battles, every boss in the family, solo and the server's path), the old check and the layer agree exactly. Where PR 1's
note lists a difference (e.g. Boingo's own moves check `to` only; Don Dough's gold lets en passant through; a toy block counts a
castling rook's corner; `heldIn` misses a Chess960 castling rook), keep **today's behavior** (a mark option, `binds`, or the
boss's own extra rule) unless it's a plain bug, and then: fix it only if the fix is obviously right and tiny, list it in the PR body
as player-visible, and say so in its decision note; anything bigger goes to the director as a question, not a change. Delete the
boss's old check once the layer replaces it (no two paths left; CLAUDE.md "fix the cause").
Checks: the twin test (it stays as the guard), the boss kit, each family boss's tests, the server's boss tests, parity. Boss lane.
Keep it lean (usage is high): only the tests you touch, no full suites. Done: `.pr-body.md` (under 30 lines: what moved, any
behavior change (ideally none), changed checks old → new) and `.done`; push and end.
