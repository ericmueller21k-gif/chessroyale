# Big Boy's toy-block tower, seen from above (Eric, Nov 18: "Number 3 is the way")

**This is not a boss.** It is a board effect in the same sprite format: Big Boy (the baby boss) stacks wooden toy blocks on one
square of the chessboard, one more each turn, up to 10, and then the tower topples. Ignore the boss animation list (entrance,
thinking, move, capture ...) and any warning that they're missing: draw exactly the animations below. The phone-size view beside
another boss is only a size check (one board square is 32 px of yours).

**Why:** today's tower (reference 3) is drawn from the side: at 10 tall it climbs about 4 squares up the board and covers
everything behind it. Eric picked a tower **seen from above** (references 1 and 2, a quick mockup by the director, not the art):
the camera looks down on the stack, so the tower stays about on its own square (about 1.3 squares at 10). Rising toward the camera,
each block up is drawn **a little bigger and a little higher up the screen** than the one under it, **a little off-center**, so the
lower blocks show only as **strips** peeking out under the top one (mostly at the bottom, a little at the sides).

**Eric's words:**
- "If it says 3, then you know there's 3 blocks": **the count on the top block, as a number**, in "the original toy block design",
  "wooden", with "that carved wooden effect".
- "A shadow on the board for the whole tower" that grows as it gets taller, "to show its size".
- "come down on top of it with a shadow, like getting bigger and bigger, and it plops on it every turn".
- "slightly misaligned also and wobbling ... like a building that's kind of wavering back and forth".
- "a pretty easy collapsing animation, because they're all scattering from that one spot".

**Read first:** `packages/app/src/characters/effects/bigboy.ts`, today's toy block (`TOY_PALETTE`, `TOY_LETTERS`, `toyCube`, its
`land`, `sit`, `poof`, `fly` animations, `toyDust`, `toyGlint`): a beveled wooden block, light from the top left, a colored panel
(red, blue, green) with a cream glyph and its darker shade. **Your blocks are that block seen from straight above**: the same
wood colors, the same beveled rim (light on the top and left edges, darker on the right and bottom), the same colored panel inset,
the glyph in the same cream with its shade. Copy the palette into your file (it must be self-contained; add only what you need: a
shadow color or two with alpha, a darker wood or carved-line key). Also read `sprite.ts` and `paint.ts`.

## One character, one frame: 96 x 96

Export `TOY_TOWER: Character`, id "bigboy-tower-top", **w 96, h 96, foot [48, 63]**. **The board square the tower stands on is the
frame's middle: x 32..63, y 32..63** (the game centers your frame on the tower's square; it is drawn under the chess pieces, so the
pieces stay visible over it). Everything else in the frame is the squares around it (for the shadow, the wobble, the falling block).
No pixel on the frame's edge.

## The block (from above)

- A block is its **top face** (a square, outline included) with a **short front strip** under it (the side facing the camera, 4 to 6
  px tall: wood rim and a darker strip of its panel color), so a stacked block shows its top face and a sliver of its side.
- **Block n (1 at the bottom, up to 10) carries the number n** on its panel (not a letter). Colors in turn: 1 red, 2 blue, 3 green,
  4 red, 5 blue, ... (today's panel keys r/u/g with their darker R/U/G).
- **The number is carved into the wood toy**: a chunky 7 x 9 digit (today's letters' weight; "10" is two digits side by side, a
  1 px gap), cream like today's letters, looking cut in: a dark line along its top and left inner edges and the light shade along
  its bottom and right, or today's cream with its shade offset, whichever reads as carved at phone size. Every block's number reads
  the right way up.
- **Sizes**: block 1's top face is about 26 px across (outline included), centered on the square (top face about x 35..60, y 33..58,
  front strip under it to about y 63). Each block up is about **3.5% bigger** (about 26, 27, 28, 29, 29, 30, 31, 32, 33, 34) and
  sits about **2.4 px higher** up the screen than the one under it (cumulative, rounded: 0, 2, 5, 7, 10, 12, 14, 17, 19, 22), with a
  small fixed **sideways and up/down jitter** of 1 to 2 px per block that it keeps at every height (e.g. x: 0, +2, -1, +2, -1, -2,
  +1, -2, +2, +1; y: 0, +1, 0, 0, +1, 0, 0, +1, 0, 0), so the strips of the blocks under it show unevenly, never a straight column.
  Choose the exact numbers so it reads; a block of any size is one function (`block(n, size)`), drawn in true pixels at that size,
  never a scaled-up copy.
- **The shadow on the board**: one soft shadow for the whole tower, falling down-right from the square (light from the top left),
  2 or 3 translucent dark steps (true pixels, alpha colors), growing with the height: at 1 just a block's shadow, offset 2 to 3 px;
  at 10 longer and bigger, reaching about a third of a square down-right past the square. It sways a little with the tower.

## The animations (names exact)

1. **`stand1` to `stand10`** (loop): the stack of N blocks with N on top, alive. **The sway grows block by block up the stack (the
   top moves most) and grows with the height overall**, whole pixels, each block's shift proportional to its place in the stack (a
   curve: the base never moves):
   - 1: still; a glint runs across its top face now and then (as today's `sit`).
   - 2 to 3: steady; a 1 px shiver of the top block now and then.
   - 4 to 6: a slow sway, the top 1 to 2 px each way.
   - 7 to 9: a clear sway, the top 2 to 3 px, a block now and then nudged a pixel off its place and back.
   - 10: **a big wobble**: the top swinging 4 to 5 px each way, quicker, the stack bending like a building wavering, about to go.
   - 6 to 10 frames each, 110 to 240 ms (quicker as it grows). **Their first frame is the stack at rest** (no sway).
2. **`add1` to `add10`** (one-shot, about 400 to 480 ms): block N lands on the stack of N-1 (`stand<N-1>`'s first frame; `add1`: on
   the empty square). The block comes **in from above, toward the camera: big (about 1.7x its size, then about 1.4x, then 1.15x),
   shrinking to its place**, a little higher up the screen than its place and closing in, while **its shadow on the top of the
   stack** (on block N-1's top face; on the square for `add1`) grows from small and faint to full. **The falling frames add up to
   exactly 120 ms** (e.g. 3 x 40 ms; the game starts the animation 120 ms before the block lands). Then the **plop**: the frame
   at 120 ms has `cue: "clack"` and `shake: [0, 1]`, the block squashed (a px or two wider, a px shorter), the stack under it
   shivering 1 px; then a little bounce (a frame a px bigger, as if lifted), and it settles. **The last frame is exactly
   `stand<N>`'s first.** The number on the falling block may be the same digit at the larger size or simply the 7 x 9 one (it must
   stay crisp). `add1`: a puff of dust at its foot as it plops (today's `toyDust`, round the block).
3. **`tip2` to `tip10`** (one-shot, about 300 to 340 ms): the stack collapses: `cue: "crash"` on the first frame; the blocks lose their
   rise (the higher ones drop, shrinking toward the base size) and spread out a little from the square in a burst, each pushed its own
   way, knocked askew (sheared rows or quarter turns), the top ones first. In the **last moving frame each block k is within about
   4 px of its place in `stand<N>` (`TOWER_BLOCKS[k]`, below)**: the game then flies each block from there to its own square. The
   **last frame is empty** (about 30 ms).
4. **The single blocks, scattered on the board** (each drawn **only inside the square x 32..63, y 32..63**, nothing outside it: the
   game cuts this square out as a one-square sprite), for n = 1 to 10, block n with its number and color:
   - **`sit<n>`** (loop): the block from above at block 1's size and place, its own small shadow down-right, a glint across its top
     now and then (8 frames, as today's `sit`).
   - **`land<n>`** (one-shot, about 400 ms): it comes in from above toward the camera (bigger, at most the square's 32 px, shrinking),
     its shadow growing, plops (`cue: "clack"`, `shake: [0, 1]`, squash, a little bounce), dust round it; its last frame is `sit<n>`'s
     first.
   - **`poof<n>`** (one-shot, about 340 ms): `cue: "poof"` on the first frame; a puff of dust and it shrinks away; **last frame empty**.
   - **`fly<n>`** (loop, 4 frames x 70 ms): in the air, tumbling: the block (about 22 to 24 px, a little smaller than sitting so a
     quarter turn fits) turning a quarter each frame (a layer's `rot`), no shadow. The game moves it along its flight.
5. **`idle`**: the same as `stand7` (for the render's phone-size view).

Also export **`TOWER_BLOCKS: [number, number][]`**: the middle of block k's top face (index k-1, frame px) in `stand10`'s first frame
(the stack of N uses the same places for its N blocks). And **`TOWER_TOPS: number[]`**: for N = 1 to 10, the y (frame px) of the
top edge of the stack of N in `stand<N>`'s first frame.

No faces, no text other than the numbers. Same palette family as today's block; drama yes, nothing outside the toy-block look.

## Checks before `done`

- Render `stand1`, `stand3`, `stand7`, `stand10` (all frames), `add1`, `add2`, `add6`, `add10`, `tip5`, `tip10`, and `sit3`, `land3`,
  `poof3`, `fly10` at 4x on dark and light. The number on the top block must read at a glance, and every lower block must show as a
  strip under it.
- At phone size (a square about 45 px; 1x of your 32 px square is smaller still): the stack of 10 reads as a stack of wooden blocks
  seen from above with "10" on top, and its shadow shows its size.
- Your notes (summary): the block sizes, rises and jitters, `TOWER_BLOCKS`, `TOWER_TOPS`, each animation's frames and ms.
