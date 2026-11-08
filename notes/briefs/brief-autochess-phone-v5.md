# Auto chess, phone layout v5 (Eric, Nov 8; on PR #558, branch claude/autochess-redesign)

Mockup: notes/briefs/assets/autochess-v5-phone.png (generator autochess-v5-gen.py; 390 x 844). **Phone only: the computer
layout on #558 stays exactly as it is** (Eric: "the desktop config is good").

## Eric's asks
- The board and the action box nearly fill the phone's width (8 px gutters at 390; one shared size at every phone width).
- **Benches = a replica of 4 board squares**, the same size as the board's squares, lined up exactly with the board's files:
  - Ours: a row just BELOW the board under files E–H.
  - Theirs: a row just ABOVE the board over files A–D.
  - A few px of gap between the board's border and each row.
  - Only ever 4 slots.
- **Bench square colors, by the side's color.** White: an alternating light/tan pair just slightly different from the board's
  default squares (not a stark white). Black: an alternating gray pair. Slightly different from the board, and from each other.
- Bench pieces are normal board-piece size. Each slot's square label (e.g. "g4") sits under our tiles. For theirs: on the outer
  side, above the tiles *(director's call: keeps the board edge clean)*.
- **Players kitty-corner:** you bottom-left (under A–D, beside your bench), the opponent top-right (over E–H). "Auto chess / Round N"
  top left and the gear top right stay.
- The action box moves down under your row and grows to the board's width (its cards grow with it; still square).
- **Tap a piece on your bench:** its bench tile lights up AND the board square it will be placed on lights up (a quick reference).
  Check whether this exists already; make both highlights clear on the new tiles.
- Keep everything on #558 that's not listed here: no timer bars, the hexagon, the Income breakdown, Sell over the cards, the gear's
  Leave, the computer's frame.

## Tests (update the phone checks on #558, both projects stay green)
- Each bench tile = a board square (±0.5 px) in size, its x lined up with its file (ours E–H, theirs A–D); rows 2–8 px from the
  board's border.
- The tile colors differ from the board's and alternate.
- The players are kitty-corner (you left under the board, the opponent right over it).
- Box width = board width; the board is 8 px from each edge at 390 (scaled at 360 and 320); everything inside [0, vw]; no scroll.
- The bench tap lights the tile and the target square.
- The computer's checks don't change.
