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

## The build (root)
`stills-boss.spec.ts` takes them: Boss alone and a bot raid (Puddles, your first move) at 1536 × 730 (125%), 1920 × 960 and 1858 × 1040,
plus the phone at 390 × 844 (unchanged). In every computer still the left column (the boss's column; a raid's scoreboard table), the board
and the column start on the board's top line and end on its foot, 28 / 28 px either side of the board. The Moves panel ends 12 px over the
God King's frame (the room his tallest pose needs: the eric.md guard keeps every figure off the list's text), so it is taller than main's
(Boss alone 228 → 300 px at 1536 × 730, 343 → 480 at 1920 × 960; a raid 228 → 390, 343 → 620) but not the board's whole height.
Boards: 602, 832, and 912 / 912 at 1858 × 1040. The figures stand where they did against the board.

## mock/ v2 (the director's review, Nov 26): the raid
- `mock-boss-raid-1536x730-v2.png`, `-1920x960-v2.png` (the build): the boss never covers the scoreboard. The left column mirrors the right
  one: the scoreboard from the board's top down to over the boss's room (his frame, and room for five lines of his words), its rows
  scrolling; the boss under it on the board's foot. Chosen as the simplest that covers nothing and keeps every column on the board's lines
  (moving him beside the board as in Boss alone would need a third column). And the block is centered: with the side menu's labels a raid
  keeps at least 40 px either side, else the menu shows icons (1536 × 730: icons, 79 px either side, as the 50 v 50 there).
