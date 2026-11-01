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
