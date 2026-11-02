# Alfil's battle intro art (Nov 2)

Eric's design (relayed by the director): when you challenge a boss in town, you both walk into its home and into the
battle circle, and the boss says a line. Then the board appears in the boss's own way, and the boss's own transition
takes you into the game. For Alfil, a sand pyramid rises between you, cracks, and the board emerges on a table in his
colors. Then a sandstorm blows across and covers the screen.

Eric OK'd the room and approved this spend in my own dialog (about $3 to $6, capped at $8). Brief and plan:
`scripts/boss-art/briefs/intro-alfil.md`. Drawing: `house-intro-alfil/house-intro-alfil.ts`. It's art only: the code
comes later from the director's helper.

## Cost
- Opus 5.5, effort high, the spend guard on: **$3.47** of the $8 cap, 40 turns and 25 renders. It finished and called
  done (its full notes, frame by frame: `house-intro-alfil/summary.md`).
- I fixed one type error in the file: its review switch `DEV`, so the file typechecks. The art is unchanged.

## The pieces
| Export | Size, foot | What it is |
|---|---|---|
| `INTRO_ALFIL_PYRAMID` | 111 x 116, foot [55, 106] | The sand pyramid. Its foot is the table's foot, so code draws it straight over the table. Animations: `rise` (8 x 90 ms), `idle` (2 x 420 ms, loops while he speaks), `crack` (6 frames, gold light through the cracks), `crumble` (8 frames). |
| `INTRO_ALFIL_TABLE` | 111 x 50, foot [55, 44] | The town's chess table with the same geometry as `PARK_TABLE`, in his colors: a sandstone column with a gold band, and drum stools with red and blue bands. |
| `INTRO_ALFIL_TABLE_PALETTE` | | Keys `"1"`-`"5"` drive the slab the renderer draws: a gold top edge, a sandstone top and a sandstone front. `L` and `D` are the board's squares: pale sand `#ecc98c` and his blue `#3768c4`. His deep blue hid the charcoal pieces, so the ordinary blue is used. |
| `INTRO_ALFIL_TABLE_INK` | | Holds the same two square colors. **For the code helper:** in the town's renderer `TABLE_INK` is the *pieces'* ink and the squares come from the palette's `L`/`D`. So use `INTRO_ALFIL_TABLE_PALETTE`'s `L`/`D` for the squares, and keep the town's `TABLE_INK` for the pieces. |
| `INTRO_ALFIL_STORM` | 128 x 128, tiles both ways | The wall of blowing sand: three layers racing right, 6 x 70 ms, looping with no jump. |
| `INTRO_ALFIL_FRONT` | 48 x 128, tiles top to bottom | The storm's billowing leading edge, 6 x 70 ms, looping. Its left side matches the storm tile. |
| `HOUSE_INTRO_ALFIL` | 662 x 260 | A review sheet (not for the game). |

## How code plays it
1. **Rise:** the pyramid's `rise` plays on the table's square in the middle of the battle circle, cue "rumble" on frame 1.
2. **His line:** `idle` holds while he says it.
3. **Crack:** `crack`, cue "crack".
4. **Crumble:** `crumble`, cue "crumble". **The table and its board appear on crumble frame 3 (index 2).** From that frame
   the middle of the pyramid's picture is empty, so the table shows behind the falling sand. The last frame is a low
   drift of sand, which the game can keep or fade.
5. **Sandstorm:** both tiles are scaled 3x with no smoothing, on the same frame index.
   - In: a column of `FRONT` tiles sweeps from the left edge to past the right in about 0.6 s, with tiled `STORM` behind
     it.
   - Covered: a beat of full storm while the game loads.
   - Out: the storm slides off to the right, with `FRONT` mirrored as its trailing edge.

## Previews (mockups)
- The whole pyramid sequence, with the table appearing: [view-pyramid-sequence.gif](house-intro-alfil/view-pyramid-sequence.gif),
  and its key frames: [view-pyramid-keyframes.png](house-intro-alfil/view-pyramid-keyframes.png). The board on the table
  is my rough stand-in: the game's renderer draws the real slab, board and pieces through the camera.
- The sandstorm sweeping across a phone screen inside his shop: [view-sandstorm-phone.gif](house-intro-alfil/view-sandstorm-phone.gif),
  and two stills: [view-sandstorm-stills.png](house-intro-alfil/view-sandstorm-stills.png).
- The scripts: `scripts/boss-art/intro-view.ts` (the pyramid frames and storm tiles) and `scripts/boss-art/storm-view.py`
  (the storm over a phone still).

## Calls Eric may want to change
- In crumble frames 3 to 5, the falling pieces have slightly straight cut edges where they cross the table's space.
- The final sand drift covers the stools' feet a little.
- The storm's swirl marks repeat visibly across a phone screen (one tile is 384 screen px wide), so a second tile
  variant could break that up.
