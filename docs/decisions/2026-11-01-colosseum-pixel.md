# The Colosseum in pixel style: the pixel set, four high views, the gear's Pieces (Nov 1, 2026)

**Eric (Oct 31)**, on his picture of a high view over the board ("this vantage point of watching the game is pretty much
exactly what I'm envisioning … the viewpoints, they're all way too close to the board") and then on the proof of concept
(the arena drawn on one chunky pixel grid, a cel-shaded pawn and king): "that's exactly what I was thinking of."

**What changed** (`docs/areas/colosseum.md`):
- **Pixel** (`arena-gl.ts`, `pieces-pixel.ts`): the whole arena drawn into a small target and scaled up nearest-neighbor;
  all six pieces in both colors made in code in the picture's style (real-set heights, wide eight-sided bases, bands, a
  horse's head in profile for the knight), cel-shaded in the picture's cream, navy and gold, each facing the screen and
  leaning back like a sprite, a contact shadow under it and a one-pixel dark outline round it.
- **Four high views** going round the board (`arena.ts` `HIGH`, `highView`, `viewsFor`): behind White, its right, behind
  Black, its left. The page opens on the one behind White; Change seat picks among the eight seats and the four.
- **The gear's Pieces** (Pixel, 3D, 2D; Pixel by default) replaces "3D pieces" on/off.

**Calls made:**
- **Change seat stays random** (Eric, Oct 30: "Change seat gives a random one"), now among the eight seats and the four high
  views, never the same one, never a player view. (The brief said the list "steps through" them; random keeps Eric's rule.)
- **An old "3D pieces" on keeps 3D; an old "off" (or nothing) gets Pixel**, the new default: "off" was the old default, and
  Pixel is the look Eric approved.
- **The high views:** 47° down (the brief's 40 to 47°; Eric's picture looks a little steeper), aimed past the board's middle
  (1 m on a computer, 0.6 m on a phone) so the far wall and the lower stands show above the board; the eye as far back as
  makes the board and its border 42% of the arena's height on a computer (the overlay takes the top and the right) and 56%
  on a phone, worked out when the screen's size changes. The arena itself isn't changed: its floor is wider round the board
  than the picture's, so on a computer the stands straight across sit under the cards and show on either side.
- **The bosses keep their seats:** they're chosen against the ten first views only (`FIRST_VIEWS`); none covers the board
  from a high view on a phone or a computer (tested; the seats checked identical to main's for 1 to 30 bosses).
- **The art pixel:** a 1 m pawn standing on the board's middle about 16 art pixels tall, at least 2 screen pixels an art
  pixel (3 on a 1440 × 900 computer, as the proof of concept), set when the view or the screen's size changes.
- **The light is the screen's** (from the top left), not the arena's sun: every piece faces the screen, so the light is in
  the piece's own frame and each kind reads the same from every view. Highlight pixels on navy and gold only (on cream they
  read as noise).
- **The outline in the small target:** the scaling up then reads one pixel a screen pixel, so Pixel stays cheaper than 2D.
  Ten draw calls (the arena, the crowd, one a kind, the outline, the scaling up).
- 3D and 2D draw as before (the same meshes, checked identical to main's, and the same shaders), in every view. The
  overlay's flat board, the chat, Exit and the eval bar are unchanged (the flat board stays White-up in the high view
  behind Black, as it is in the seats).

**Frame rate** (eric.md's method: headless, software WebGL, a phone 390 × 844 (3x, the canvas capped at 2x) and a computer
1440 × 900, 5 s while the bots play, main and the branch taken in turn, four runs each, one pass; the medians; White's
player view, the one view both have, and the branch's high view behind White):

| | view | main fps (runs) | branch fps (runs) | median fps main → branch | script a frame | draw calls |
| --- | --- | --- | --- | --- | --- | --- |
| phone, 2D | White's | 19.4, 19.4, 18.4, 19.1 | 17.9, 20.4, 19.5, 20.4 | 19.2 → 19.9 | 0.25 → 0.22 ms | 3 → 3 |
| phone, 3D | White's | 12.0, 12.3, 11.8, 12.2 | 9.4, 12.8, 12.4, 11.7 | 12.1 → 12.1 | 0.28 → 0.31 ms | 8 → 8 |
| phone, Pixel | White's | (main's 2D above) | 17.8, 17.6, 19.7, 21.2 | 19.2 → 18.7 | 0.25 → 0.27 ms | 3 → 10 |
| phone, high view | behind White | | Pixel 18.6, 3D 12.7, 2D 20.6 (medians) | | 0.31, 0.27, 0.22 ms | 10, 8, 3 |
| computer, 2D | White's | 9.3, 9.8, 9.4, 10.1 | 9.7, 9.2, 9.8, 9.9 | 9.6 → 9.7 | 0.36 → 0.28 ms | 3 → 3 |
| computer, 3D | White's | 6.6, 7.3, 6.9, 6.8 | 7.1, 7.1, 7.3, 7.3 | 6.9 → 7.2 | 0.50 → 0.37 ms | 8 → 8 |
| computer, Pixel | White's | (main's 2D above) | 12.4, 11.5, 11.8, 11.4 | 9.6 → 11.7 | 0.36 → 0.44 ms | 3 → 10 |
| computer, high view | behind White | | Pixel 11.4, 3D 7.0, 2D 9.5 (medians) | | 0.43, 0.32, 0.26 ms | 10, 8, 3 |

Pixel is the cheapest of the three on a computer (+22% over 2D) and far cheaper than 3D on both (+55% on a phone); on a
phone it is level with 2D (18.7 against 19.2 and 19.9, inside the runs' spread). An earlier version scaled up and drew the
outline in one pass at the screen's size (six reads a screen pixel) and ran about 10% under 2D on a phone; the outline
moved into the small target for that.

Nothing allocated a frame: Pixel's target and its art pixel are made when the screen's size or the view changes; the clear
colors and draw-buffer lists are made once.

## Round 2: the pieces as the picture's (Nov 1)

**Eric (Nov 1)**, on round 1: "The last one we sent was pretty close to this, but it still wasn't right… the bordering and
the shading and the size was just still off… we should be getting a bit closer. I'm not going to be that picky, but we were
almost there." The director, side by side: too big, too stubby, the rook's and the queen's tops not crisp. His picture is
now in the repo, `docs/refs/colosseum-high-view.png` (the high view behind White), so it can't be lost again.

**Measured on the picture** (its squares about 70 px wide on White's first rank, 48 on Black's; each piece's height and
base width, outline and all, against the square it stands on): near White the pawn 0.8 of the square's width, the rook
0.95 (a1 1.04, h1 0.94), the queen 1.27, the king 1.5; bases 0.58 (pawn), 0.64 (rook), 0.7 (king), 0.74 (queen). The knight
(only Black's, in the middle ranks) about 1.3 there, where the picture's pawns are about 1.1 of theirs; scaled as its
pawns scale, 1.1 near White. No bishop is clear in it: 1.15, between the knight and the queen. These replace the director's
estimates (0.75, 0.9, 1, 1, 1.15, 1.3; bases 0.55 to 0.6), which counted no outline: the picture's pieces carry a one-pixel
outline at its grid, as ours do, so ours are measured with it. Its outline is a dark warm brown round the cream pieces and
near black round the dark ones; its shading four tones on cream (a near-white highlight on the lit left, cream, a mid tone,
a warm grey-brown shade on the right) and a charcoal navy with a lighter navy strip and gold trim on Black, the light from
the top left.

**What changed** (`pieces-pixel.ts`, `arena-gl.ts`; the camera, the four views, the Pieces row, 3D and 2D as they were):
- **Sizes** (`PIXEL_TARGET`, `PIXEL_BASE`): each piece as tall and its base as wide, on screen in the high view behind White on
  its home square, as the picture's (within 0.05 and 0.04 of a square; tested, phone and computer). The pawn is 0.62 m, the
  king 1.36 m (round 1: 0.97 and 1.84), the shapes in meters (no more `PIXEL_SIZE`).
- **Shapes:** a stepped eight-sided base (its lower step's top edge the band: gold on Black), a concave skirt narrowing to a
  narrow stem, a collar a pixel thick (gold on Black), then the top: the pawn's round head; the rook's straight tower and
  three square merlons across the top as you see it (thin front to back: every piece faces the screen, so its battlements
  are a sprite's, square notches the board shows through); the knight's head as round 1's, slimmer; the bishop's mitre,
  slit and ball; the queen's wide coronet of five points standing a little above the dome inside it, and its ball; the
  king's wide crown and a chunky cross well clear of it.
- **They lean back 0.6 of your view's pitch** (0.38 before), so they stand up like the picture's sprites with little of
  their tops showing (the rook's and the queen's tops read crisp). The art pixel is worked out as before (a 1 m pawn standing
  as the pieces do, 16 art pixels): still 3 screen pixels on a 1440 × 900 computer and on a 3x phone.
- **The outline** is the picture's: dark warm brown round White, near black round Black (the depth's last bit in the small
  target marks a Black piece).
- **The shading:** cream in four tones (a near-white highlight added; the shade a warm grey-brown, not brown), Black a
  charcoal navy (a little greyer) with its lighter highlight pixels.
- **On a phone the canvas is scaled up nearest-neighbor** (`image-rendering: pixelated`, Pixel only): a 3x phone's canvas is
  capped at 2x, so an art pixel's 2 canvas pixels are 3 screen pixels; the browser blurred them before.

**Calls made:**
- The targets are the picture's near White, where the director measured. The picture draws its far pieces bigger against
  their squares than perspective would (Black's king about 2.2 squares on its own rank, as tall on screen as White's); ours
  stay in perspective, so Black's back rank is a little smaller than the picture's.
- The lean (a drawing choice for the pieces, not the camera) went up to 0.6: at 0.38 the bases read as big flat discs and
  the battlements and the coronet as cups seen from above, unlike the picture's.
- White's crown, coronet and cross stay the body's own cream (as round 1): only Black's trim is gold, as the picture's.

**Frame rate** (eric.md's method; this machine was busy, so it ran slower and spread wider than round 1's):

| | view | median fps (runs) | script a frame | draw calls |
| --- | --- | --- | --- | --- |
| phone, main 2D | White's | 14.0 (15.6, 14.9, 13.1, 10.0) | 0.35 ms | 3 |
| phone, main 3D | White's | 8.3 (13.5, 8.6, 8.0, 6.9) | 0.65 ms | 8 |
| phone, Pixel | White's | 12.4 (10.8, 12.3, 13.7, 12.5) | 0.80 ms | 10 |
| phone, branch 2D / 3D | White's | 14.0 / 7.1 | 0.49 / 0.76 ms | 3 / 8 |
| phone, high view | behind White | Pixel 13.7, 3D 8.1, 2D 11.3 | 0.99, 0.76, 0.62 ms | 10, 8, 3 |
| computer, main 2D | White's | 4.2 (3.8, 4.5, 4.1, 4.6) | 0.59 ms | 3 |
| computer, main 3D | White's | 3.3 (2.8, 3.2, 3.6, 3.4) | 0.75 ms | 8 |
| computer, Pixel | White's | 7.2 (6.9, 8.0, 6.8, 7.5) | 1.37 ms | 10 |
| computer, branch 2D / 3D | White's | 4.6 / 3.7 | 1.32 / 0.92 ms | 3 / 8 |
| computer, high view | behind White | Pixel 6.6, 3D 3.3, 2D 4.5 | 1.14, 0.77, 0.50 ms | 10, 8, 3 |

A second phone pass (six runs each, in turn): main's 2D 14.1, Pixel 12.9 in White's view and 12.2 in the high view; Pixel
ahead in four of the six pairs. With the machine drifting that much (main's own 2D runs 5.7 to 15.6), the styles were also
taken in the same page in turn (the gear's Pieces switched every 2 s window, six windows each; medians): phone, White's view
2D 10.0, Pixel 10.8, 3D 7.3; phone, high view 8.6, 9.0, 5.2; computer, White's view 2.6, 3.8, 2.3; computer, high view
2.1, 2.5, 1.8. **Pixel is level with or cheaper than 2D** on both, and far cheaper than 3D. Round 2 changes nothing a frame
on the CPU (the same draw calls, uniforms and buffers; nothing allocated); on the GPU the pieces have fewer vertices (16
steps round a turned part, not 20) and the outline reads one more bit. The script times swing as much as the frame rates
(branch 2D, unchanged code, 0.49 against main's 0.35 on a phone).

**Checks changed** (none guards a rule in eric.md): `packages/app/test/colosseum.test.ts`, "six meshes, built once…": "1.25
times the proof of concept's" (`PIXEL_SIZE` 1.5625, the pawn over 0.93 m, the king under 1.9 m) dropped, as round 2 sizes them
from the picture; the king against the pawn at most 2.1 → 2.3 (now 2.19); each mesh's height its top, added. New: "as the
picture has them (round 2)". `e2e/colosseum.spec.ts` unchanged (passes, phone and computer).
