# Wrangler's battle intro art (Nov 4): the lasso, the hay bale, the buckets and the wipe

Eric's design (Nov 4): he spins his lasso overhead, throws it at the corner, and yanks the hay bale with the board on it into
the middle (it slides and bumps across the straw). Then he crosses his arms and throws two ropes at once, one each way, off
screen. He yanks, and a white bucket and a black bucket come tumbling in from either side and land upside down as the
stools beside the table. The grab itself is off screen: only the ropes and the tumbling show. Then the wipe into the match:
spinning spurs, tumbleweeds and toy cap guns popping a BANG! flag. The boss is on the left and you're on the right, in about
12 s. Brief: `notes/briefs/brief-wrangler-art.md`.

## Cost
**Drawn by hand on the weekly plan usage** (Eric, Nov 4), not with the API runner. There was no API spend.

## Stills (mockups from the challenge camera)
- **The fight start**, you both on your marks: [phone](house-intro-pig/view-fight-start-phone.png) and
  [computer](house-intro-pig/view-fight-start-computer.png). The board on its hay bale is in view top left on both.
- **The intro's key frames, one sheet** (phone, 1.0 to 11.5 s): [view-intro-keyframes.png](house-intro-pig/view-intro-keyframes.png).
  These are the line, the spin, the throw, the catch, the drag, the bale in the middle, the cross throw, the buckets
  tumbling, the stools landed, the brag and the wipe half across. Re-rendered with the HunChess buckets (Nov 4). Every figure is fully on screen at rest and at the end of
  every move.
- **His moves and the props at 3x/4x:** [view-moves-and-props.png](house-intro-pig/view-moves-and-props.png).
- The camera is CHALLENGE_FEEL.cam.across (0.75 squares west and 0.8 south of the table's middle, zoom 1), under the room's
  52 px header. The slab and board on the bale are stand-ins (the renderer draws the real ones). The ropes' lines are drawn
  as `INTRO_PIG_ROPE_INK` says, to show it works. Made by `scripts/boss-art/intro-pig-view.ts` (`<dir> <phone|computer> <t,...>`).
  No GIFs (Eric, Nov 4).

## For the code helper
### Wrangler: `BOSS_PIG_INTRO` (id `pig-intro`) in `boss-pig/boss-pig.ts`
- **There is no runner copy of him.** His drawing is the game's (`characters/pig.ts`), so every pose is built with his own
  rig (`pigLayers`), and its parts are made into his own parts record (PIG.parts). His old frames are untouched.
- **His frame is PIG's:** 115 x 77, foot **[43, 73]**, drawn as his sprite is (facing front, turned a little to our left),
  lit from the top left. **Not mirrored.** His halo and palette are PIG's.

| Animation | Frames | Cues | What it does |
|---|---|---|---|
| `spin` | 8 x 60 ms, loops | `whirl` f0 | The lasso whirling overhead, wider and faster than his idle's, a lean and a glare. |
| `throw` | 90, 70, 120, 200 ms (480) | `throw` f1 | The loop swung back over his head, then flung out to our upper left (f1, the loop just leaving his hand). His arm stays out after it (f2, f3). |
| `yank` | 4 x 120 ms, loops | `yank` f0, f2 | Heels dug in, leaning back to our right, both fists on the rope low on our left. A heave every other frame, with a shake and dust off his heels. |
| `crossThrow` | 100, 90, 70, 70, 70, 70, 110, 70, 160, 220 ms (1030) | `windup` f0, `throw` f7 | The coil shaken out into a second loop, both spun overhead, arms flung wide, then crossed: both loops thrown at once, one each way (f7). His lasso arm (on our left) throws across to our right, and his other arm across to our left. He holds them out, crossed (f8, f9). |
| `doubleYank` | 140, 130, 120, 120, 150, 200 ms (860) | `yank` f1, f3 | Braced with arms crossed (f0), then flung wide apart (f1): the ropes cross in front of him. A second, smaller heave (f3), and he stands with the slack ropes (f5). |
| `brag` | 12 frames, about 1.5 s | `whirl` f0, `tip` f2, `laugh` f5, `snort` f7, `stomp` f10 | The lasso spun back up, a hat tip, a snorting laugh, and a spur stomp with a glint. It ends on his idle's first frame. |
| `idle` | 1 | none | His idle's first frame. |

- **`PIG_INTRO_HANDS`** (his lasso arm) and **`PIG_INTRO_HANDS2`** (his other arm) give, per animation and frame, where the
  rope leaves his fist, in his frame's pixels (as `foot` is). The value is null where the rope is drawn in his own frame (or
  he has none).
  - `throw` f2-f3 is [7, 31] and [8, 31].
  - `yank` is [19, 50], [19, 50], [15, 47], [15, 47].
  - `crossThrow` f8-f9 is [49, 46] (lasso arm, its rope to our right) and [35, 47] (the other, to our left).
  - `doubleYank` gives both on every frame. The lasso arm's fist ends on our left (about [16, 49]) still holding the rope
    to our right, so the ropes cross.
- **`PIG_INTRO_RELEASE = { throw: 2, crossThrow: 8 }`:** the frame each rope leaves his sprite and becomes code's.

### The props: `house-intro-pig/house-intro-pig.ts`
- **`INTRO_PIG_ROPE`** (the loop): 48 x 28, foot [24, 24].
  - `fly`: 4 x 60 ms, loops. The open loop spinning through the air, its foot the loop's middle.
  - `catch`: 70, 70, 90, 120 ms, with `catch` f2 and `snap` f3. It drops over the bale and is pulled tight round it.
  - `cinched`: 1 frame. Tight round the bale while it's dragged.
  - `free`: 3 x 80 ms, with `flick` f0. Shaken loose off the bale and flicked up, gone.
  - For `catch`, `cinched` and `free`, **its foot is the bale's foot (the table's foot)**: the loop sits 10 px up round the
    34 px bale (only its front half is drawn, so it reads as round the bale). Raise it with `INTRO_PIG_TABLE_LIFT` while
    sliding.
  - **`INTRO_PIG_ROPE_KNOT`**: per anim and frame, where the line meets the loop (in the rope's pixels).
- **The line** (hand to knot, or hand to a bucket's handle, or hand to off screen) is code's: **`INTRO_PIG_ROPE_INK`**.
  - Draw it at the room's scale: `width` 2 art px in `mid`, an `outline` round it, and a `dark` tick every `twist` (3) px,
    so it reads as twisted rope.
  - It is taut while he hauls. In flight it bows into a curve (`sag` about 12% of its length). The mockup draws exactly
    this.
- **`INTRO_PIG_TABLE`** (the hay bale): PARK_TABLE's geometry, **111 x 50, foot [55, 44]**, with the slab's top 27 over the
  foot. It is the bale alone (no stools): the renderer draws the slab and the board on it.
  - It is the same bale as the barn's `board-stand`, so **hide the room's `board-stand` and put the table at its foot**
    (square `SHOP_PIG_BOARD_AT` = (4, 3)) when the intro starts.
  - `idle`.
  - `slide`: 4 x 90 ms, loops, with `slide` f0. Dragged: it bumps, straw flies off its sides and dust scrapes up under it.
    **`INTRO_PIG_TABLE_LIFT.slide = [0, 1, 2, 1]`**: draw the slab and board that much higher on each frame.
  - `land`: 90, 110, 120, 200 ms, with `thunk` f0. It stops in the middle in a puff of straw.
- **`INTRO_PIG_TABLE_PALETTE`:** the slab is a plank board ("1" #e0b070 to "5" #52301a). The squares are straw cream `L`
  #efd9a4 and barn red `D` #b5523a. **`INTRO_PIG_TABLE_INK`** gives the same squares with their shades and lines. As with
  Alfil's, keep the town's `TABLE_INK` for the pieces: the charcoal pieces read on the barn red.
- **`INTRO_PIG_BUCKET_B`** (black, from our left: his stool) and **`INTRO_PIG_BUCKET_W`** (white, from our right: yours):
  **the HunChess bucket**, redrawn twice on Nov 4 from Eric's photo of a classic 5-gallon hardware bucket. The drawing is
  shared with the barn's and Puddles' decoration buckets: `house-shop-pig/hunchess-bucket.ts` (`pail`, `standingBucket`,
  `BUCKET_PALETTE`).
  - **The size is 64 x 72, foot [32, 64]** (the first draw was 40 x 40, foot [20, 35]). The bucket is a **straight
    cylinder, 26 px across and 26 tall, with no taper**. At its open end is a **wide, thick rim band of two stacked ridges**,
    29 px across, clearly wider than the body. A thin wire handle hooks into two lugs just under the band, with a plastic
    grip in its middle. There is a soft highlight stripe down its lit side, and the rope's end is knotted on the grip.
  - **"HunChess"** is in bold 3 x 5 pixel letters on its body, in two lines (Hun over Chess). It's **white on the black
    bucket and black on the white one**. It's **printed the normal way**: it reads right way up when the bucket stands rim
    up, so **on the landed stool it reads upside down** (Eric, Nov 4: realistic). It shows as they tumble in. There's no
    other text or mark.
  - `tumble`: 8 x 60 ms, loops, with `clatter` f0 and f4. End over end, turning toward the middle (the black clockwise, the
    white the other way), with a little hop. Its lowest point stays on the floor. **When its mouth faces up toward us, the
    open mouth shows**: the rim band all round, the dark inside and its far inner wall.
  - `land`: 70, 90, 80, 140 ms, with `clatter` f0 and `thunk` f1. It comes down upside down, mouth to the floor, bounces,
    and settles. The knot is untied from f2.
  - `stool` (and `idle`): upside down, **the flat base on top** (a recessed ring in it), the rim band at the floor, the
    handle lying behind it.
  - **`INTRO_PIG_BUCKET_SEAT_H` = 26** (it was 11, the park stools' seat): its seat (the base) is 26 px over the foot, so
    you and he sit higher than on the park stools, about level with the table's slab (27). Eric said that's fine. Sit
    figures at this height on these stools.
  - Place one at the table's foot x - 37 (black) and + 37 (white), as before. **Checked** in the key frames and on the
    computer camera: both are clear of the bale, his clear place and yours, with nobody moving, all on screen.
  - **`INTRO_PIG_BUCKET_HANDLE`**: by `<w|b>:<tumble|land>` and frame, where the handle's grip is (the rope's end), in the
    bucket's pixels.
- **`INTRO_PIG_STORM`** (128 x 128, tiles both ways) and **`INTRO_PIG_FRONT`** (48 x 128, tiles top to bottom): 6 x 70 ms,
  looping, with cues `jingle` f0 and `pop` f3 on the storm. Play them exactly like Alfil's sandstorm: the tile at 3x behind
  its front, sweeping in from the left.
  - The back layer is a dusty sunset in bands (gold, orange, salmon, rose, plum) with streaks of blown dust.
  - The middle layer is dust puffs and twinkles.
  - The front layer is two tumbleweeds rolling, two gold spurs spinning, and two **toy cap guns**: chunky plastic
    six-shooters, one red and one blue, with fat orange safety tips and cream grips with a star. Each pops a cap puff, then
    a **BANG!** flag on a stick, out of step with the other.
  - The front's left side matches the storm. Its right edge is a billowing dust cloud rimmed with a twisted rope, with dust
    puffs and spur sparks flying out ahead.

### Sounds
His sounds are in `characters/pig-sounds.ts` (`whirl`, `throw`, `catch`, `tug`, `tip`, `laugh`, `snort`, `stomp`, `windup`,
`hop`, `draw`, `yank`). The cues and where they fit:

| Cue | Where | Sound |
|---|---|---|
| `whirl` | `spin` f0 (each loop), `brag` f0 | his `whirl` (lasso swishing round) |
| `throw` | `throw` f1, `crossThrow` f7 | his `throw` (twice at once, a hair apart, for the cross throw) |
| `catch` | the rope's `catch` f2 | his `catch` (the loop slapping down) |
| `snap` | the rope's `catch` f3 | his `tug` (the rope snapping taut) |
| `yank` | `yank` f0/f2, `doubleYank` f1/f3 | his `yank` |
| `slide` | the table's `slide` f0, looped while it slides | **new**: a dry scrape of straw on boards (his `tug`'s drag noise, longer and lower, would do) |
| `thunk` | the table's `land` f0, each bucket's `land` f1 | his `hop` (a dull thump), a little higher for the buckets |
| `flick` | the rope's `free` f0 | his `throw`, short and quiet |
| `windup` | `crossThrow` f0 | his `windup` |
| `clatter` | each bucket's `tumble` f0/f4 and `land` f0 | **new**: a hollow plastic bucket clonk with a wire-handle rattle |
| `tip`, `laugh`, `snort`, `stomp` | `brag` f2, f5, f7, f10 | his own |
| `jingle` | the wipe, as it comes in | **new**: spur rowels jingling (a dull clink, no chimes, as his file's rule says) |
| `pop` | the wipe, as it comes in | **new**: a toy cap's pop (a small dry snap, not a gunshot); or his `draw` sting for the whole wipe |

### Suggested timeline (about 12 s; the mockup plays it)
His mark is the usual (8, 10.5). In the mockup he stands at his clear place (7.2) all along and you at yours (11.6), so the
bale and the buckets come in without anyone moving. Code can walk him there, or hop him back as the buckets land.

| Time (s) | What happens |
|---|---|
| 0 | You both on your marks, his line (the shared intro, about 2.5) |
| 2.8 | `spin` (1.0) |
| 3.8 | `throw`. The loop leaves his hand at 3.89, flies (`fly`) from PIG_INTRO_HANDS to the bale in a high arc, and lands at 4.4 |
| 4.4 | The rope's `catch` (0.35), then `cinched` |
| 4.75 | `yank` loops. From 4.85 to 6.45 the table `slide`s from (4, 3) to the table's spot (9.5, 10.5): a curve that bows west through (5, 9) and swings east into place, eased in and out |
| 6.45 | The table's `land` (0.52); he goes to his idle |
| 6.65 | The rope's `free` (0.24), and the line reels in to his hand (0.2) |
| 7.1 | `crossThrow` (1.03). At 7.75 both ropes fly off screen each way (0.4), and stay out taut |
| 8.2 | `doubleYank` (0.86). On its yank (8.34) the buckets come `tumble`-ing in along the floor from just off each edge, the ropes on their handles (0.76) |
| 9.1 | The buckets `land` upside down at the table's foot x +- 37 (0.38). The ropes go slack and reel in |
| 9.65 | `brag` (1.5), then his idle |
| 11.2 | The wipe sweeps in (0.6), holds while the battle loads, and slides out |

## Calls Eric may want to change
1. **The black bucket is his stool (from our left) and the white one is yours (from our right).**
2. **The cross throw:** his lasso arm (his right, on our left) throws across to our right, and his other arm across to our
   left, so his arms are crossed when he throws. On the yank he flings them wide, and the ropes cross in front of him.
3. **The bale's drag** curves down the west side and swings east into the middle, so it passes beside him rather than
   through him.
4. **The buckets are classic 5-gallon hardware buckets** (Eric, Nov 4), about as tall as the bale, their seats at 26 px
   (the park stools' are 11). "HunChess" is in two lines: one line of 3 x 5 letters (31 px) won't fit across a 26 px body
   without a bucket taller than the table.
5. **In the mockup, he and you stand at your clear places from the start.**
6. **The wipe's toy guns** are chunky red and blue plastic with orange safety tips, and their flags read BANG!
7. **The table's slab is a plank board, and the board is straw cream and barn red.**
8. There is no review sheet Character for the props (HOUSE_INTRO_PIG); the moves-and-props still covers it.
