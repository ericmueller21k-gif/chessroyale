# Birdie's train on the board: the attack, Nov 23 (Eric's design)

**This is not a boss.** It is board art in the same sprite format, the way Big Boy's tower was drawn (`bigboy-tower.md`). Ignore the
boss animation list (entrance, thinking, move, ...). Draw exactly the three animations below, in one Character.

**Read first:** `scripts/boss-art/out/boss-birdie/boss-birdie.ts` (read only, via the read list): Birdie's approved train (a yellow toy
diesel seen from the side: a rounded nose, a sloped windshield, a dark roof with the open hatch, a thin red stripe that sweeps down the
nose, silver trucks, four wheels, two headlights) and his cap, copied from it so the train matches his ride. Also read
`packages/app/src/characters/sprite.ts`, `paint.ts` and `effects/common.ts` for `SQUARE` (32 px, one board square).

## The frame (the game relies on these exact numbers)
- Export `BIRDIE_TRAIN: Character`, id "birdie-train", **w 64, h 32, foot [32, 31]**. The frame is two board squares side by side: the
  left square is x 0..31, the right square is x 32..63. The game places the frame so the left square lands on the marked square.
- **No letters or numbers** anywhere (no "RR" on the crossbuck: shapes only).

## The animations (names exact)
1. **`ride`** (loop, 4 to 6 frames, about 90 to 120 ms each): the train seen **from above**, nose pointing right, filling the frame's 64 by
   32 (about two squares long, one square tall). Birdie's capped head shows in the open cab (the hatch, from above). The wheels and rods
   turn a little each frame, a puff of smoke or a vent glow (it's a diesel), and its headlights on at the nose. Its shadow on the floor
   under it, a little offset.
2. **`crossing`** (loop, about 1 s, 6 to 8 frames): the railroad-crossing warning, drawn **only in the left square (x 0..31)**, the
   right half of the frame empty. Two alternating red lights (like a crossing signal seen from above) and a crossbuck mark (two crossing
   bars on the square, shapes only). It flashes: the lights alternate each frame. It must read clearly over light and dark squares and
   under a chess piece: a dark outline or a light edge round the mark.
3. **`smash`** (one shot, about 0.4 s, 4 to 5 frames): the hit, a short punchy puff when the train hits a piece, in the **left square
   only** (x 0..31): a burst of dust and sparks, a bright flash on the first frame, the puff spreading and fading. Put `cue: "smash"` on
   the flash frame. The game may reuse the gator's laser smash instead; draw this anyway as the option.

## Quality bar
- Render `ride` (all frames) at 4x on dark and light squares; `crossing` (all frames) at 4x on a light and a dark square, and once under a
  small piece; `smash` at 4x. At phone size (a square about 32 px, the train about 64 px), the train reads as a yellow toy diesel, the
  crossing reads as a flashing red warning.
- Keep it simple: a few colors, the train's own palette from the idle.
