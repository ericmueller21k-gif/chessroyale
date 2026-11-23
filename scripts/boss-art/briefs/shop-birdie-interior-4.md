# Inside Birdie's station, fourth pass: fix the bar, move the crossing to the table, a chess table

You are fixing a **room**, not a boss: the lobby inside Birdie's station (12 x 12 squares). Players tap the station, "Go in", and the
view fades into this room.

**Start from round 3's drawing:** `scripts/boss-art/out/shop-birdie-interior-3/shop-birdie-interior-3.ts`. Read it first, in line ranges.
Keep everything this brief doesn't change: its palette, floor, back wall, split-flap board, shelves, arches, airport seats, lamps, plants,
bartender's place, the vat's place, the birds on the stools, the doorway. Write your drawing to `shop-birdie-interior-4`'s own file (the
runner gives the path), in parts of at most about 250 lines per call (see round 3's brief, "How to write it": one big write ran out of
room before).

**Reference pictures** (in this run's refs folder): look at them before you draw and again before you call done.
- `eric-marks.png`: **Eric's own screenshot of round 3 in the game, on his phone, with his red marks.** The two red vertical strokes are
  where the two crossing gates must stand: one just left of the bar's front-left corner (between the west arm's stools and the table),
  one just right of the table's east stool. Everything else in this picture is round 3 as it is now: compare against it for what to change.
- `lobby-first-frame.png`: round 3's first frame at full size (your starting point).
- `park-table.png`: the town's chess table, the table **every other boss** sits at: a square table on one leg with a **chessboard on its
  top**. Birdie's must read as the same kind of table.

## What Eric said (Nov 23, his words, on round 3 in the game)
"Look at the left and right of the bar. It's flat for some reason. It should be, actually like risen, and then their stools should actually
be there as well." "I think we should make the birdseed pile bigger so it's clear, like you can see it better." "That thing at the bottom,
like where the train tracks are, that should move over on top of the table. I drew little red lines where those things should be, like the
train crossing things that come down. And then that little like red light thing ... it should start like flashing as the battle starts.
Those things come down and the train warning signs flash." "There's bird feeders sitting around that table, which there shouldn't be. And
then that table should be a squared table with a chessboard on it, just like every other boss has."

## Change (each one is checked before you call done)
1. **The bar's two arms are raised, like its front run.** Round 3 draws the west and east arms (`counter-arm`, 1 x 3) as a flat brown
   patch at floor level: only the front run has a front face. Draw each arm as a real counter: the same height as the front run, a
   **charcoal side face with the red stripe** along its whole outer side (facing the stools), the same warm-wood top with a cream edge, and
   its south end meeting the front run at a proper corner (the front run's face and the arm's face meet; no gap, no flat patch). Lift the
   "at most about 32 px" limit for the arms: use whatever height the front run has. The feeders on the arms' tops stand on that raised top.
2. **Stools along the outside of both arms,** close against the raised side face, as along the front run: west arm's stools at col 4, rows
   1-3; east arm's at col 9, rows 1-3. Birds on some of them, as now. They must read as the bar's stools (touching the bar), not as stools in
   the open floor.
3. **The birdseed pile is bigger** so it reads from across the room: the vat's heap of seed (and the yellow pile on the counter, if that is
   a separate pile) about twice as big as round 3's, a clear mound of yellow, cream, brown and red seed.
4. **No railroad crossing in the front-left corner any more.** Remove the gravel strip, its rails and ties, the X marks and its two posts from
   the corner. Fill that corner with plain floor (`floor-a`/`floor-b`) and the safety line, as the rest of the front.
5. **The crossing is at the table now.** A gravel strip with two steel rails on wooden ties runs **across the room from west to east
   through the table's row**, under the table (the table stands on the crossing, between the rails' gravel; its leg on the gravel). It
   stops one square short of each side wall's safety line. Nothing else on it but the table and its two stools.
6. **Two crossing gates, at Eric's red marks**, kitty-corner across the table: the west gate north of the tracks (just left of the bar's
   front-left corner, as his left mark), the east gate south of the tracks (just right of the table's east stool, as his right mark). Each
   is a `crossing-post` (1 x 1): a striped post, a red-and-white crossbuck, **two red lights side by side**, and a **striped barrier arm**.
   Give each gate these animations (the game plays them when a battle starts; draw them, the game wires them):
   - `idle`: arm **up** (straight up beside the post), lights **off** (dark red). Still.
   - `lower`: about 4 frames of the arm swinging down from up to level, across the tracks' side toward the table, lights flashing.
   - `down`: arm **level**, lights **flashing** in turn (left, right, about 500 ms each), looping.
   Export `SHOP_BIRDIE_GATES` (each gate's square and which way its arm points).
7. **No bird feeders on or around the table.** Remove the two on its top and the two on the floor beside it. The feeders on the bar stay.
8. **The table is a square chess table like every other boss's** (`park-table.png`): a square top **with a chessboard on it** (8 x 8 squares
   of light and dark, in his colors: cream and warm wood, a charcoal or yellow rim), on one sturdy leg. About the town table's size. Exactly
   one stool on its west side and one on its east side, facing each other, as now. No pieces on the board (the game sets the battle).

## Rules you must keep
- The room stays 12 x 12. Export `SHOP_BIRDIE_N = 12`. The bartender's 2 x 2 (cols 6-7, rows 2-3) stays clear.
- The way from the door to the table and to the bar is clear (the gates' arms are up in `idle`).
- The board shows pictures only, no letters or numbers. No letters anywhere.
- The export names stay round 3's, plus `SHOP_BIRDIE_GATES`; the whole-room Character is **`SHOP_BIRDIE_INTERIOR_4`** (id
  `shop-birdie-interior-4`), its `idle` with the gates in their `idle` (arms up, lights off), and a `review-<name>` per piece.

## Looks, then done
Render at 3x or 4x: the bar's west arm and its corner with the front run (its raised side face and its stools), the east arm the same, the
vat's seed heap, the table with its chessboard and two stools on the tracks, each gate's `idle`, `lower` (all frames) and `down`. Then the
room's idle at scale 1 (a few frames). **Before calling done, compare your room against `eric-marks.png` point by point** and write in
your notes, for each of the 8 changes above, one line saying what you drew and where. Notes also: each new or changed piece's size in
pixels and squares, and the exports.
