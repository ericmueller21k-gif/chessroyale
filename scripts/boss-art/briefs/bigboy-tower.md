# Big Boy's toy-block tower (Eric, Nov 18)

Eric: "he starts stacking the blocks every turn. He stacks another block up to 10 and like makes a big stack. Like it should look
like a cool sort of like actual stack of like toy blocks, so they're not quite set evenly. As they get taller, they get a bit more
wobbly ... once they hit 10, they start to ... wobble, and then they topple over."

**This is not a boss.** It is a board effect in the same sprite format: Big Boy (the baby boss) stacks toy blocks on one square of
the chessboard, one more each turn, up to 10, and then the tower topples. Ignore the boss animation list (entrance, thinking, move,
capture ...) and the warning that they're missing: draw exactly the animations below. The phone-size view beside another boss is only
a size check (one board square is 32 px of yours).

**Read first:** `packages/app/src/characters/effects/bigboy.ts`, the toy block the game has now (`toyCube`, `TOY_PALETTE`,
`TOY_LETTERS`, `cubeAt`, its `land`, `sit`, `poof` animations): a wooden ABC block seen from the front and a little above, light
from the top left, a colored panel with a cream letter (A red, B blue, C green), its side another color. **Your blocks are that block**:
copy `toyCube`, the palette and the letters into your file (it must be self-contained) and use them. Also read `sprite.ts` and
`paint.ts`, and `effects/common.ts` for `SQUARE` (32).

## The frame and where it sits (the game relies on these exact numbers)
- Export `TOY_TOWER: Character`, id "bigboy-tower", **w 48, h 136, foot [24, 135]**. The board square the tower stands on is the
  frame's bottom 32 rows, columns 8 to 39 (x 8..39, y 104..135); the game places your frame so that square lands on the tower's square.
  Everything above is the tower rising over the squares behind it (the game draws it under the chess pieces, so pieces stay visible).
- **The base block (block 1) is today's block exactly**: `toyCube("A", 18, 18, 5)` at today's `cubeAt` place shifted 8 px right and
  104 px down (its grid's top-left at x 13, y 109; its front's bottom on y 132), with today's little shadow under it (`shadow20` at
  x 16 + 8, y 27 + 104).
- **Blocks 2 to 10 go on top, each a little smaller going up** (toy blocks of a set: e.g. fronts 16, 15, 14, 13, 13, 12, 12, 11, 11 with
  depth 4 or 3; choose what reads), **letters in turn** (block 1 A, 2 B, 3 C, 4 A ...), **each a little off-center**: a fixed sideways
  offset per block of 1 to 3 px, alternating unevenly (e.g. +2, -1, +3, -2, +1, -3, +2, -1, +2), so the stack looks hand-stacked, never
  a straight column, and each block keeps its offset, letter and size at every height. Each block sits on the top face of the one below
  (its front's bottom on the lower block's top edge, overlapping its top face a little so it reads as resting on it).
- The whole stack of 10, with its biggest wobble, must fit inside the frame (no pixel on the frame's edge): about 125 px tall at most.
- Export `TOWER_TOPS: number[]`: for N = 1 to 10, the y (frame px) of the top edge of the stack of N in `stand<N>`'s first frame
  (index N-1), and `TOWER_BLOCKS: [number, number][]`: the middle of block k's front (index k-1, frame px) in `stand10`'s first frame.
  The game flies new blocks to the top and scatters the blocks from these points.

## The animations (names exact)
1. **`stand1` to `stand10`** (loop): the stack of N blocks, alive. **The sway grows with height**: the stack bends about its base, each
   block's sideways shift proportional to its height (the top moves most), whole pixels, no smoothing.
   - 1: still, with today's glint running along its top now and then (like `sit`).
   - 2 to 3: steady; a 1 px shiver of the top block now and then.
   - 4 to 6: a slow sway, the top 1 to 2 px each way.
   - 7 to 9: a clear sway, the top 2 to 3 px, a block now and then nudged a pixel off its place and back.
   - 10: **a big wobble**: the top swinging 4 to 5 px each way, quicker, the stack bending, about to go.
   - 6 to 10 frames each, 110 to 240 ms (quicker as it grows). Their first frame is the stack at rest (no sway), so `add<N>` ends on it.
2. **`add1` to `add10`** (one-shot, about 400 to 500 ms in all): block N lands on the stack of N-1 (`stand<N-1>`'s first frame; `add1`:
   on the empty square): it comes down from above (in from the frame's top, stretched a little as it falls), clacks on squashed (`cue:
   "clack"` on that frame, `shake: [0, 1]`), a tiny bounce, the stack under it shivers, and it ends exactly as `stand<N>`'s first frame.
   `add1` is today's `land`: a puff of dust at its foot (today's `toyDust`).
3. **`tip2` to `tip10`** (one-shot, about 300 to 360 ms): the stack of N goes over: `cue: "crash"` on the first frame; it leans further
   and further to one side (even N to our right, odd N to our left), the blocks coming apart as it bends, the top ones first; the
   **last frame is empty** (the game takes over there, flying each block off to its own square with the game's tumbling block).
4. **`idle`**: the same as `stand7` (for the render's phone-size view).

No new colors beyond today's palette (a darker outline or shadow key is fine), no text, no faces: they're blocks.

## Checks before `done`
- Render `stand1`, `stand4`, `stand7`, `stand10` (all frames), `add2`, `add6`, `add10` and `tip5`, `tip10` at 4x on dark and light.
  The base block must match today's block pixel for pixel in `stand1` (render today's `toyBlock` `sitA` the same size beside it if
  you can, or compare against `effects/bigboy.ts`'s numbers).
- At phone size (a square about 45 px): the stack of 10 reads as a wobbly tower of toy blocks, each block's letter panel reads as a
  colored square.
- Your notes (summary): the block sizes and offsets, `TOWER_TOPS` and `TOWER_BLOCKS`, each animation's frames and ms.
