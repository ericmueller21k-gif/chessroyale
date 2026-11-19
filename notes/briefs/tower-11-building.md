# Battle Tower PR 11: the skyscraper in Chess Town, its lobby and clerk (Nov 19). Opus, high. Targeted lane

Eric approved the art (Nov 19: "looks good"), the floor number on both side walls and the back wall as drawn. Read CLAUDE.md,
`.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/town-square.md` (homes, shops, lots, rows), the art's README
(`git show origin/stills/battle-tower-building:README.md`: the lot, the calls, and **"For PR 11 (wiring)"**: floor tiles never `flip`,
the clerk's `tall: 57`, the 1 px seam right of the elevator, the tower's box) and the art on `claude/boss-art` (`scripts/boss-art/out/
house-tower`, `sidekick-tower-clerk`, `house-shop-tower`; `house-shop-tower-floor` is PR 11b's). Branch `claude/tower-building` from main.
Wire the town side only, the way the boss homes and shops are wired:
- **The skyscraper** on Colosseum Row's north side, columns 45-48 (the art's lot; its door square's lamp goes), the game writing
  "BATTLE TOWER" on its sign; walks, streets and the Colosseum's plaza unchanged; its card (tap the door): "Battle Tower", Go in.
- **The lobby** (a shop-like room, 37 px squares): the clerk ("Clerk" tag, Talk, `tall: 57`, nobody's kid), the elevator at the back
  (solid, decorative for now), the empty "Best floors" board. The clerk's Talk opens **`/tower`** (PR 10, built in parallel, owns that
  route and screen: don't build it; until it merges the link may 404 locally, that's expected).
- Not here: the floor room and the walk-in (PR 11b, after PR 10), anything on home.
- **Tests:** a focused check in the town's existing spec (the tower's door opens the lobby; the clerk's Talk links to `/tower`;
  the town's walks unchanged), `@perf` only if the drawing or frame loop changes (eric.md, the town square).
Effort high. Watch it frame by frame with real taps. Area page town-square.md (at most 5 lines). One still per platform for Eric at
the end. Done: `.pr-body.md` (under 40 lines) and `.done`; push and end. No PRs, no CI waits.
