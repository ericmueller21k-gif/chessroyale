# Babur's pump and balloons, bigger (Oct 24, 2026)

**Eric, on his phone with a screenshot:** "the balloon pieces are way too small, when full size they should be the same size as a
piece, this one got full and popped and still wasn't close, it's hard to even see what's going on, the pump should be bigger too".
Babur's figure and the bunch he holds are unchanged (Eric, via the director).

**Why it was small.** The pump was 34 x 36 css px (one art px to one screen px), and a board balloon was drawn in its square's
32-px frame at one frame px per art px: a stage-4 queen was 20 of 32, about 0.63 of its square. A queen piece fills about 0.77
of its square (cburnett's art, measured on the board), so the balloon was about a fifth shorter than the piece it becomes.

**What changed**

1. **The pump on a phone is 2x: 68 x 72 px** (was 34 x 36), at the room's right end as before. A whole scale, pixelated like the
   figure. The room under the status is 65 px tall in Babur's bar (his tall figure makes the bar 92 px), so the pump's foot sits
   3 px below the room's bottom, inside the bar's padding. Measured at 320, 360, 390 and 428 px wide (the bar's geometry is the
   same at each): the pump at y 65 to 137; a ready queen balloon's top at 75 to 77 px; a pop's highest drawn row at 73 px, the lowest the
   pop's swell reached in the sampled frames (2 to 4 px above the ready balloon); the status's box ends at 66.8. The pop clears the
   status by 6 px.
   - The brief's fallback (move the pump left in the room before shrinking it) was not taken: the status's width changes with its
     words, so a pump moved left clears only the short ones, while the foot 3 px lower clears every status at every width.
   - A pump at 2x now shows a balloon 40 px tall on the phone (a queen), about the size of a queen piece on the board.
2. **The pump on a computer stays 1x (34 x 36)**, at the bar's left end. The bar is 49 px tall there. Holding 2x needs the pump's
   72 px plus the bar's padding, about 83 px: a bar 34 px taller, not "a few px", so the largest whole scale that fits is 1x. If Eric
   wants the computer's pump at 2x, the bar grows about 34 px and the board moves down by that much. Not done.
3. **A balloon on the board is as tall as a queen piece on its square.** `Tiger.tsx`: one art px is `PX` = (0.772 / 8) / 20 board
   units (the board as 1); the queen's 0.772 is the cburnett queen's art height on its square (measured: alpha bbox of
   `Chess_qlt45.svg`), 20 is the stage-4 queen's art rows (`BALLOON_SHAPES`). Every shape uses the same scale, so a pawn balloon
   is smaller than a queen balloon, as pieces are. The frame (32 px, `FRAME` = 32 x PX, about 1.24 squares) is anchored by its
   knot's bottom center on the square's bottom edge, the landing's rest (its knot on row 29), so a landed balloon stands where his
   piece stands. Measured on a 57 px square (a 456 px board): the queen piece is 44.0 px tall; the balloon's flight frame is 70.4 px
   and its 20 art px are 44.0 px. Before: 35.6 px against 44.0 px.
4. **The flight starts at the release's last lifted look.** `pumpOnBoard` now reads the knot at `RELEASE_KNOT` (art row 21), where the
   release's last frame has it. It was the nozzle's rest (row 26), 5 art px lower: a visible drop at the handoff, 10 px on a phone.
   The release's 100 ms bare frame before the flight is unchanged.
5. **The landing's puff, its timing and cue, and his piece appearing at the puff are unchanged.** The puff is drawn at the same
   frame scale as the balloon, because it is part of the same sprite. At the old size it could not hide the bigger balloon whole.
   This is the one judgment in the landing; flagged for Eric.
6. **The limp balloon** (a computer's, tossed from his paw) is still drawn at 2x and lands on the nozzle's measured position, so it
   meets the phone's 2x pump. On a computer it meets the 1x nozzle, as before.

**Tests.** `e2e/tiger.spec.ts`:
- The pump's status check now uses the balloon's drawn top (its first drawn pixel), not the pump's box. The box's top rows are
  empty art above the balloon, and on a phone the 2x box reaches up to 65, above the status's box bottom (66.8). The check is still
  "clear of the status": under it on a phone, left of it on a computer.
- New: on a phone at 390 x 844 and 428 x 777, the pump is 68 x 72, inside the bar, at the room's right end, and its balloon's top is
  under the status.
- New: on the board, a stage-4 queen's flight is drawn within 10% of a queen piece's drawn height (the piece's art by its alpha;
  the balloon's 20 art rows of the frame's 32).

**Not covered by a test.** The pop's over-swell at each width (measured by hand with a fake queen, above).

**Files.** `packages/app/src/components/Tiger.tsx`, `packages/app/src/styles.css`, `packages/app/src/characters/effects/tiger.ts`
(`LAND_Y` exported; header note), `e2e/tiger.spec.ts`, `docs/areas/bosses.md` (the bar's and the board's sizes).
