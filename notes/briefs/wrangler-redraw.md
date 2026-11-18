# Wrangler: redraw his lasso throw and pull (in battle and in his intro) so he looks at what he ropes. characters lane. Opus, high

Branch `claude/wrangler-redraw` from main. About 1.5 h. Read CLAUDE.md, `.claude/agents/characters.md`, `.claude/LESSONS.md`,
`docs/areas/bosses.md` (Wrangler), `docs/decisions/2026-11-17-wrangler-board-facing.md` (#781, merged: his figures now turn by the
shared rule; it noted "in the lasso pose his snout leans away from the rope"). Art by the paid API runner (branch `claude/boss-art`,
`scripts/boss-art/run.ts`, Opus), never by hand. Cap $12; give the estimate first; log each run's cost.

**Eric, Nov 18 (word for word):** "redo Wrangler's throw, because I was never going to mention it, but if you watch when he does it,
he kind of looks the wrong way and pulls. It just looks weird. We want it to look actually normal when he does his wrangle and he
pulls. I'm saying this for in game, but also when he does his startup animation, when he wrangles the chessboard, it still looks
weird the way he does it. So have a look at that too."

1. Watch every frame of his lasso throw, the haul/pull (in battle, phone and computer) and his intro where he lassos the board
   (`npm run frames:pig`, now fixed by #781). Note each frame where he looks away from the rope or pulls the wrong way.
2. Redraw those poses with the API runner from his finished art: he looks at the rope/target while he swings and throws, and leans
   back against the rope when he pulls (feet planted, rope taut from his hands toward the piece/board). Keep his palette, size and
   feet points so placement (`CATCH`, the haul's fists, `SIDE_REACH`, `barShift`) still holds; re-measure what the tools measure.
3. Wire the new frames; the facing rule from #781 stays (no per-boss flags).
4. Checks: the existing pig/king-attack/boss-side specs stay green; one focused check that the lasso's loop and the rope start at
   his hands in the new frames. Boss lane (+ the boss kit). Stills/GIFs for Eric on `stills/wrangler-redraw` (never docs/): throw,
   pull, intro, before and after, phone.

Done: `.pr-body.md` (under 50 lines) and `.done`, end. Blocked on Eric only: `.question`. No PRs, no CI waits.
