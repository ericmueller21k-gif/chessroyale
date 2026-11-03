# Dash's battle intro art (Nov 3)

Eric's design: "Since he's a cheetah make the animation like u both walk up to the spots, then he suddenly bolts away
leaving a train of dust and then comes back very fast drops the board, then again runs off, comes back and suddenly the
pieces are there, then again flies across and drops off both chairs, then it starts." The table is "a stack of
shoeboxes", and the screen cover is "numbers, clock/time themed". The boss is on the left and you're on the right.
- Brief: `briefs/intro-blitz.md`. The cheetah is now called **Dash** (Eric, Nov 3). The files and export ids keep
  `blitz` (`boss-blitz`, `BOSS_BLITZ_INTRO`, `house-intro-blitz`, `INTRO_BLITZ_*`).

## Cost
**Drawn by hand on the weekly plan usage** (Eric, Nov 3: the API runner's credit is out). There was no runner and no API
spend. The drawing code is in his file and the props file, written directly.

## Previews (mockups)
- **The whole intro**, side-on, about 9.0 s before the screen cover:
  [view-intro-sequence.gif](house-intro-blitz/view-intro-sequence.gif). Key frames:
  [view-intro-keyframes.png](house-intro-blitz/view-intro-keyframes.png).
  - He says his line, then bolts four times. He brings the table, then the board, then the pieces (the pop), then both
    stools.
  - Then the brag: he dusts off his jacket and finger-guns you.
  - The slab and pieces on the table are stand-ins; the game draws the real ones.
  - Made by `scripts/boss-art/intro-blitz-view.ts`.
- **The clock rush** sweeping across a phone screen in his shop (about 1.5 s):
  [view-clock-phone.gif](house-intro-blitz/view-clock-phone.gif), with stills of the sweep and the covered screen.
- **The review sheet** (every prop, the board in his colors with the town's pieces, the rush tiled 3 x 2 with its front):
  [view-sheet.png](house-intro-blitz/view-sheet.png).

## For the code helper
**Dash:** `BOSS_BLITZ_INTRO` (id `blitz-intro`) in `boss-blitz/boss-blitz.ts`. It's 150 x 108, foot [96, 103], drawn
**facing our right** (his own frames mirrored). `bolt`'s turned frames (f1 to f3) face our left, because he runs off his
own way.

| Animation | Frames | Cues | What it does |
|---|---|---|---|
| `bolt` | 5: 90, 90, 60, 60, 120 ms (420) | `whoosh` f2 | A sly grin, then a snap turn to a crouch facing left. He launches in a burst of dust with afterimages. Then he's all but gone. **f4 is empty**: only his dust cloud and speed lines remain. |
| `arrive` | 7: 50, 50, 90, 80, 110, 200, 150 ms (730) | `whoosh` f0, `skid` f2, **`drop` f4** (270 ms in) | A blur in from our left. He skids past his spot in a spray of dust, winds up, and tosses toward the table. Then he holds the pose and stands. |
| `dashBy` | 4 x 60 ms, loops | `whoosh` f0 | A full-speed run with two afterimages. Mirror it to run left; slide it about 10 to 14 px a frame. |
| `brag` | 6: 110, 110, 110, 80, 120, 500 ms (1030) | `brush` f0/f2, `ding` f4 | He dusts off his jacket, then a wink and a finger gun at you, with a glint. |
| `idle` | 1 | none | Standing, facing right. |

- **`BLITZ_INTRO_DROP_AT = [72, 0]`:** the table's foot relative to his foot in `arrive`'s drop frame. The board, the pop
  and the stools all go at the table: the stools at its foot x +- 37.
  - So he stands just left of his own stool.
  - He's at the same spot in every `arrive`, so code plays all four `arrive`s with him at the table's foot x - 72.
- **No sounds file for him** (none in `packages/app/src/characters/`). His cues are generic: `whoosh`, `skid`, `drop`,
  `thud`, `pop`, `tick`, `brush`, `ding`.
- **Parts:** his new parts (stride legs, afterimages, dust) are new names in his own parts record. His 169 existing frames
  render pixel-identical to before; I checked by comparing them.

**The props:** `house-intro-blitz/house-intro-blitz.ts`.
- `INTRO_BLITZ_TABLE`: `PARK_TABLE`'s geometry (111 x 50, foot [55, 44]). It's three shoe boxes stacked a little crooked:
  orange, black, then orange with a teal lid. Their fronts reach y 21, just under the slab. No stools.
  - `land`: 5 frames, 60, 50, 90, 90, 120 ms. `thud` f2: it drops in, squashes wide with puffs, jostles and settles.
  - `idle`.
  - **Before the board comes, the top box's own teal lid shows.** Draw the renderer's slab only from the board's drop.
- `INTRO_BLITZ_TABLE_PALETTE`:
  - The slab `"1"`-`"5"` is a teal shoe-box lid, so the board sits in a box lid.
  - The squares are mint `L` #c4ece4 and his orange `D` #e3782f. The town's cream and charcoal pieces read on both (see
    the review still).
  - `INTRO_BLITZ_TABLE_INK` holds the same squares. As with Alfil's, keep the town's `TABLE_INK` for the pieces.
- `INTRO_BLITZ_STOOL`: 34 x 36, foot [17, 31]. A shoe box stood on its end: its lid runs down its right side, with a
  white label and a swoosh. One goes at the table's foot x +- 37.
  - `land`: 5 frames, 60, 80, 70, 80, 110 ms. `thud` f1: it drops in, squashes, bounces, lands and settles.
  - `idle`.
  - `INTRO_BLITZ_STOOL_SEAT_H` = 11, the park stools' seat height.
- `INTRO_BLITZ_DUST`: 160 x 44, foot [152, 40], its right end. `idle`: 6 x 110 ms, not looping, `whoosh` f0.
  - Start it with its foot at his spot on `bolt`'s `whoosh` (f2). It runs to our left and fades by its last frame.
  - For a longer path, stretch it to our left (up to 2x wide, with its foot fixed), or lay a second copy against its
    left end. Its left end tapers to small puffs, so a copy joins without a seam.
- `INTRO_BLITZ_POP`: 80 x 56, foot [40, 50], the table's foot. `idle`: 5 frames, 50, 70, 80, 90, 110 ms.
  - Speed lines zip across the board, there's a flash, then a burst of sparkles.
  - **Show the pieces from `pop` (f1).** Start it on the third `arrive`'s `drop`.
- `INTRO_BLITZ_STORM` (128 x 128, tiles both ways) and `INTRO_BLITZ_FRONT` (48 x 128, tiles top to bottom): 6 x 70 ms,
  looping, `tick` f0. Played exactly like Alfil's sandstorm.
  - The back layer is the dark night with rulers of second ticks.
  - The middle layer is digital readouts (00:59, 12:00, 0:03, 9:58) in teal, orange and white, smeared behind.
  - The front layer is stopwatches racing past, their red hands sweeping round once a loop, with white speed lines.
  - The front's left side matches the storm. Its right edge is a ragged teal neon rim, with digits and tiny clocks flying
    out ahead.
- `HOUSE_INTRO_BLITZ`: the review sheet (706 x 268). Its animations: `idle`, `table-land`, `stool-land`, `dust`, `pop`
  and `storm`.

**Suggested timeline** (about 10.3 s with the cover; the mockup plays it):

| Time (s) | What happens |
|---|---|
| 0 | You both walk to your spots (the shared intro); his line (about 0.9) |
| 0.9 | `bolt` (the dust trail from f2) |
| 1.65 | `arrive` with the table: its `land` starts on `drop` (1.92) |
| 2.5 | `bolt` |
| 3.25 | `arrive`: the board drops onto the table on `drop` |
| 4.1 | `bolt` |
| 4.85 | `arrive`: `INTRO_BLITZ_POP` on `drop`, and the pieces are there 50 ms later |
| 5.7 | `bolt` |
| 6.45 | `arrive`: both stools `land` on `drop` |
| 7.3 | `brag` (1.0), then idle |
| about 9.0 | The clock rush sweeps across (about 1.3), and the game starts |

Each dash is 1.6 s: `bolt`, 0.33 s out of sight, `arrive`, then a beat.

## Calls Eric may want to change
- **The table comes first, then the board** (the brief's order with the shoe boxes). The pieces come third and the
  stools fourth.
- **Each dash is 1.6 s, not the brief's 2 s:** about 10.3 s in all, snappier for a speedster. Code can stretch the gap
  he's out of sight if it should feel longer.
- **He doesn't visibly carry anything.** He's a blur coming in, and the thing drops in on his toss, so the same `arrive`
  works for all four.
- **He keeps his chess clock under his arm.** It's part of his sprite. His shop has none on purpose ("funnier that
  way"), but his sprite always has.
- In `bolt` he snaps round to face our left in one frame, cartoon style.
- **The board is mint and orange.** It's loud, but the charcoal pieces read on the orange and the cream pieces on the
  mint.
- In the clock rush, each readout repeats every 64 px across, so at rest it looks like wallpaper. In motion it reads as a
  rush.
