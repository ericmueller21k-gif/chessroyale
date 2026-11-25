# Boss alone and a raid on a computer: the shared frame (Nov 26)

This branch holds stills only (the code is on `claude/boss-frame`).

## mock/ (before building)
Main's live boss screens (Puddles, the first move) with the frame's CSS (`packages/app/src/board-size.css` as on the branch) injected and
the `bf-frame` class added (`mock/mock-boss.spec.ts`; `CSS=… TAG=mock`; without `CSS` it takes the `before-` stills).
- `mock-boss-alone-1536x730.png` (125%, Eric's laptop) and `-1920x960.png`: Boss alone. The boss's column (where he stands), the board with
  the two-line boss bar over it (kept: Eric, Nov 26) and the column beside it, centered as one block, 28 px either side of the board. The
  Moves panel runs from the board's top line down to 12 px over your pawn's and the God King's heads; they stand on the board's foot, their
  places and sizes unchanged (placed from the board). The gear right, level with the bar. Board 602 / 832 (unchanged).
- `mock-boss-raid-1536x730.png` and `-1920x960.png`: a bot raid. The scoreboard's table from the board's top to its foot ("THE CROWD" in the
  bar's height), the board, the Moves panel down to over the God King's head. Gaps 28 / 28.
- `before-boss-*.png`: main today, for comparison (the Moves panel stops halfway; 38 / 16 px either side of the board in Boss alone).
- His words open over the panel's foot for their few seconds (they're on top; nothing under them needs a tap).
