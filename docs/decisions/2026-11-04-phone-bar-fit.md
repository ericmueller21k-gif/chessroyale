# Every boss whole inside the phone's boss bar (Nov 4, 2026)

**Eric's words (Nov 4, an iPhone screenshot, Puddles):** the boss's arm and hose are cut off by the bar's left edge, and his meters
don't line up. Before, the bar let a figure hang out of its top and left edge (Oct 24, `2026-10-24-boss-bar-same.md`); this reverses that.

**Calls made (the helper's, for Eric to check):**
- Every rest frame (a loop's frames and the last frame of each one-shot) of every boss is inside the bar: 2 px in from its left edge,
  not above its top, not below its bottom padding. Mid-motion (a one-shot's moment) may still rise above the bar, as before.
- Figure size is capped by the bar's height at rest. Big animals keep 1/12 steps, at most 4/3: Puddles 14/12 (was 15/12), Moo & Moon 1
  (was 14/12), Babur 1 (was 16/12). Jefferson (0.93) and Dash (0.97) are a little smaller, since they are too tall for the bar at full size.
  Eric's Oct 24 words allowed a boss "a little smaller in the box sometimes".
- Horizontal: each boss's drawing shifts right (`barShift`), and the name column moves right by the kit's `barName` where the figure
  reaches past its usual place (89 px). Names no longer share one x; their y and the status stay as they were.
- Puddles' meters: the rage meter, then "Seeds 5" on its own line above a seed bar as wide as the rage meter (44 px), both at one x.
- Phone only. A computer's bar and the figure beside the board are unchanged.
- At 320 px the narrower room may wrap the status to two lines, or add a row to a bubble line, for the bosses whose name column moved
  (never four rows). Eric's call if he wants it otherwise.
- At 320 px, a name column moved right leaves the free room at most 65 px (Smudgy). The check "room to draw in ≥ 80 px at 320" is now
  ≥ 60 px for those bosses only (e2e/boss-bar.spec.ts). Reaching 80 would have meant a figure about 15% smaller at 320 px only.
