# Wrangler's figures on the board: facing by the shared rule. characters lane. Opus, high (rendering)

Branch `claude/wrangler-board-facing` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/decisions/2026-11-17-boss-facing.md`
and `2026-11-17-pm-caster-mirror.md` (both merged today), `docs/areas/bosses.md` (facing).

**Why:** today's facing work (#774, #777) put every boss's art facing in one place (`ART_FACING` in sprites.ts / `drawnFacing`, judged
Wrangler's art as facing **left**; the Nov 8 note said "front, leaning left") and one rule (`placeFacing`). The #777 helper flagged, unchanged,
that `components/Pig.tsx` still draws Wrangler's own figures on the board with a hand-set flip that assumes his art faces right:
`Figure` ("facing right (or left, `flip`)", `scale: "-1 1"`), `lassoStand` (`flip` from the walk's direction), the lasso walk
(`goingBack ? true : stand.flip`) and the showdown (`flip={false}`). If the art faces left, he may walk/haul backwards on the board.

1. Check frame by frame with real taps (`npm run frames:boss`, his lasso and showdown, phone and computer): which way he faces while
   walking to the piece, hauling, and walking back. Eric's rule: a boss faces the way it walks / what it acts on.
2. If wrong, fix through the shared data (`facingOf`/`placeFacing`/`drawnX`), not a new per-boss flag: the flip becomes "mirror when the
   art's facing differs from the direction he walks/acts". Check the lasso's catch point (`CATCH`) and the rope still come from his hands.
3. If already right, say so with the stills and change nothing.
4. One focused check in the Wrangler/pig spec (he faces his walk direction), stills on `stills/wrangler-board-facing` (before/after),
   targeted lane.

Done: `.pr-body.md` (under 30 lines) and `.done`, end. No PRs, no CI waits.
