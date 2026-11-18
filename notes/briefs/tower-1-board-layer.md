# Battle Tower PR 1: the board layer (Nov 18). Opus, xhigh (legality for every boss), alone

Branch `claude/tower-board-layer` from main (after #801, the design, merged). Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/decisions/2026-11-18-battle-tower-design.md` (section 2, the board layer, and the build plan's row 1), `docs/areas/bosses.md`,
`packages/chess/src/bosses/base.ts` (`moveSquares`, the lifts) and Sawyer's edge helpers.

Build exactly the build plan's PR 1: `board-layer.ts` (marks per square, edge and piece; `layerStop`, `layerMoves` with the one
lift that always leaves a legal move, `followLayer`, `wearLayer`), Sawyer's edge helpers moved in, unit tests for every mark,
overlaps (the most restrictive wins), the lift, castling, promotion, en passant. **No boss moves onto it yet** (that's PRs 2-5), so
no boss battle changes: the boss kit and every boss's tests pass unchanged (Sawyer's helpers moved, not changed: his tests the guard).
Targeted lane. Done: `.pr-body.md` (under 30 lines, changed checks old → new) and `.done`; push and end. No PRs, no CI waits.
