# Ginger's shop: an igloo candy shop run by gnome-ish elves (Nov 5, revised after Eric's look the same day)

Brief: `notes/briefs/brief-ginger-art.md` (Eric's design, Nov 5, and his photo of a candy-store wall,
`notes/briefs/assets/ginger-candy-dispensers.webp`). Eric's fixes after the first stills (Nov 5), all in this revision:
1. the battle spot and the table centred in the room;
2. the falling ice as a tall icicle with a round flat top (intro-ginger-nov5.md);
3. the candy dispensers carried on round both curved side walls;
4. the staircases joined to the catwalk and the floor: after his second look (his crop of room.png), each is now **one straight
   flight on the catwalk's own row**, so it joins in the flat room still as well as from the camera;
5. no gaps in the igloo's walls;
6. smaller, gnome-ish elves.

This round is art only. No app code was changed.

The drawings:
- `house-shop-ginger/house-shop-ginger.ts`: the room, built as Jefferson's warehouse is, with a round floor mask like Hollow's cave.
- `house-shop-ginger/candy-kit.ts`: the shared kit (the colors, the candy fills, the gravity bin, the tube, the candy cane, the
  barrel, the sack, the Boss Crate, the ice blocks, icicles, bulbs). It imports its canvas helpers from `warehouse-kit.ts`, which is
  already in the game. Copy it next to the shop's art, as `warehouse-kit.ts` was.
- `npc-ginger-elf/elf-rig.ts`: the elf, one rig for all of them (outfits are palette keys `o`, `O`, `p`).
- `npc-ginger-elf/npc-ginger-elf.ts`: the walkers, the dispensing pair and the two board carriers (the intro).
- `sidekick-ginger-elf/sidekick-ginger-elf.ts`: the shopkeeper.

## Cost
**Drawn by hand on the weekly plan usage**, not with the API runner. There was no API spend.

## Stills
- **The room:** [house-shop-ginger/room.png](house-shop-ginger/room.png) (laid out flat, the elves in their places, the pair up on the
  catwalk).
- **The back wall from Ginger's challenge camera** (Eric's check: both rows of dispensers, the catwalk and both staircases):
  - [phone](house-shop-ginger/view-back-wall-phone.png) and [computer](house-shop-ginger/view-back-wall-computer.png): the pair up
    on the catwalk at bay-c's tubes.
  - [computer, the pair at the lower row](house-shop-ginger/view-lower-row-computer.png).
  - On both, the candy wall runs from the near side walls on the left, round the back and down the right. The stairs at each end
    of the catwalk show at the phone's two edges, with the lower bins, the deck, the tubes and the top shelf.
- **The stairways close up, 3x:** [house-shop-ginger/stairs-west.png](house-shop-ginger/stairs-west.png) and
  [house-shop-ginger/stairs-east.png](house-shop-ginger/stairs-east.png). Each shows the flat room still (left) and the computer's
  challenge camera (right). On the computer the
    dome's ice over the top shelf is cut by the screen's top; nothing that matters is.
- **The elves:** [npc-ginger-elf/elves-sheet.png](npc-ginger-elf/elves-sheet.png) (4x):
  - the shopkeeper: idle, walk, sit, wave;
  - the three walkers: idle, walk;
  - elf A: walk, tap, boxOut, fill, full;
  - elf B: walk, write;
  - the carriers: carry, toss, cheer.
- **How they were made:**
  - `scripts/boss-art/ginger-stills.ts`: `room` (with `ELVES=1 PAIR_T=<ms>`) and `sheet`.
  - `scripts/boss-art/intro-ginger-view.ts` with `SCENE=room PAIR_T=<ms>`: Ginger's challenge camera. `CHECK=1` prints every
    resting figure's box on screen.
  - The dome over the walls in the mockups is a stand-in: the game draws the roof.

## The camera: Ginger's own framing
**`INTRO_GINGER_CAM = { south: 0.8, west: 0, zoom: 1 }`** (house-intro-ginger.ts). It is CHALLENGE_FEEL.cam.across's south and
zoom, **but centred on the table (west 0, not 0.75)**.
- Why: with the battle spot in the room's middle and the usual 0.75 west, the phone's narrow view lost the east stairs. Eric said to
  fix that "by moving/curving the stairs or the camera framing, not by off-centering the fight".
- Centred, the phone sees the round room symmetrically, and both staircases sit at its edges.
- The code needs a new per-boss field for it (a `cam` override on BossIntro).
- Ginger, wide as he is, is still wholly in view on his mark (checked).

## The room: 20 x 20 squares, 37 px a square, a round floor 10 across

### The floor mask: `SHOP_GINGER_FLOOR`
A square is floor when its middle is under 5 squares from (9.5, 9.5), plus the tunnel and **the four squares at the stairs' feet:
(5, 6), (5, 7), (14, 6), (14, 7)**. Block every `#` square, as for Hollow's.

```
####################   row 0
####################
####################
####################
####################   row 4: the back wall (the catwalk is up here, see below)
########....########   row 5: columns 8-11
#####..........#####   rows 6-7: columns 6-13, and the stairs' feet (5, 6), (5, 7), (14, 6), (14, 7)
#####..........#####
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

### The walls: one continuous curve
- Every square round the floor has a wall card, including the corner squares the curve steps across, so there are no holes.
- **Every wall card is 45 x 150, foot [22, 149]: its square's 37 px and 4 px more each side.** Each overlaps its neighbours by 4 px,
  so the stepped curve shows no gaps or notches between cards at any camera place.
- **No outside colour shows inside the room:** the floor tile under every wall card is the floor's snow (a shade bluer at the wall's
  foot), and under the back curve's bays and stairs it is wooden boards with a candy-trim kick board. So nothing dark shows between
  the cards' feet and the floor, the deck's front, the stairs or the side walls.
- The dome's ice comes down smoothly toward you.
  - Each near wall card's top slopes from its row's height to the next.
  - Row 11 and back are the candy wall (ice over it from 114 to 149 px).
  - The tops then go down: row 12 about 86-72, row 13 59-46, row 14 37-28, row 15 25-22, the tunnel 20-16.

**The candy wall, west to east** (the east side mirrors the west):

| square(s) | piece | what it is |
| --- | --- | --- |
| (4, 11), (4, 10), (4, 9), (4, 8) | `side-d`, `side-c`, `side-b`, `side-a` | **the candy wall carried on down the west side** (Eric's fix 3): two bins and three tubes each, on a plain ledge (no bulbs: not walked on); the ice over them 114-126 |
| (4, 7), (4, 6), (4, 5) | `side-corner` | the side's corners: a bin pair, two tubes and a wooden upright |
| (5, 5) | `stair-lo` | **the west stairs' low square**: steps 5-20 on the catwalk's row, the cabinet's wood behind, the tubes above |
| (6, 5) | `stair-hi` | **the west stairs' high square**: steps 25-35, its east quarter the deck itself (40); tubes above |
| (7, 5) | `bay-b` | bins: sours, peppermints; tubes: red and white beans, lemon drops, jelly beans |
| (7, 4) | `bay-corner` | behind the curve's step: a bay with a wooden upright |
| (8, 4) | `bay-door` | **the stockroom door** under the catwalk (the board carriers come out of it); tubes above. `bay-door-open` is the same card with the door open on the warm stockroom |
| (9, 4), (10, 4) | `bay-sign-w`, `bay-sign-e` | behind the shopkeeper: shelves of candy jars and lollipops below the deck; over it a white **CANDY** sign in a candy-stripe frame |
| (11, 4) | `bay-c` | bins: blue gumballs, chocolates; tubes: orange drops, mixed gumballs, spearmints |
| (12, 4) | `bay-corner` (mirrored) | behind the curve's step |
| (12, 5) | `bay-d` | bins: lemon drops, pink and white beans; tubes: grape drops, red and white beans, yellow gumballs |
| (13, 5), (14, 5) | `stair-hi`, `stair-lo` (mirrored) | the east stairs, the same flight mirrored |
| (15, 5), (15, 6), (15, 7) | `side-corner` (mirrored) | |
| (15, 8) to (15, 11) | `side-a` to `side-d` (mirrored) | the candy wall down the east side |
| rows 12-13 | `ice-12`, `ice-lamp`, `ice-13` | the dome's ice where the candy ends; an **ice lantern** in a niche at (5, 12) and (14, 12) (a block of clear ice with a warm candle) |
| rows 14-17 | `hem`, `hem-15`, `tunnel` | the low near ring and the tunnel's walls |
| (9, 18) | `entrance` (2 x 1, exit) | a round arch of ice blocks onto the snowy night, 74 x 72, foot [37, 71] |

**Every bay card, in px over its foot.** These are the same on all, so the rows run on round the curve. Card x is in its 45 px; the
square's own 37 px are x 4-40.
- **0-4:** a candy-striped kick plate, under a cabinet of dark wood with posts at x 4, 22 and 40.
- **The lower row: two gravity-bin dispensers** (after Eric's photo).
  - Clear bins 15 x 18 at x 6 and 24, their tops 32 px up.
  - A striped lid, a glare down the plastic and a handle on the right.
  - **A steel chute under each, its foot 11 px up at x 13 and 31** (`SHOP_GINGER_CHUTES.lower`).
- **The catwalk's deck:**
  - its plank face 33-37, with a string of warm bulbs along it and **a candy-cane edge** along its top (round the sides a plain
    ledge);
  - its lit top 38-41. **A figure up there stands at 40** (`SHOP_GINGER_DECK_H`).
- **42-52:** the tubes' wooden shelf.
- **The upper row: three tall clear tubes of candy.**
  - 9 px wide at x 6, 18 and 30, from 57 to 103 px up.
  - **A spout under each, its foot 53 px up at x 10, 22 and 34** (`SHOP_GINGER_CHUTES.upper`).
- **104-109:** the top shelf (a candy-stripe trim).
- **Above:** the dome's ice.

### The two walking levels
- **`SHOP_GINGER_UPPER`** (the catwalk) is at **h 40**. Its squares, west to east:
  **(7, 5), (8, 4), (9, 4), (10, 4), (11, 4), (12, 5)**.
  - It is six squares now: (6, 5) and (13, 5) are the stairs' high squares, whose top quarters are the deck.
  - They are back-wall squares, reached only by the stairs.
  - Walk them as a chain, one square to the next. **The steps round the curve ((7, 5)-(8, 4) and (11, 4)-(12, 5)) are diagonal.**
  - A figure up there stands on its square's middle row, lifted 40 px.
  - The side bays' ledges are not part of it.
- **`SHOP_GINGER_STAIRS`**: **one straight flight per side, on the catwalk's own row** (Eric's second look, Nov 5: "one continuous
  flight per side").
  - Two squares each, **eight steps of 5 px** (`SHOP_GINGER_STEP`), a quarter of the square each.
  - The quarters are x 4-12, 13-21, 22-30 and 31-40 of the 45 px card. The outer quarters run on over the overlaps.
  - The figure's lift is the step under its feet:

| stairs | foot (floor) | low square: lift by quarter, west to east | high square: lift by quarter, west to east | top (catwalk) |
| --- | --- | --- | --- | --- |
| west | **(5, 6)** | **(5, 5)**: 5, 10, 15, 20 (entered from the foot at its west quarter) | **(6, 5)**: 25, 30, 35, 40 (its east quarter is the deck) | **(7, 5)** |
| east | **(14, 6)** | **(14, 5)**: 20, 15, 10, 5 (entered from the foot at its east quarter) | **(13, 5)**: 40, 35, 30, 25 (its west quarter is the deck) | **(12, 5)** |

- **Why it joins now:**
  - Both stair cards stand on the same row as the catwalk's, so the flight is one piece both laid out flat and from the camera.
  - Its foot steps off onto the floor square in front, (5, 6) or (14, 6).
  - **Every step is a solid wooden block down to the floor**, each one touching the next.
  - **The top step is the deck itself:** the catwalk's planks, its bulbs and its candy-cane edge, on a wooden support down to the
    floor, running on into the catwalk at (7, 5) or (12, 5).
  - **One candy-cane banister runs unbroken** from the foot along the whole flight onto the deck's candy-cane edge: the same rail line
    across both cards.
  - Behind the flight are the cabinet's wood (a candy-trim kick board at its foot), the tubes on their shelf, the top shelf and the
    ice.
- **What changed for it:**
  - the stairs moved from (5, 6)-(5, 7) and (14, 6)-(14, 7) to (5, 5)-(6, 5) and (13, 5)-(14, 5);
  - their old squares are floor (the feet);
  - bay-a and bay-e, which stood at (6, 5) and (13, 5), are gone. Their candy is on the stairs' wall above the steps, and the side
    bays carry the rest round.
  - The dispensing loop changed with it (below).
- **Drawing a figure up there** (the catwalk or the stairs):
  - Draw it just in front of the cards it stands on and next to. The mockup draws it at the depth of the row one nearer.
  - Put a small dark shadow on the planks under its feet: an ellipse 16 x 4 px of the room's scale, #140c04 at 45%.
  - There is no front rail.

### The shop: the shopkeeper's stand
- **`counter`** (2 x 1 at (9, 6), solid; **74 x 38, foot [37, 28]**):
  - A small half-round table: a wooden top **10 px up** (`SHOP_GINGER_COUNTER_TOP`) and a candy-striped skirt with gumdrops.
  - It's lowered for the smaller shopkeeper, so his face, beard and hat show over it.
  - Its squares mean talk, as a counter's do.
- **Ginger's Boss Crate** (`crate`, 30 x 32, foot [13, 30]):
  - A present-like crate in diagonal candy stripes, with a green ribbon and bow and a gold tag.
  - `idle`: a frost glint along its lid.
  - **`SHOP_GINGER_CRATE_AT = [52, 15]`** in the stand's px, on its east end.
- **The shopkeeper** (`SHOP_GINGER_KEEPER`):
  - drawn at **[9.5, 5.2]**, on keeper squares **{c: 9, r: 5}, {c: 10, r: 5}**;
  - facing our right as drawn.
- `SHOP_GINGER_COUNTER_SIGN = null`: the CANDY sign is on the wall cards.

### Barrels, sacks and the floor round the sides
| piece | what it is | placed (col, row), all solid |
| --- | --- | --- |
| `barrel-canes`, `barrel-canes-b` | a barrel stuffed with big candy canes | (5, 11); (12, 13) |
| `barrel-mint`, `barrel-candy`, `barrel-gum` | a barrel heaped with loose candy | (14, 11); (7, 13); (13, 12) |
| `sack` | a burlap sack of gumballs, two spilled | (6, 12) |
| `boxes` | a stack of white candy boxes | (8, 13) |

They stand toward the front, clear of the candy wall and the battle spot.

### The floor and the battle spot (centred: Eric's fix 1)
- **The floor:** packed snow with soft wind ripples, sparkles and a few elf boot prints, one tile a square (`floor-<col>-<row>`).
  - Off the mask: the dome's ice (`floor-ice-*`), and night snow outside the doorway (`floor-out-*`).
- **The battle spot** (32 tiles, `circle-<col>-<row>`, each drawn where it lies):
  - **Glossy ice**, an ellipse 208 x 156 px **round the room's middle, (9.5, 9.5)**.
  - Shine streaks, darker swirls, skate scratches and a frosted rim.
- **The marks** (`SHOP_GINGER_MARKS = { boss: [8, 9.5], you: [11, 9.5] }`, 26 px):
  - his is a big peppermint;
  - yours a blue disk with a white snowflake.
  - **The table stands halfway between, at (9.5, 9.5).**

### Pieces
| piece | size (px) | foot | squares |
| --- | --- | --- | --- |
| bay-b, -c, -d, bay-door, bay-door-open, bay-sign-w, -e, bay-corner, side-a to -d, side-corner, stair-lo, stair-hi, ice-12, ice-lamp, ice-13, hem, hem-15, tunnel | **45 x 150** | **22, 149** | 1 x 1 (4 px over each neighbour) |
| counter | 74 x 38 | 37, 28 | 2 x 1 |
| crate | 30 x 32 | 13, 30 (on the stand: SHOP_GINGER_CRATE_AT) | (the stand's) |
| barrel-canes, -canes-b, -candy, -mint, -gum | 37 x 64 | 18, 59 | 1 x 1 |
| sack | 37 x 34 | 18, 30 | 1 x 1 |
| boxes | 37 x 40 | 18, 36 | 1 x 1 |
| entrance | 74 x 72 | 37, 71 | 2 x 1 |
| floor tiles (`floor-*`, `floor-ice-*`, `floor-out-*`, `circle-*`) | 37 x 37 | 18, 18 | 1 x 1 |

### Lights (`SHOP_GINGER_LIGHTS`, `SHOP_GINGER_POOLS`)
- **Warm candy-shop glow** (#ffcf8a):
  - the catwalk's bulbs on every back bay;
  - the two ice lanterns (flickering, a 26 px halo);
  - the stockroom while its door is open;
  - pools along every bay's and side bay's foot.
- **Cool ice** (#a8dcff):
  - the doorway's night;
  - **`SHOP_GINGER_ICE_POOL`**, the battle spot's shine on the floor at **(9.5, 9.5)**.
- **The roof:** a new ShopDef kind, `"igloo"`: the dome's ice blocks arching overhead (the mockups' stand-in). **Chat tone: day.**

## The elves: little gnome-ish elves (Eric's fix 6)
- One rig, recolored: short and round, **25 px from their boots to their hat's tip** (`ELF_TALL`), about two thirds of a square,
  drawn 1:1 at the room's scale. Before, they were 37 px.
- **The look:** a big pointy hat with a white band and a pom; a round head with a **big round nose** and rosy cheeks; a little
  pointed ear; a round tunic with a gold-buckled belt; **stubby legs and big round boots**.
- **Some have a little white beard:** the shopkeeper, the red and blue walkers, and elf B.
- **Every figure is 36 x 44, foot [17, 41], facing our right; mirror it to face left.**
- Every elf has `walk` (6 x 110 ms, little stumpy steps, cue `step` f0 and f3, soft).

### The shopkeeper (`sidekick-ginger-elf`)
- The look: a red floppy Santa hat with a white fur band and a big pom, a white beard, a green tunic.
- **Draw him at his art's size (`tall: 25`)**: the kids' 0.87 squares would make him bigger than the other elves.
- He shows over the 10 px stand from his beard up.
- Bake him with `scripts/bake-sidekicks.ts` (the four rows).
- Animations:
  - `idle` (12 frames, about 2.3 s): a breath, a blink, a look up at the dispensers, a happy little bounce (cue `jingle` f6, soft);
  - `walk`;
  - `sit` (10 x 220 ms, the park's 11 px seat);
  - `wave` (8 frames, about 1.2 s: a big hello and a hop, cue `jingle` f2).

### The walkers (`npc-ginger-elf-red`, `-green`, `-blue`)
- Each carries a **big candy cane striped white and his outfit's color**: about 25 px, as tall as he is, its hook up past his hat.
- `idle` (10 frames, 1.9 s): leaning on the cane, a look round, a little hop, the cane tapped (cue `tap` f6).
- `walk`: the cane swaying.
- **Their loops** (`SHOP_GINGER_WALKERS`, squares; about 1.6 squares a second; `pause` ms in `idle`; never across the ice):

| walker | loop |
| --- | --- |
| red | (6.0, 8.6) pause 1.4 s → (6.0, 11.3) → (6.9, 12.2) pause 1.8 s → (6.0, 11.3) → back |
| green | (12.8, 8.4) pause 1.6 s → (12.3, 7.2) → (9.0, 7.2) pause 1.2 s (in front of the stand) → (12.3, 7.2) → back |
| blue | (11.6, 12.4) pause 1.5 s → (12.4, 11.4) → (13.0, 9.4) pause 1.3 s → (12.4, 11.4) → back |

### The dispensing pair
- **Elf A** (`npc-ginger-elf-box`, yellow, a burlap sack on his back, a white candy box with a red stripe):
  - `walk`: the box at his hip.
  - `tap` (once, 4 frames, 0.46 s, cue `tap` f1): he reaches up with a little hop and taps the dispenser's handle. The bin's handle
    is about 15 px up, and the tube's lever 13 px over the deck: in reach.
  - `boxOut` (once, 2 frames): he holds the box out under the chute. **The box's middle is 7 px ahead of his foot (`ELF_BOX_DX`), its
    top 11 px up (`ELF_BOX_AT`)**, just under the lower chutes' feet (11 px) and the tubes' spouts (13 px over the deck).
  - `fill` (once, 8 frames, 1.2 s, cue `pour` f0): candy pours in and the box fills.
  - `full` (once, 5 frames, cue `tip` f2): he tips the full box over his shoulder into his sack.
  - `idle`.
- **Elf B** (`npc-ginger-elf-pad`, purple, a white beard, a notepad and a pencil):
  - `walk`: writing as he goes.
  - `write` (loops, 8 frames, 1.2 s, cue `scribble` f2): he looks up, scribbles and ticks.
  - `idle`.

**`SHOP_GINGER_DISPENSE_PATH`** (elf A's waypoints, squares; `h` his lift, px).
- Walk straight lines between waypoints, about 1.4 squares a second.
- **At a stop**, A faces the dispenser and plays tap, boxOut, fill and full (2.5 s, plus a 0.3 s beat).
- **B** stands at `b` (c, r, lift) playing `write`. Between stops he follows A half a square behind.
- **Where A stands:**
  - at a lower stop, on the floor just in front of the bin (r = the bin's row + 0.6);
  - at an upper stop, on the catwalk (lift 40).
- The stops moved with the stairs: bay-a and bay-e are gone, so bay-b and bay-d each give two (both their bins below; bay-b two
  tubes above).

| # | A at (c, r) | lvl, h | stop: bay, chute (x in its 45 px card), face | B at (c, r, lift) |
| --- | --- | --- | --- | --- |
| 0 | (4.85, 6.3) | floor 0 | the west stairs' foot (5, 6): start | |
| L1 | (6.55, 5.6) | floor 0 | bay-b, bin 1 (x 13), east | (6.10, 5.9, 0) |
| L2 | (7.04, 5.6) | floor 0 | bay-b, bin 2 (x 31), east | (6.59, 5.9, 0) |
| | (8, 7.2) → (11, 7.2) | floor 0 | round the stand's front, behind the ice's rim | |
| L3 | (11.04, 4.6) | floor 0 | bay-c, bin 2 (x 31), east | (10.59, 4.9, 0) |
| L4 | (11.55, 5.6) | floor 0 | bay-d, bin 1 (x 13), east | (11.10, 5.9, 0) |
| L5 | (12.04, 5.6) | floor 0 | bay-d, bin 2 (x 31), east | (11.59, 5.9, 0) |
| | (14.3, 6.2) | floor 0 | the east stairs' foot (14, 6) | |
| | (14.3, 5) → (12.62, 5) | stairs 5 → 40 | up the east flight, westward, onto the deck | |
| U1 | (12.18, 5) | up 40 | bay-d, tube 2 (x 22), west | (12.68, 5, 40): the stairs' deck quarter |
| | (11.5, 4.5) | up 40 | round the curve | |
| U2 | (11.18, 4) | up 40 | bay-c, tube 2 (x 22), west | (11.45, 4.42, 40) |
| | (9.5, 4) | up 40 | over the stand | |
| U3 | (8.18, 4) | up 40 | bay-door, tube 2 (x 22), west | (8.68, 4, 40) |
| | (7.5, 4.5) | up 40 | round the curve | |
| U4 | (7.18, 5) | up 40 | bay-b, tube 2 (x 22), west | (7.45, 4.58, 40) |
| U5 | (6.85, 5) | up 40 | bay-b, tube 1 (x 10), west | (7.27, 4.86, 40) |
| | (6.38, 5) → (4.65, 5) → (4.85, 6.3) | stairs 40 → 5, floor | down the west flight, westward, off its foot | back at the start |

The loop runs about 47.5 s.

### Sprites on screen (Eric, Nov 4)
`intro-ginger-view.ts CHECK=1` checks every resting place on Ginger's camera:
- the shopkeeper;
- every walker waypoint, both the pauses and the turns;
- every stop of A and B;
- Ginger on his mark;
- the intro's carriers at the toss and watching.

**All are wholly on screen on the phone and the computer.**

## For the code helper
- **Exports from `house-shop-ginger.ts`:**
  - the usual: `SHOP_GINGER_PIECES`, `SHOP_GINGER_LAYOUT`, `HOUSE_SHOP_GINGER`, `SHOP_GINGER_CRATE_AT`, `SHOP_GINGER_COUNTER_SIGN`
    (null), `SHOP_GINGER_MARKS`, `SHOP_GINGER_LIGHTS`, `SHOP_GINGER_POOLS`;
  - new: `SHOP_GINGER_FLOOR`, `SHOP_GINGER_UPPER`, `SHOP_GINGER_STAIRS`, `SHOP_GINGER_STEP`, `SHOP_GINGER_DECK_H`,
    `SHOP_GINGER_DISPENSERS`, `SHOP_GINGER_CHUTES`, `SHOP_GINGER_DISPENSE_PATH`, `ELF_BOX_DX`, `SHOP_GINGER_KEEPER`,
    `SHOP_GINGER_WALKERS`, `SHOP_GINGER_COUNTER_TOP`, `SHOP_GINGER_MARK`, `SHOP_GINGER_ICE_POOL`, `SHOP_GINGER_PALETTE`,
    `SHOP_GINGER_TOP`, `SHOP_GINGER_CARD` (`{ w: 45, h: 150, foot: [22, 149], over: 4 }`) and `footOf`.
- **A ShopDef for it** (my suggestion): `gingerbread: { home: "gingerbread", boss: "Ginger", crate: "Ginger's Boss Crate", kid:
  "elf", at: [9.5, 5.2], tall: 25, keeper: [{ c: 9, r: 5 }, { c: 10, r: 5 }], roof: "igloo", chatTone: "day" }`.
  - The prize is his ride, if `ginger-sled` is it.
  - Ginger's BossIntro gets **`cam: INTRO_GINGER_CAM`** (above).
- **The wall cards are wider than their squares** (45 px, 4 px over each side): place each by its foot as usual. The overlap is
  what closes the curve.
- **The upper level is new.** The data above is all it needs: the chain, the stairs' quarters, the deck's height and the drawing
  rule.
- **Swap `bay-door` for `bay-door-open`** while the intro's carriers come out.
- **The elves:** bake each as the sidekicks are baked (36 x 44).

## Calls Eric may want to change
1. **The fight is centred:**
   - the battle spot and the table at the room's middle (9.5, 9.5), the marks at (8, 9.5) and (11, 9.5);
   - **Ginger's challenge camera is centred on the table** (west 0) to keep both staircases on the phone.
   - The stairs stay at the catwalk's ends, on the curve.
2. **The candy wall now wraps the room** from row 11 on the west, round the back, to row 11 on the east.
   - Round the sides it stands on a plain ledge with no bulbs (the catwalk is only the back curve, between the stairs).
   - The ice takes over at row 12, with a lantern each side.
3. **The walls overlap** (45 px cards) and slope down smoothly toward you, so the igloo reads as one curve with no holes.
4. **The stairs join** (I shipped the joined version, not Eric's straight back-to-front fallback):
   - each is one straight flight along the back wall on the catwalk's own row, rising into the deck;
   - its top step is the deck itself, and one banister runs unbroken onto the deck's candy-cane edge;
   - it joins in the flat room still (the 3x crops) as from the camera;
   - it costs two bays (a and e), and two stair feet become floor.
5. **The elves are little gnome-ish elves, 25 px**, with big hats, big round noses, big boots and beards on four of them.
   - They reach the bins' handles and the tubes' levers with a little hop.
   - The stand is lowered to 10 px so the shopkeeper shows over it.
6. Unchanged:
   - the catwalk at 40 px, no front rail (now 6 squares plus the stairs' deck quarters);
   - the stockroom door and the CANDY sign;
   - two bins and three tubes a bay;
   - elf A tipping full boxes into his sack, elf B writing;
   - the colors (walkers red, green, blue; pair yellow and purple; carriers orange and teal; shopkeeper green in a red Santa hat).
