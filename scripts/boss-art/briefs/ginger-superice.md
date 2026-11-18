# Ginger's Super Freeze: the expanding 3 x 3 ice block (Eric, Nov 18)

Eric: "he looks at and he kind of finds a few pieces where yours are clumped, and he freezes the one that, and then ... the ice block
gets bigger and bigger until it hits all the squares around it ... nine blocks ... that animation might even take 4 or 5 seconds for
him to do a charge up and make an expanding ice block."

**This is not a boss.** It is a board effect in the same sprite format: Ginger (the gingerbread Freeze boss) blasts one square of the
chessboard and a block of ice grows from it, square by square, until it covers the 3 x 3 squares around it (nine squares). The chess
pieces stand on those squares and must stay readable through the ice. Ignore the boss animation list (entrance, thinking, move,
capture ...) and the warning that they're missing: draw exactly the animations below. The phone-size view beside another boss is only
a size check (one board square is 32 px of yours).

**Read first:** `packages/app/src/characters/effects/ginger.ts`: the ice the game puts on one frozen piece today (`ICE_PALETTE`,
`iceBlock`, `CRACKS`, `ICE_OVERLAY` and its `freeze`, `frozen`, `crack`, `thinning`, `thaw` animations): a see-through block of ice
the shape of a square (28 x 28 inside its 32 x 32 square, rounded corners), light rims at the top left, a darker rim at the bottom
right, two diagonal shine streaks, opaque frost crystals in two corners, cracks drawn in `c`. **Your ice is that ice, made big**:
copy `ICE_PALETTE` into your file (it must be self-contained: import only sprite.ts and paint.ts) and keep its see-through keys
(`a`, `A`, `q`, `t`, `T`: colors with alpha) for the body so pieces show through. You may add two or three keys (a deeper blue for
facets, a darker crack), no new hues. Also read `effects/common.ts` for `SQUARE` (32), `sprite.ts` and `paint.ts`.

## The frame (the game relies on these exact numbers)
- Export `SUPER_ICE: Character`, id "ginger-superice", **w 96, h 96, foot [48, 95]**. The frame is exactly the 3 x 3 squares: the
  square in column c, row r (0 to 2) is x 32c .. 32c+31, y 32r .. 32r+31; the blasted square is the middle one (x 32..63, y 32..63).
- The ice never reaches the frame's edge: the full block's outline is 2 px inside it (x 2..93, y 2..93), like today's block sits 2 px
  inside its square.
- Export `SUPER_ICE_STEPS: number[]`: for each of the nine squares, in row-major order (index r * 3 + c), the time (ms from `grow`'s
  start) its ice is complete. The game shows each frozen piece's own ice from that moment, so they must match your frames.

## The animations (names exact)
1. **`grow`** (one-shot, about 1500 ms in all): the blast hits the middle square (`cue: "burst"` on frame 0: a starburst of frost,
   white and pale blue, a few specks flying out), the middle square's ice forms (frost creeping in, then the block closing over, as
   today's `freeze` does, in about 300 ms), then **the block grows outward square by square**: first the four squares beside it (up,
   down, left, right) together or one after another, then the four corners, the ice spreading across each square from the side it
   comes from (an advancing front with frost and a bright rim), the joins between squares fusing into one block (no seams left once
   it's whole, a faint fault line at most). One `cue: "crackle"` as the side squares finish and one as the corners finish (two in all,
   besides the burst). Its last frames: the whole 3 x 3 one solid block of thick, **cracked** ice (cracks running across it from the
   middle out, facets, the shine streaks, frost crystals in its four corners), a white flash over it, then settling. `shake: [0, 1]`
   on the burst and on the last step. Its last frame is `hold`'s first frame.
2. **`hold`** (loop, 6 to 8 frames, 160 to 240 ms each): the full block at rest, a glint sweeping across now and then, the cracks
   glinting, a couple of corner twinkles. Quiet (no cue).
3. **`settle`** (one-shot, about 450 ms): the big block breaks apart along the squares' edges (the eight lines between the nine
   squares flash white and open), its pieces thin and fade out; **its last frame is empty**. (The game shows today's small ice on each
   frozen piece from then on: the big block only grows, holds a moment and clears.)
4. **`idle`**: the same as `hold`'s first frame (for the render's phone-size view).

The ice's look: thick, cold and cracked, more dramatic than the one-piece ice (it's his super move), but the body stays see-through
(alpha around 0.3 to 0.45 at most where a piece stands: the middle of each square), the rims, cracks and frost opaque. No text, no
faces, nothing outside the 3 x 3.

## Checks before `done`
- Render `grow` (all frames, in two or three renders if needed), `hold` and `settle` at 4x on dark and light.
- At phone size (a square about 45 px, the whole 3 x 3 about 135 px): it reads as one big block of cracked ice over nine squares,
  and the middle of each square is clear enough that a chess piece would read through it.
- Your notes (summary): each animation's frames and ms, `SUPER_ICE_STEPS`, every cue and the frame it's on, the palette keys added.
