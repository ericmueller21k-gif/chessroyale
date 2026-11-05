# Folio's challenge intro (Nov 5): the furniture folds itself, a paper plane brings the board, the crumple

Brief: `notes/briefs/brief-folio-sanctuary-art.md` (Eric's ideas, the director's calls). The room: `shop-folio-nov5.md`. In
Folio's sanctuary you both walk on to your marks on the clean page and Folio says its entrance line. Three flat sheets on
the page fold themselves up: two stools, then the table. A paper aeroplane folded from a ruled page glides in with the board
folded flat on its back, banks over the table, drops it and flies off; the board unfolds on the table in two folds, like a
map. Folio bows and says a quiet line. Then the screen crumples into a ball over black, holds, and opens up as the match.
The boss is on the left, you on the right. About 14.9 s.

## Cost
**Drawn by hand on the weekly plan usage**, not with the API runner. No API spend.

## Previews (mockups from the challenge camera)
- **The whole intro, phone (390 x 844, 15 fps):** [view-intro-sequence.gif](house-intro-folio/view-intro-sequence.gif).
  Key frames: [view-intro-keyframes.png](house-intro-folio/view-intro-keyframes.png) (1.5 to 14.4 s).
- **The crumple alone (20 fps):** [view-crumple.gif](house-intro-folio/view-crumple.gif), on the intro's last still.
- **Folio's moves at 3x:** [glide](house-intro-folio/move-glide.gif), [bow](house-intro-folio/move-bow.gif).
- **The props at 3x:** [a stool folding](house-intro-folio/props-stool-fold.gif),
  [the table folding](house-intro-folio/props-table-fold.gif), [the plane](house-intro-folio/props-plane.gif),
  [the board unfolding](house-intro-folio/props-board-unfold.gif).
- The camera is CHALLENGE_FEEL.cam.across (0.75 squares west and 0.8 south of the table's middle, zoom 1) under the room's
  52 px header. The board on the table, the bubbles and the match screen are stand-ins (the game draws the real ones).
- **Every figure is wholly on screen at rest and at the end of each move, on phone and computer** (`CHECK=1`): Folio at its
  mark, stepped back and bowing; you at your mark and stepped back; both stools; the table; the plane as it banks; the
  shopkeeper. The plane comes in from beyond the east wall and leaves past the north-west: it is only seen in flight.
- Made by `scripts/boss-art/intro-folio-view.ts` (its header has the commands and the GIF line); the timeline is its `TL`.

## The timeline (every beat numbered)

| # | Time (s) | What happens | Cues |
| --- | --- | --- | --- |
| 1 | 0 - 0.9 | **Walk-on.** You both come on to your marks on the clean page (Folio `glide`, mirrored to face east; then `idle`). The three flat sheets already lie on the page. | |
| 1 | 1.1 - 3.3 | Folio's entrance line: **"Every game is a draft. Shall we write one?"** | |
| 2 | 3.3 - 3.7 | You both step back a pace to make room (Folio glides to 2.3 squares west of the table's middle, you to 2.3 east). | |
| 2 | 3.75 | **The west stool folds** (`INTRO_FOLIO_STOOL` `fold`, 0.67 s): a crease lifts, its sides fold up, it stands, its seat closes. | `fold` x3, `set` |
| 2 | 4.10 | The east stool, the same. | `fold` x3, `set` |
| 2 | 4.65 | **The table folds** (`INTRO_FOLIO_TABLE` `fold`, 0.91 s): a long ridge lifts, its middle draws up into a pleated column, it stands, its top's two flaps open flat. | `fold` x3, `set` |
| 3 | 5.9 | **The plane** glides in from beyond the east wall, high (`fly`). | `whoosh` (suggested) |
| 3 | 7.15 | It banks over the table (`bank`, 0.56 s). | |
| 3 | 7.63 | It lets the board go over the table's middle (`drop`) and climbs away north-west (`away`), off the room by 9.2. | |
| 3 | 7.63 - 7.91 | The packet (the board folded in quarters: its back, Folio's seal) falls to the table's top. | `land` (suggested: a soft paper tap) |
| 3 | 8.0 - 9.06 | **The board unfolds** in two folds, like a map (`INTRO_FOLIO_BOARD` `unfold`): a flap swings east, the half sheet; a flap swings south, the whole board. | `unfold` x2 |
| 4 | 9.15 | **Folio bows** (`bow`, 1.06 s). | `bow` |
| 4 | 9.25 - 11.65 | **The quiet line** (a second bubble), one picked at random each time. | |
| 5 | 11.9 | **The crumple:** the screen taken as a still, crumpled over black (0.8 s), held (0.4 s), opened as the match screen (0.8 s), the creases' shade fading (0.26 s). | `crumple`, `open` (suggested) |
| | about 14.9 | The match. | |

The quiet lines (the code picks one at random): "It's quiet in here. Stay as long as you like." / "Come back whenever it gets
too loud out there." / "Take your time. The page will wait." / "Think as long as you need. I'm in no hurry." / "Quiet helps.
So does a clean page." (The mockup shows the third.) No "meditate" anywhere.

## For the code helper
### Folio: `BOSS_FOLIO_INTRO` (id `folio-intro`) in `boss-folio/boss-folio.ts`
- **Its drawing is the game's** (`characters/folio.ts`, left as it is): every pose is built with its own rig (`folioLayers`)
  and every part read from `FOLIO.parts`. Nothing new is drawn on it.
- **Its frame is FOLIO's:** 97 x 92, foot **[52, 86]**, drawn facing our left. **Mirror the whole frame** in the intro so it
  faces east, toward the table (as Timber and Dash are); its light then comes from the top right.
- **Its palette is FOLIO's but its shadow (`z`)**, a warm see-through brown: FOLIO's near-black shadow cut a hard bar on the
  pale paper floor.

| Animation | Frames | Cues | What it does |
| --- | --- | --- | --- |
| `glide` | 6 x 120 ms, loops | none | The walk-on (and the step back): a hover-glide, wings out lower and level, neck reaching forward, tail streaming, bobbing a pixel or two. Code slides it. |
| `bow` | 140, 120, 460, 140, 200 ms (1.06 s) | `bow` f1 | The neck dips, the head folds down, the eye closes happily, the wings lower a hair; it holds and comes back up. |
| `idle` | FOLIO's (24 x 200 ms) | | Its own idle. |

### The props: `house-intro-folio/house-intro-folio.ts` (palette `INTRO_FOLIO_PALETTE`: the room's, plus the board's ink)
- **`INTRO_FOLIO_SHEETS`** (`stool`, `table`): the three flat sheets as they lie on the clean page, **top-view pictures** to lay
  flat on the floor through the camera, as floor tiles are (`INTRO_FOLIO_SHEET_SQUARES`: 0.70 and 1.46 x 1.08 squares, a
  2 px shadow included). Each already creased with the folds it will make. Each goes when its `fold` starts.
- **`INTRO_FOLIO_STOOL`** (26 x 26, foot [13, 22]): `fold` (4 frames: 150, 150, 150, 220 ms), `idle` (the finished stool,
  its seat 11 px: the park stool's height). Stand them at `INTRO_FOLIO_STOOLS_AT` ((8.5, 10.5) and (10.5, 10.5): the park
  table's spacing).
- **`INTRO_FOLIO_TABLE`** (64 x 44, foot [32, 39]): `fold` (5 frames: 170, 170, 170, 160, 240 ms), `idle` (Folio's own
  folded table, for the battle). At `INTRO_FOLIO_TABLE_AT` (9.5, 10.5). **Its top is `INTRO_FOLIO_TABLE_TOP` = 27 px over its
  foot** (the park table's is 26), half-width `INTRO_FOLIO_TABLE_HALF` = 26 px.
- **`INTRO_FOLIO_PLANE`** (52 x 30, foot [26, 15] = its middle; code lifts it): `fly` (4 x 120 ms, loops, carrying the
  packet), `bank` (4 frames, 0.56 s: its wing's top turns toward us), `drop` (3 frames, 0.32 s, without the packet, nose
  lifting), `away` (loops). Drawn flying west (our left); mirror it to fly east. **Its route:** `INTRO_FOLIO_PLANE_ROUTE`
  ([col, row, lift in squares] and ms; eased between points): in from (17.5, 8.4) high, over the table at 1.25 s (`bank`),
  the packet let go at 1.73 s over the table's middle, away to (1.5, 4.0) by 3.3 s.
- **`INTRO_FOLIO_BOARD`** (40 x 40, top view): `packet` (the board's NW quarter: its back with Folio's seal; the falling
  packet), `unfold` (7 frames: 160, 90, 90, 150, 90, 90, 300 ms; cues `unfold` f1, f4), `full`. Lay it flat on the table's
  top through the camera: `INTRO_FOLIO_BOARD_SQUARES` = 1.0 square across, its middle on the table's, lifted to the top's
  height. The packet falls 280 ms from the plane to the top, swaying a pixel. Then the game's own board takes over.

### The crumple: `house-intro-folio/crumple.ts` (pure maths, no DOM; the code round ports it)
- **The beats:** `CRUMPLE_TIMING` = crumple 800 ms, hold 400, open 800, the creases' shade lingering 260. `crumpleAt(t)`
  gives, for a time into the beat: the crumple `p`, the ball's turn, which image (the still, then the match screen,
  cross-faded during the hold) and how much crease shade is left. These read at phone size; the ball is about 130 px across.
- **The mesh:** `cols` x `rows` = **16 x 34** over the phone (cells about 24 px), two triangles a cell, the cut alternating.
- **Where a point goes (`crumplePoint`):** flat at (x, y, 0); crumpled, wrapped round a ball of radius 0.17 x the screen's
  shorter side: its distance from the middle sets how far round (the middle stays in front, the corners reach the back), its
  direction which way. A ridged noise (seven |sin| waves, each its own direction and scale) pushes it in and out: the creases.
  In between, the edges lead the middle, and a buckle in depth and sideways peaks halfway, so the outline breaks up as it is
  crushed (not a pillow shrinking).
- **Shading (`shadeOf`):** each triangle's normal against a light from the top left and in front, Lambert, scaled so a flat
  sheet is exactly 1. A triangle turned away from us is **the paper's back: cream-grey #e3dccd with the screen showing
  through at 13%** (mirrored, as it is turned over).
- **Drawing (`crumpleMesh`):** project with a mild perspective (focal 900 px), sort far to near, map the image on each
  triangle (affine), then the shade. The mockup draws the shade into a buffer of its own (each triangle opaque, painted far
  to near) and multiplies it on once; drawn straight on, neighbours' soft edges leave a lattice. Each triangle is grown
  2 px **away from its middle** (growing by the signs of x and y leaves a right triangle's long edge where it was: a seam).
  A flat frame is drawn as the plain image. In the game, a WebGL mesh has no seams at all.
- **How the open reveals the board:** the open is the crumple run backwards on the match screen, so the board comes out of
  the ball's front first (the screen's middle stays in front of the ball) and the bars at the top and bottom last; the
  creases' shade lingers 260 ms on the flat match screen and fades, so it reads as a sheet smoothed out. The still is taken
  at 11.9 s, after the quiet line's bubble is gone.

## Calls Eric may want to change
1. **You both step back a pace** (0.4 s) before the stools fold, so the stools stand clear of you. Without it, Folio stands
   over the west stool.
2. **The sheets already lie on the page from the start** (the brief's "on the clean page lie three flat sheets"), each faintly
   creased with its folds and the table's sealed.
3. **The stools fold one after the other** (0.35 s apart), then the table; each in a few steps (stools 4, table 5).
4. **The table is Folio's own folded table** (a pleated column, a gilt-edged top), not the park table, and stays for the
   battle.
5. **The plane comes from the east**, high, banks over the table, and leaves to the north-west, off the room. It's cream with
   blue ruled lines and the pink margin line.
6. **The board stays folded (its back, the seal) until the second fold**; the squares show only as the last flap swings
   down.
7. **The bow is small** (a dip of the neck and head with a happy eye), at the moment the board is down.
8. **The crumple's ball is about 130 px across**, turns a little during the hold, and the image swaps to the match screen
   while it's a ball (a cross-fade you can't see on the small ball).
9. **The quiet line in the mockup** is "Take your time. The page will wait."; the code picks at random.
10. **About 14.9 s in all**, the crumple included (13 s to the crumple).
