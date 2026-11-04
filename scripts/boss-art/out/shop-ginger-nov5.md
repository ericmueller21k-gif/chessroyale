# Ginger's shop: an igloo candy shop run by elves (Nov 5)

Brief: `notes/briefs/brief-ginger-art.md` (Eric's design, Nov 5, and his photo of a candy-store wall,
`notes/briefs/assets/ginger-candy-dispensers.webp`). This round is art only. No app code was changed.

The drawings:
- `house-shop-ginger/house-shop-ginger.ts`: the room, built as Jefferson's warehouse is, with a round floor mask like Hollow's cave.
- `house-shop-ginger/candy-kit.ts`: the shared kit (the colors, the candy fills, the gravity bin, the tube, the candy cane, the
  barrel, the sack, the Boss Crate, the ice blocks, icicles, bulbs). It imports its canvas helpers from `warehouse-kit.ts`, which is
  already in the game. Copy it next to the shop's art, as `warehouse-kit.ts` was.
- `npc-ginger-elf/elf-rig.ts`: the elf, one rig for all of them (outfits are palette keys `o`, `O`, `p`).
- `npc-ginger-elf/npc-ginger-elf.ts`: the walkers, the dispensing pair and the two board carriers (the intro).
- `sidekick-ginger-elf/sidekick-ginger-elf.ts`: the shopkeeper.

## Cost
**Drawn by hand on the weekly plan usage**, not with the API runner. There was no API spend. The exports and the format match what
the runner makes.

## Stills
- **The room:** [house-shop-ginger/room.png](house-shop-ginger/room.png) (laid out flat, the elves in their places, the pair up on the
  catwalk).
- **The back wall from the challenge camera** (Eric's check: both rows of dispensers, the catwalk and both staircases):
  - [phone](house-shop-ginger/view-back-wall-phone.png) and [computer](house-shop-ginger/view-back-wall-computer.png): the
    dispensing pair up on the catwalk at bay-c's tubes.
  - [computer, the pair at the lower row](house-shop-ginger/view-lower-row-computer.png) (bay-c's bin).
  - On both, the whole curve shows: both staircases (at the two edges on the phone), the lower bins, the deck, the tubes and the
    top shelf. On the computer the dome's ice over the top shelf is cut by the screen's top; nothing that matters is.
- **The elves:** [npc-ginger-elf/elves-sheet.png](npc-ginger-elf/elves-sheet.png) (3x): the shopkeeper (idle, walk, sit, wave),
  the three walkers (idle, walk), elf A (walk, tap, boxOut, fill, full), elf B (walk, write), the carriers (carry, toss, cheer).
- Made by `scripts/boss-art/ginger-stills.ts` (`room`, with `ELVES=1 PAIR_T=<ms>`; `sheet`) and
  `scripts/boss-art/intro-ginger-view.ts` with `SCENE=room PAIR_T=<ms>` (the challenge camera; `CHECK=1` prints every resting
  figure's box on screen). The dome over the walls in the mockups is a stand-in (the game draws the roof).

## The room: 20 x 20 squares, 37 px a square, a round floor 10 across

### The floor mask: `SHOP_GINGER_FLOOR`
A square is floor when its middle is under 5 squares from (9.5, 9.5), plus the tunnel. Block every `#` square, as for Hollow's.

```
####################   row 0
####################
####################
####################
####################   row 4: the back wall (the catwalk is up here, see below)
########....########   row 5: columns 8-11
######........######   rows 6-7: columns 6-13
######........######
#####..........#####   rows 8-11: columns 5-14
#####..........#####
#####..........#####
#####..........#####
######........######   rows 12-13: columns 6-13
######........######
########....########   row 14: columns 8-11
#########..#########   rows 15-17: the entry tunnel, columns 9-10
#########..#########
#########..#########
#########..#########   row 18: the way out (the igloo's doorway, `entrance`, exit)
####################
```

### The back wall: the dispenser bays and the catwalk
Every square round the floor has a wall card (37 x 150, foot [18, 149], one a square). The back curve, west to east:

| square | piece | what it is |
| --- | --- | --- |
| (5, 7) | `stair-lo` | the west stairs' low square |
| (5, 6) | `stair-hi` | the west stairs' high square |
| (6, 5) | `bay-a` | bins: jelly beans, red gumballs; tubes: lemon gumballs, sprinkles, blue gumballs |
| (7, 5) | `bay-b` | bins: sours, peppermints; tubes: red and white beans, lemon drops, jelly beans |
| (8, 4) | `bay-door` | **the stockroom door** under the catwalk (the board carriers come out of it); tubes: pink gumballs, chocolates, sours. `bay-door-open` is the same card with the door open on the warm stockroom |
| (9, 4), (10, 4) | `bay-sign-w`, `bay-sign-e` | behind the shopkeeper: two shelves of candy jars and lollipops below the deck; over it, a white **CANDY** sign in a candy-stripe frame, two peppermints, gumdrops |
| (11, 4) | `bay-c` | bins: blue gumballs, chocolates; tubes: orange drops, mixed gumballs, spearmints |
| (12, 5) | `bay-d` | bins: lemon drops, pink and white beans; tubes: grape drops, red and white beans, yellow gumballs |
| (13, 5) | `bay-e` | bins: jelly beans, grape drops; tubes: blue and white gumballs, sprinkles, lemon drops |
| (14, 6) | `stair-hi` (mirrored) | the east stairs' high square |
| (14, 7) | `stair-lo` (mirrored) | the east stairs' low square |
| (7, 4), (12, 4) (mirrored) | `bay-corner` | behind the two steps of the curve, so its joins never show a gap: a bay with a wooden upright |
| (5, 5), (14, 5), (4, 7), (15, 7) | `ice` | the stairs' back corners |

**Every bay card, in px over its foot** (the same on all, so the rows run on round the curve):
- 0-4: a candy-striped kick plate. The cabinet is dark wood with posts at x 0, 18 and 36.
- **The lower row: two gravity-bin dispensers** (after Eric's photo): clear bins 15 x 18 at x 2 and 20, their tops 32 px up, a
  striped lid (each bay its own two lid colors), a glare down the plastic, a handle on the right, **a steel chute under each, its
  foot 11 px up at x 9 and 27** (`SHOP_GINGER_CHUTES.lower`). Some bins are a little emptier at the top.
- **The catwalk's deck:** its plank face 33-37 with a string of warm candy-colored bulbs along it; its lit top 38-41. **A figure up
  there stands at 40** (`SHOP_GINGER_DECK_H`).
- 42-52: the tubes' wooden shelf behind the deck.
- **The upper row: three tall clear tubes of candy**, 9 px wide at x 2, 14 and 26, from 57 to 103 px up, a steel cap, a foot ring,
  **a spout with a little lever under each, its foot 53 px up at x 6, 18 and 30** (`SHOP_GINGER_CHUTES.upper`).
- 104-109: the top shelf, wood with a candy-stripe trim, icicles under it between the tubes.
- 110-149: the dome's ice blocks, frost on the courses, icicles at the shelf.

### The two walking levels
- **`SHOP_GINGER_UPPER`** (the catwalk): **h 40**; its squares, west to east:
  **(6, 5), (7, 5), (8, 4), (9, 4), (10, 4), (11, 4), (12, 5), (13, 5)**.
  - They are back-wall squares (`#` on the mask: nobody reaches them from the floor), reached only by the stairs.
  - Walk them as a chain: one square to the next, **the steps round the curve ((7, 5)-(8, 4) and (11, 4)-(12, 5)) are diagonal**.
  - A figure up there stands on its square's middle row (its card's foot), lifted 40 px.
- **`SHOP_GINGER_STAIRS`**: two squares each, **eight steps of 5 px** (`SHOP_GINGER_STEP`), a quarter of a card each (x 0-8, 9-17,
  18-26, 27-36). The figure's lift is the step under its feet:

| stairs | foot (floor) | low square: lift by quarter, west to east | high square: lift by quarter, west to east | top (catwalk) |
| --- | --- | --- | --- | --- |
| west | (6, 7) | (5, 7): 20, 15, 10, 5 (entered from its east edge) | (5, 6): 25, 30, 35, 40 (entered from the south at its west quarter) | (6, 5) |
| east | (13, 7) | (14, 7): 5, 10, 15, 20 (entered from its west edge) | (14, 6): 40, 35, 30, 25 (entered at its east quarter) | (13, 5) |

  The stairs curve with the wall: up west across the low square, north onto the high one, up east across it onto the deck. Wooden
  steps (lit treads, plank risers), candy-cane banisters on the open side. The east stairs are the west ones mirrored.
- **Drawing a figure up there** (the catwalk or the stairs): draw it **just in front of the cards it stands on and next to** (the
  mockup draws it at the depth of the row one nearer), so no bay card covers it on the diagonal steps. **Put a small dark shadow on
  the planks under its feet** (the mockup's: an ellipse 16 x 4 px of the room's scale, #140c04 at 45%). **There is no front rail**,
  so nothing has to be drawn over a figure up there; the deck's front edge and the bulbs read as the edge (my call).

### The shop: the shopkeeper's stand
- **`counter`** (2 x 1 at (9, 6), solid; 74 x 44, foot [37, 34]): a small half-round table, its flat side to the wall, a wooden top
  (seen from a little above) **16 px up** (`SHOP_GINGER_COUNTER_TOP`), a candy-striped skirt with a belt of gumdrops. It is named
  `counter`, so `room.counter` is its squares and a tap there means talk, as in the other shops.
- **Ginger's Boss Crate** (`crate`, 30 x 32, foot [13, 30]): a present-like crate wrapped in diagonal candy stripes, a green ribbon
  both ways and a green bow, a gold tag. `idle` (6 x 160 ms): a frost glint running along its lid.
  - **`SHOP_GINGER_CRATE_AT = [52, 15]`** in the stand's px: on its east end, clear of the shopkeeper.
- **The shopkeeper** (`SHOP_GINGER_KEEPER`): drawn at **[9.5, 5.2]**, on keeper squares **{c: 9, r: 5}, {c: 10, r: 5}**, facing our
  right as drawn. His head and chest show over the stand, the crate at his left.
- `SHOP_GINGER_COUNTER_SIGN = null`: the CANDY sign is on the wall cards.

### Barrels, sacks and the sides
| piece | what it is | placed (col, row), all solid |
| --- | --- | --- |
| `barrel-canes`, `barrel-canes-b` | a wooden barrel stuffed with big candy canes (red, green, blue, purple) | (5, 9); (14, 10) |
| `barrel-candy`, `barrel-mint`, `barrel-gum` | a barrel heaped with loose candy (jelly beans, peppermints, gumballs) | (5, 10); (14, 9); (13, 12) |
| `sack` | a burlap sack of gumballs tied with red string, two spilled | (6, 12) |
| `boxes` | a little stack of white candy boxes with colored stripes | (8, 13) |

- **The sides** are lighter: ice-block walls with frost, icicles at their lips and a frost flower (`ice`, `ice-b` rows 7-10,
  `ice-c` row 11, `ice-mid` row 12, `ice-low` row 13), an **ice lantern** in a niche on each side wall (`ice-lamp` at (4, 9) and
  (15, 9) mirrored: a block of clear ice with a warm candle in it).
- **They come down toward you** (the dome), from 126 px at the back to 52 at row 13. The near ring (`hem`, rows 14-15 and 18) is a
  14 px snowy lip; the tunnel's walls (`tunnel`, columns 8 and 11, rows 15-17) are 22 px.
- **The way out** (`entrance`, 2 x 1 at (9, 18), exit; 74 x 72, foot [37, 71]): a round arch of ice blocks onto the snowy night, a
  few stars, icicles.

### The floor and the battle spot
- **The floor:** packed snow with long soft wind ripples and sparkles; a few elf boot prints. The tiles take the room's pixels, so
  the ripples run on across them: one tile a square, `floor-<col>-<row>`. Off the mask: the dome's ice (`floor-ice-<col>-<row>`),
  and night snow outside the doorway (`floor-out-<col>-<row>`). The `isFloor` prefix `floor` covers all three.
- **The battle spot** (34 tiles, `circle-<col>-<row>`, each drawn where it lies): **glossy ice**, an ellipse 208 x 156 px round the
  table's spot **(10, 10.5)**, with shine streaks, darker swirls, skate scratches and a frosted rim. The intro's shard cracks it.
- **The marks** (`SHOP_GINGER_MARKS = { boss: [8.5, 10.5], you: [11.5, 10.5] }`, 26 px, `SHOP_GINGER_MARK`): his (west) is a big
  peppermint (a red pinwheel); yours (east) a blue disk with a white snowflake. The table stands halfway between, at **(10, 10.5)**.

### Pieces
| piece | size (px) | foot | squares |
| --- | --- | --- | --- |
| bay-a to -e, bay-door, bay-door-open, bay-sign-w, -e, bay-corner, stair-lo, stair-hi, ice, ice-b, ice-c, ice-mid, ice-low, ice-lamp, hem, tunnel | 37 x 150 | 18, 149 | 1 x 1 |
| counter | 74 x 44 | 37, 34 | 2 x 1 |
| crate | 30 x 32 | 13, 30 (on the stand, see SHOP_GINGER_CRATE_AT) | (the stand's) |
| barrel-canes, -canes-b, -candy, -mint, -gum | 37 x 64 | 18, 59 | 1 x 1 |
| sack | 37 x 34 | 18, 30 | 1 x 1 |
| boxes | 37 x 40 | 18, 36 | 1 x 1 |
| entrance | 74 x 72 | 37, 71 | 2 x 1 |
| floor tiles (`floor-*`, `floor-ice-*`, `floor-out-*`, `circle-*`) | 37 x 37 | 18, 18 | 1 x 1 |

### Lights (`SHOP_GINGER_LIGHTS`, `SHOP_GINGER_POOLS`)
- **Warm candy-shop glow** (#ffcf8a): the catwalk's bulbs on every bay (strength 0.7, an 8 px halo), the two ice lanterns (1,
  flickering, a 26 px halo), the stockroom while its door is open; pools along every bay's foot and under the lanterns.
- **Cool ice** (#a8dcff): the doorway's night; a pool before it; **`SHOP_GINGER_ICE_POOL`**, the battle spot's own cool shine on the
  floor at (10, 10.5) (half-axes 104 x 70 px, strength 0.16).
- **The roof:** a new kind for ShopDef, `"igloo"`: the dome's ice blocks arching overhead in rings, pale blue (the mockups' stand-in).
  **The chat tone: day** (the room is light: white snow, pale ice).

## The elves (`npc-ginger-elf/`, `sidekick-ginger-elf/`)
One elf rig, recolored: a happy little elf about a square tall (**37 px** to the hat's top, `ELF_TALL`), drawn 1:1 at the room's
scale, a big round head, a long pointed ear, rosy cheeks, a pointed hat with a white band and a pom, a tunic with zigzag points
and a gold-buckled belt, striped tights, curly-toed shoes with a bell. **Every figure is 48 x 64, foot [22, 60], facing our
right; mirror it to face left.** Every elf has `walk` (6 x 110 ms, cue `step` f0 and f3, soft).

### The shopkeeper (`sidekick-ginger-elf`)
A red Santa hat (a white fur band, its tip flopping back, a big pom) and a green tunic. Draw him at his art's size (`tall: 37`)
or at the kids' 0.87 squares (32 px): either reads over the 16 px stand. Bake him with `scripts/bake-sidekicks.ts` as every
sidekick (the four rows):
- `idle` (12 frames, about 2.3 s): a breath, a blink, a look up at the dispensers, a happy little bounce on his toes (cue `jingle`
  f6: his shoe bells, soft).
- `walk`, `sit` (10 x 220 ms, on the park's 11 px seat, swinging his feet), `wave` (8 frames, about 1.2 s: a big hello over his head
  and a hop, cue `jingle` f2).

### The walkers (`npc-ginger-elf-red`, `-green`, `-blue`)
Each carries a **big candy cane striped white and his outfit's color**, taller than he is, its hook curling forward.
- `idle` (10 frames, 1.9 s): leaning on the cane, a look round, a grin, a little hop, the cane tapped on the floor (cue `tap` f6).
- `walk`: the cane swaying with his steps.
- **Their loops** (`SHOP_GINGER_WALKERS`, squares, a figure's foot; about 1.6 squares a second; `pause` ms standing in `idle`, facing
  the way he came; never across the battle spot):

| walker | loop |
| --- | --- |
| red | (6.2, 8.4) pause 1.4 s → (6.2, 11.6) → (7.6, 12.6) pause 1.8 s → (6.2, 11.6) → back |
| green | (13.2, 8.2) pause 1.6 s → (12.6, 7.4) → (9.0, 7.6) pause 1.2 s (in front of the stand) → (12.6, 7.4) → back |
| blue | (11.4, 12.8) pause 1.5 s → (12.6, 11.6) → (13.2, 9.0) pause 1.3 s → (12.6, 11.6) → back |

### The dispensing pair
- **Elf A** (`npc-ginger-elf-box`, yellow, a burlap sack on his back, a white candy box with a red stripe):
  - `walk` (the box at his hip);
  - `tap` (once, 4 frames, 0.46 s): he reaches up and taps the dispenser's handle (cue `tap` f1);
  - `boxOut` (once, 2 frames, 0.25 s): he holds the box out under the chute. **The box's middle is 7 px ahead of his foot
    (`ELF_BOX_DX`, `ELF_BOX_AT`), its top 12 px up**;
  - `fill` (once, 8 frames, 1.2 s): a stream of candy pours in from above and the box fills up (cue `pour` f0);
  - `full` (once, 5 frames, 0.63 s): he lifts the full box and tips it over his shoulder into his sack, candies falling in (cue
    `tip` f2), and the empty box comes back to his hip. So the loop never runs out of boxes.
  - `idle`.
- **Elf B** (`npc-ginger-elf-pad`, purple, a notepad and a pencil):
  - `walk` (writing as he goes);
  - `write` (loops, 8 frames, 1.2 s): looks up at the dispenser, scribbles, a green tick (cue `scribble` f2);
  - `idle`.

**`SHOP_GINGER_DISPENSE_PATH`** (elf A's waypoints, squares; `lvl` floor or up; `h` his lift there, px). Walk straight lines between
them (each stays on floor, stair or catwalk squares), about 1.4 squares a second. At a `stop` A faces the dispenser (`face` 1 east,
-1 west) and plays tap, boxOut, fill, full (2.5 s, plus a 0.3 s beat), while **B stands at `b`** (c, r, lift), facing the same way,
playing `write`. Between stops B follows A along the same waypoints, half a square behind. **A at a lower stop stands on the floor
square just in front of the bin (r = the bin's row + 0.6), his box under its chute; at an upper stop on the catwalk (r = the bay's
row, lift 40), his box under the tube's spout.** The loop runs about 48.7 s.

| # | A at (c, r) | lvl, h | stop: row, bay, chute (x in its card), face | B at (c, r, lift) |
| --- | --- | --- | --- | --- |
| 0 | (6, 7) | floor 0 | the west stairs' foot: start | |
| L1 | (6.04, 5.6) | floor 0 | lower, bay-a, bin 2 (x 27), east | (5.59, 5.9, 0) |
| L2 | (7.04, 5.6) | floor 0 | lower, bay-b, bin 2 (x 27), east | (6.59, 5.9, 0) |
| | (8, 7.2) → (11, 7.2) | floor 0 | round the stand's front | |
| L3 | (11.04, 4.6) | floor 0 | lower, bay-c, bin 2 (x 27), east | (10.59, 4.9, 0) |
| L4 | (11.55, 5.6) | floor 0 | lower, bay-d, bin 1 (x 9), east | (11.10, 5.9, 0) |
| L5 | (13.04, 5.6) | floor 0 | lower, bay-e, bin 2 (x 27), east | (12.59, 5.9, 0) |
| | (13.2, 7) | floor 0 | the east stairs' foot | |
| | (14, 7) → (14, 6) | stairs, 5 → 40 | up the east stairs (the quarters above) | |
| U1 | (13.18, 5) | up 40 | upper, bay-e, tube 2 (x 18), west | (13.50, 5.39, 36): the stairs' top |
| U2 | (11.85, 5) | up 40 | upper, bay-d, tube 1 (x 6), west | (12.35, 5, 40) |
| | (11.5, 4.5) | up 40 | round the curve | |
| U3 | (11.18, 4) | up 40 | upper, bay-c, tube 2 (x 18), west | (11.45, 4.42, 40) |
| | (9.5, 4) | up 40 | over the stand, behind the CANDY sign | |
| U4 | (8.18, 4) | up 40 | upper, bay-door, tube 2 (x 18), west | (8.68, 4, 40) |
| | (7.5, 4.5) | up 40 | round the curve | |
| U5 | (6.85, 5) | up 40 | upper, bay-b, tube 1 (x 6), west | (7.25, 4.7, 40) |
| | (6, 5) → (5, 6) → (5, 7) | up 40, stairs 40 → 5 | down the west stairs | |
| | (6, 7) | floor 0 | back at the start; again | |

### Sprites on screen (Eric, Nov 4)
`intro-ginger-view.ts CHECK=1` checks every resting place: the shopkeeper, every walker waypoint (the pauses and the turns), every
stop of A and B, Ginger on his mark, and the intro's carriers at the toss and watching. **All are wholly on screen on the phone and
the computer.** The walkers' loops turn inside the phone's narrow view, so they're the same on both.

## For the code helper
- **Exports from `house-shop-ginger.ts`:** `SHOP_GINGER_PIECES`, `SHOP_GINGER_LAYOUT`, `HOUSE_SHOP_GINGER`, `SHOP_GINGER_CRATE_AT`,
  `SHOP_GINGER_COUNTER_SIGN` (null), `SHOP_GINGER_MARKS`, `SHOP_GINGER_LIGHTS`, `SHOP_GINGER_POOLS`.
- **New:** `SHOP_GINGER_FLOOR` (the mask), `SHOP_GINGER_UPPER`, `SHOP_GINGER_STAIRS`, `SHOP_GINGER_STEP`, `SHOP_GINGER_DECK_H`,
  `SHOP_GINGER_DISPENSERS`, `SHOP_GINGER_CHUTES`, `SHOP_GINGER_DISPENSE_PATH`, `ELF_BOX_DX`, `SHOP_GINGER_KEEPER`,
  `SHOP_GINGER_WALKERS`, `SHOP_GINGER_COUNTER_TOP`, `SHOP_GINGER_MARK`, `SHOP_GINGER_ICE_POOL`, `SHOP_GINGER_PALETTE`,
  `SHOP_GINGER_TOP`, `SHOP_GINGER_CARD`, `footOf`.
- **A ShopDef for it** (my suggestion): `gingerbread: { home: "gingerbread", boss: "Ginger", crate: "Ginger's Boss Crate", kid:
  "elf", at: [9.5, 5.2], keeper: [{ c: 9, r: 5 }, { c: 10, r: 5 }], roof: "igloo", chatTone: "day" }` (the prize is his ride,
  `ginger-sled`, if that's the one).
- **The upper level is new:** the code needs a second walking level for the pair (and you, if Eric wants you up there: the art is
  ready for it). The data above is everything it needs: the chain, the stairs' quarters, the deck's height, and the drawing rule.
- **Swap `bay-door` for `bay-door-open`** while the intro's carriers come out (intro-ginger-nov5.md).
- **The elves:** bake each as the sidekicks are baked, one sheet each, rows by animation (all 48 x 64).

## Calls Eric may want to change
1. **The circle is exactly 10 across** (columns 5-14, rows 5-14), centred on the grid, with a 3-square tunnel and the doorway on
   row 18.
2. **The table's spot is (10, 10.5), half a square east of the circle's middle**, and the marks (8.5, 10.5) and (11.5, 10.5). With
   the challenge camera 0.75 squares west of the table, this centres the camera on the circle, so the phone's narrow view shows
   **both staircases** at its edges. With the table at 9.5 the east stairs fell off the phone's right edge.
3. **The catwalk is the back wall's own squares** (the bins below, the deck over them, the tubes behind), so walking up there is a
   chain of eight squares, not a band of floor; its two steps round the curve are diagonal.
4. **The stairs are two squares each, eight 5 px steps**, curving with the wall: little, as Eric said, and inside the phone's view.
5. **No front rail on the catwalk** (nothing drawn over a figure up there); the bulb-lit deck edge and a shadow under the feet do
   the "standing up there".
6. **The stockroom door** under the catwalk west of the shopkeeper (where the board elves come from), and **a CANDY sign** over him
   on the catwalk's rail, with shelves of jars behind him below it.
7. **Two dispensers per bay below, three tubes above**, 10 bins and 18 tubes in all, each bay its own mixes and lid colors (copies
   with color variations, as Eric said was fine).
8. **Elf A tips each full box into the sack on his back**, so he never runs out of boxes; **elf B writes on his notepad** and ticks.
9. **The walkers are red, green and blue**, the pair yellow and purple, the carriers orange and teal, the shopkeeper green in a red
   Santa hat.
10. **The stand is low (16 px) and the crate stands on its east end**, so the shopkeeper's head and chest show over it.
