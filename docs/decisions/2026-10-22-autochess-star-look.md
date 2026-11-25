# Auto chess: the star look (Oct 22, 2026)

## What Eric said

After v8's stars went live (docs/decisions/2026-10-22-autochess-stars.md), Oct 22:

1. **A clean board.** "The colors are not supposed to be on the board. It's supposed to be a clean chessboard. So the border around the pieces is not supposed to be there, just in the shop." Then,
   looking at the mock: "the border should be included on the board as well... a gold border for the 2-star units on the board, and then that way it's still clear." So: no ring or box on a square, but
   every starred piece carries the same outline as the shop's.
2. **Tiny stars inside the piece.** "The stars on the pieces should be very tiny, like tiny, and the two stars should just be next to each other, and then the three stars should be in like a triangle
   pattern so they take up less surface area... the rook is a good example. They can easily fit in the center of the rook." His mock: three small solid black stars, one above and two below, centered in the
   rook's body, each about 12% of the square wide, the group about 28%.
3. **The outline.** "An exact border around the piece, not the exact way Gemini did it here, because that doesn't quite fit our quality": even width, crisp edges, no smudge; gold for a 2-star, prismatic
   for a 3-star. The prismatic palette: "the one I had Gemini do around the rook... more like blue and purple and green and a little bit of the red and orange... not really rainbow exactly, but... more
   prismatic" (sampled from his picture: teal and cyan about half, blue to violet to magenta about a fifth, coral and orange about a fifth, almost no yellow or plain green).
4. **No glow in the fight.** "When the chess actually starts to play, can we get rid of the glowing effects of the pieces? It's fine to keep the little stars." He wants to compare, so a setting.

Eric saw three mocks of the card and the board (A: the outline round the piece's black outline, the card plain; B: the black ink of the piece drawn in the color; C: A plus the card's old gold and
prismatic border and glow) and **picked C**.

## What was built

**The stars** (`components/AcStarArt.tsx`, `StarArt`). Two or three solid stars drawn inside the piece's body, over its own picture: two side by side, three one above and two below (a triangle), black on a white piece and white on a black one, each with a 0.5 unit
knockout edge in the opposite color so one that crosses a line of the piece still reads. They are drawn in the piece's own 45 x 45 box, so they scale with it: on the board, on both benches' tiles and
on a shop card's piece. Each piece kind has its own spot, found by rendering every piece and looking for the widest plain part of its body, inside its outline:

| Piece | Star width (45ths of the square) | Share | Group of three, of the square |
| --- | --- | --- | --- |
| rook, knight | 5.4 | 12% | 27% wide, 22% tall |
| white queen | 3.8 | 8.4% | 19% wide |
| bishop, black queen | 3.4 | 7.6% | 17% wide |

**The outline** (`StarArt`, `autochess/pieceShapes.ts`). The piece's own shapes (the board's cburnett SVGs, read into `pieceShapes.ts` with their paints resolved) drawn a second time behind the piece, filled and
stroked 1.5 units wider than their own stroke (the black line is 1.5 thick, so the colored band is as wide as it), with round joins and one gradient across the piece: an exact, even outline with crisp edges and no filter. **Gold** (a soft gold gradient) for a 2-star;
**prismatic** (teal, cyan, azure, blue, violet, magenta, coral, orange; more saturated than the pastel average of Eric's picture, which its smudge softened) for a 3-star. On a shop card the prismatic gradient shifts slowly
(9 s, `animateTransform`); under reduced motion it stays still. On the board and the benches it is still, so a board of them costs nothing.

**The outline shows while you buy, place and move; in the fight and the result only the stars stay.** `AUTOCHESS.fightGlow` (false) keeps the outlines on through both; the test switch is `?fightglow=1`.

**The board is clean.** No ring on the square of the piece a star-up would merge into (a card says where it goes) and none on the bench tile; the move step's pulsing gold box on every starred piece is gone
(the outline marks them); the dots of a picked piece and the "Not starred" line are as they were. The star's pop-in on a merge is gone; the piece's merge flash stays.

**The stars and the outline are part of the piece.** The first mock drew them in a layer over the squares and hid the board's own picture of the piece, and a moved piece jumped and a dragged one doubled. They are now
drawn inside each piece's own element on the board (`decor` on the board, `PieceDecor` in `board/types.ts`: for the piece on a square, a class and what goes inside it, drawn again when its `key` changes), so a starred
piece slides in the move step like any other, is captured and fades with its piece, and follows the fight's moves (the old 160 ms delayed reappearance of the stars is gone). A dragged starred piece carries its stars
and its outline in its ghost (the piece it left behind stays, under the picked highlight, as a plain piece's does). A piece with its outline on is drawn by the same SVG that draws the outline
(`piece.ac-drawn` switches the CSS picture off), see call 2.

**The card** keeps what C had: the gold border and a pulsing gold glow for a second star; for a third, a prismatic border (the new palette) and a glow. The card's piece has the outline of the stars it will have.

## Judgment calls

1. **Stars smaller than 12% on the bishop and the queen.** Only the rook's and the knight's bodies have a plain part big enough. The bishop's belly under its cross is 4 units tall; the queen's gown is thin bands.
   Rather than hide the bishop's cross or draw over its lines at 12%, theirs are 7.6% to 8.4%, at spots chosen by looking at each (the white queen's in its lowest band, the black queen's in its crown's solid mass), with the knockout edge.
2. **The piece is drawn by the outline's SVG, and its CSS picture is switched off.** A CSS background picture on a box that isn't a whole number of pixels is drawn a little big and off its box (measured: about half a pixel at the far edge on a 43.5 px
   square), so an outline made from the shapes and put round it showed a gap on one side and a dark fringe on the other, not an exact band. Drawn from the same shapes, the band is 1.5 units all round. The cost: while a starred
   piece has its outline on, the board's own picture of it is not used (the fight, which has no outline, goes back to it).
3. **The outline is on only while buying, placing and moving** (Eric: off when the chess starts to play); `fightGlow` and `?fightglow=1` keep it on, the outlines then sliding and fading with their pieces.
4. **The prismatic gradient shifts only on the shop card** (a slow 9 s shift, Eric: "a slow shift is fine"; still under reduced motion: I read "still" as motionless). On the board and the benches it doesn't move: many small SVGs
   repainting every frame on a phone is a cost for nothing Eric asked for.
5. **The bench-tile ring and the move step's gold box are gone** (the director's calls: the outline marks a starred bench piece, and the starred pieces in the move step). The legal-move dots, the "Moved. Tap ↩ to undo." mark and "Not starred" stay.
6. **The thickness of the band is the black line's** (1.5 units: 1.5 px on a 43.5 px board square, 2.1 px on a card's piece at 428 wide, 0.9 px on a 27 px square of a 320 wide, short screen). A thicker band filled the queen's crown between its spikes.
7. **The prismatic card's border is static** (the v8 border shifted its hue with a filter): the glow still pulses, and the outline is what is prismatic and alive.

## Sizes (CSS px; the board square is the piece's size)

| | 428 wide | 320 wide (568 tall) |
| --- | --- | --- |
| board square | 43.5 | 27 |
| bench tile's piece | 35.2 | 29.9 |
| shop card's piece | 63.9 | 44.2 |
| star, rook and knight (12%): board / bench / card | 5.2 / 4.2 / 7.7 | 3.2 / 3.6 / 5.3 |
| star, white queen (8.4%) | 3.7 / 3.0 / 5.4 | 2.3 / 2.5 / 3.7 |
| star, bishop and black queen (7.6%) | 3.3 / 2.7 / 4.8 | 2.0 / 2.3 / 3.3 |
| outline band: board / bench / card | 1.5 / 1.2 / 2.1 | 0.9 / 1.0 / 1.5 |

At 320 wide the stars are specks (the board there is only 27 px a square, the screen being short); the outline carries the level.

## Player-visible text changes

None. No line, label or button changed: the card's spoken label, the bench tiles' and the pieces' are as they were.

## Checks

- Unit: `packages/app/test/autochess-star-look.test.ts` (every starable piece has its shapes; the stars at most 12% wide, inside the body; a pair on a line, a triangle at most 28% wide and 24% tall; `fightGlow` off),
  `board-logic.test.ts` (the board draws again when the `decor` key changes, not for a fresh `of`).
- e2e (`e2e/autochess.spec.ts`; the old ring, rainbow-animation and `.ac-stars` tests are replaced): the card and the board for a star-up (gold and prismatic cards, the stars and outline on the card's piece, the palette, nothing on
  the board for a star-up, no silhouette), the bench's merge (no ring, stars and gold outline after), the move step (outlines, no pulsing box), the bot's stars (white on black, outlined), stars following pieces through the fight,
  the stars' size and place at 320 to 428 and on a computer (at most 12%, a pair or a triangle of at most 28%, in the body, clear of a bench tile's name, black on white), the outlines (on while buying on the board and the bench,
  off in the fight and the result, on with `?fightglow=1`), a starred piece sliding with its outline and a dragged one carrying it (a real finger's drag, CDP touch events), reduced motion, and the shift only on the card.
- Watched frame by frame: a starred knight's move in the move step, sampled every frame (its box slides through in-between places, its picture is in it each frame); one drag with a finger; the fight with and without `?fightglow=1`.
