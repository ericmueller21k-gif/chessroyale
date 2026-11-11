# The zebras' bakery: its front, its shop and its back room (Nov 10)

Brief: `notes/briefs/brief-zebra-bakery.md` on `claude/director-notes` (Eric's words: `notes/zebra-eric.md`). Art and writing only: no
app code was changed. Drawn by hand in code on the weekly plan usage (no API spend).

- `house-shop-zebra/house-shop-zebra.ts`: the front in the town (`HOUSE_ZEBRA`), the front room (`SHOP_ZEBRA_*`) and the back room
  (`SHOP_ZEBRA_BACK_*`), every piece its own `Character` in `SHOP_ZEBRA_PIECES` (`shop-zebra-<name>`).
- `house-shop-zebra/bakery-kit.ts`: the colors, the sign capitals and a small chess hand ("e4!!", "Nf3?!"), the bread (baguette with its
  scoring slashes, boule, roll, croissant, tin loaf, braid), tiny chess pieces, board sketches, arrows. Copy it beside the art in the game.
- The zebras are the other session's (`out/crew-zebra`, `out/boss-zebra`), placed here; the counter zebra is a stand-in (a call, below).
- The chatter, its checks and the talk beat's lines: [zebra-chatter-nov10.md](zebra-chatter-nov10.md).
- Don Dough's opening comments (a line per family, 3 or 4 moves in) and his Rising Dough and Gold Plate lines:
  [zebra-openings-nov10.md](zebra-openings-nov10.md).
- The mockups: `npx tsx scripts/boss-art/bakery-view.ts stills <dir>` and `... gif <out.gif>` (the town's camera, as `shop-view.ts`;
  the ceilings, the town ground round the bakery and the computer's side panels are the mockup's own).

## The front in the town: `HOUSE_ZEBRA`
- **144 x 146, foot [72, 140]** (the top 12 px are sky for the chimney's smoke; the building itself is 144 x 134, Big Boy's size class).
- A cream plaster bakery, brick quoins, a little pediment with a wheat sheaf, **a zebra-striped awning** with a scalloped valance, two
  gooseneck lamps over **the sign board** (blank: the game writes the name, `HOUSE_ZEBRA_SIGN` is its face), the display window (FRESH
  BREAD in gold, three tiers of bread), a burgundy door with blinds, a small window of rolls, and **the A-board on the pavement: JUST
  BREAD / MOVE ALONG** (the joke, readable outside).
- `idle`: 8 frames (2.6 s): the chimney puffs; at f4-f6 a slat of the door's blind lifts and **two eyes peek out** (left, ahead, right),
  then drop. Cue `peek` f4.
- `HOUSE_ZEBRA_LIGHTS`: the windows' warm light, the two sign lamps (halo 8).

## The front room (the shop): `SHOP_ZEBRA_*`, 20 x 20, the usual size and default camera

### Floor mask `SHOP_ZEBRA_FLOOR` (block every `#` and every solid piece's squares)
```
####################   rows 0-5: nothing (the back room is behind the back wall)
####################
####################
####################
####################
####################
###..###############   row 6: the back wall; (3, 6), (4, 6) the door to the back room
##................##   rows 7-18: the floor, columns 2-17 (16 x 12)
...  (rows 8-17 the same)
##................##
#########..#########   row 19: the front; (9, 19), (10, 19) the way out
```
The two doors' own squares are `.` (as every way out is): walking into one goes through it.

### Pieces
| piece | size (px) | foot | squares | placed (col, row) |
| --- | --- | --- | --- | --- |
| floor-a, floor-b (black and white checker, four checks a square), floor-flour (dusted) | 37 x 37 | 18, 18 | 1 x 1 | every floor square (flour round the mixer and before the counter) |
| floor-stock | 37 x 37 | 18, 18 | 1 x 1 | every `#` square |
| mat-w, mat-e (the doormat: MOVE ALONG) | 37 x 37 | 18, 18 | 1 x 1 | (9, 18), (10, 18) |
| bw-1 ... bw-18 (the back wall, one painting cut into cards: menu, employee of the month, bread shelves under JUST A BAKERY, clock, NO LOITERING, canisters) | 37 x 150 | 18, 149 | 1 x 1 | row 6, columns 1-2, 5-18 (solid) |
| door-back (STAFF ONLY, a speakeasy slot, a taped note NO CHESS IN HERE, warm light under it) | 74 x 150 | 37, 149 | 2 x 1 | (3, 6), not solid, `door: "back"` |
| side, side-b (wheat print), side-c (breadsticks jar), side-d (aprons) | 37 x 130 | 18, 129 | 1 x 1 | columns 1 and 18, rows 7-18 |
| hem, hem-bread, hem-post | 37 x 26 / 26 / 70 | 18, 25 / 25 / 69 | 1 x 1 | row 19 (posts at 1 and 18) |
| entrance (the door propped open on the day, its OPEN sign backwards from inside) | 74 x 112 | 37, 111 | 2 x 1 | (9, 19), `exit` |
| counter (glass case of pastries, marble top, register, bell, bags, breadsticks) | 259 x 66 | 129, 65 | 7 x 1 | (9, 8), solid. Its top is **49 px** up (`SHOP_ZEBRA_COUNTER_TOP`) |
| crate (the Boss Crate) | 36 x 44 | 18, 40 | on the counter | at `SHOP_ZEBRA_CRATE_AT` = [108, 14] in the counter's pixels |
| mixer (the showpiece) | 111 x 176 | 55, 171 | 3 x 2 | (3, 13): solid on columns 3-5, rows 12-13 |
| sacks (FLOUR), rack (speed rack of loaves), basket (baguettes), cafe (table, two chairs) | 37 x 44 / 37 x 112 / 37 x 70 / 74 x 58 | 18, 40 / 18, 108 / 18, 65 / 37, 54 | 1 x 1 (cafe 2 x 1) | sacks (2, 16), (2, 17 mirrored); rack (17, 10); basket (17, 17); cafe (14, 15); all solid |
| lamp (pendant, the bulb 102 px up) | 37 x 150 | 18, 149 | 1 x 1 | (7, 10), (13, 12), (6, 16), (12, 16), not solid |

### The animated pieces
- **The giant mixer** (`mixer`): 12 frames x 110 ms (`SHOP_ZEBRA_MIXER_MS`; a turn of the hook in 1.32 s). A floor mixer twice a zebra's
  height (BIG MIX on its head), the dough hook spiraling, the dough's fold travelling round the bowl, a strand lifted and slapped down,
  flour puffing over the rim. Cue `thump` f0 and f6.
- **The Boss Crate** (`crate`): a zebra-striped pastry box tied with burgundy string, a gold seal; steam curls out from under its lid,
  6 x 170 ms.

### The people (`SHOP_ZEBRA_KEEPER`, `SHOP_ZEBRA_GUARDS`)
- **The counter zebra (the Shopkeeper):** behind the counter at **[12.5, 7.3]**, keeper squares (12, 7), (13, 7), drawn mirrored (facing
  west into the room). The 49 px counter hides him to the chest. **A call for Eric** (below); the stills use the crew rig in a paper cap
  and apron as a stand-in.
- **The two guards** just inside the door, flanking the walkway: `npc-zebra-guard-a` (flat cap) at **[8, 17.2]** facing east,
  `npc-zebra-guard-b` (paper cap) at **[11, 17.2]** facing west (mirrored); their squares (8, 17), (11, 17) solid.
  **How their `watch` turns to you:** each frame, `dx` = your column minus his, negated for the mirrored guard, and **2 squares less once
  you're more than 1.5 rows north of him** (past him: he looks back over his shoulder); show `watch` frame `ZEBRA_WATCH_FRAME(dx)` (the
  crew's function: far behind 0 ... far ahead 4). Not played as an animation. When you're out of the room they play `guard`.

### Lights
`SHOP_ZEBRA_LIGHTS` / `SHOP_ZEBRA_POOLS` (piece-keyed, as Jefferson's): the four pendants (warm, halo 26, a pool under each), the warm
line under the back door (and a thin pool before it), the day in the entrance. The tone is day (the chat's `day`).

### Camera
The usual: you start at the town's zoomed-in camera (`startZoom` 1), + for Close, following you. No special framing. On a phone the
mixer and the counter don't fit in one view from the door; walking north brings each in.

## The back room: `SHOP_ZEBRA_BACK_*`, its own room, 14 x 14 (`SHOP_ZEBRA_BACK_N`)

**A quarter of the home's floor:** 10 x 6 = 60 squares, against the front room's 16 x 12 = 192 (24 %). In the building's plan it sits
behind the front room's back wall, under its west part (columns 2-11), so its door lines up with the front room's (columns 3-4).

### Floor mask `SHOP_ZEBRA_BACK_FLOOR`
```
##############   rows 0-2: nothing
##############
##############
##############   row 3: the back wall (the TV at columns 8-9)
##..........##   rows 4-9: the floor, columns 2-11 (10 x 6)
##..........##
##..........##
##..........##
##..........##
##..........##
###..#########   row 10: the front; (3, 10), (4, 10) the door back to the front room
##############
##############
##############
```

### Pieces
| piece | size (px) | foot | squares | placed (col, row) |
| --- | --- | --- | --- | --- |
| bfloor-a, bfloor-b (dark planks), bfloor-stock | 37 x 37 | 18, 18 | 1 x 1 | every square |
| rug-&lt;col&gt;-&lt;row&gt; (deep red, a gold border, a worn lattice) | 37 x 37 | 18, 18 | 1 x 1 | columns 3-9, rows 4-8 (35 tiles, each drawn where it lies) |
| bb-1 ... bb-12 (the back wall, one painting cut into cards: the cork board with red string and a crossed-out giraffe, the big board sketch with arrows and circled squares, "e4!!", "Nf3?!", "1.d4 Nf6 2.c4 g6", "Rb1 cxd4 cxd4 Qa5+", "WHY h6??", "+0.3 = ??", "O-O-O!", LUCENA with its bridge and "R4!", BOSS v US tallies, a printout) | 37 x 150 | 18, 149 | 1 x 1 | row 3, columns 1-7, 10-12 (solid) |
| tv (the stream) | 74 x 150 | 37, 149 | 2 x 1 | (8, 3), solid |
| bside, bside-books (chess books), bside-sketch (a board, "Bxh7+ Ng5+ Qh5"), bside-tally (e4 v d4 tallies, a score sheet) | 37 x 130 | 18, 129 | 1 x 1 | columns 1 and 12, rows 4-9 |
| bhem, bhem-post | 37 x 26 / 70 | 18, 25 / 69 | 1 x 1 | row 10 (posts at 1 and 12) |
| bdoor (the doorway: the bright front room beyond, the door's back) | 74 x 112 | 37, 111 | 2 x 1 | (3, 10), not solid, `door: "front"` |
| table (scattered pieces, a roll-up board, cups, a notebook, a basket of breadsticks) | 119 x 84 | 59, 80 | 3 x 2 | (5, 7): solid on columns 5-7, rows 6-7. Its top is **27 px** up (`SHOP_ZEBRA_BACK_TABLE_TOP`, the crew rig's `ZEBRA_TABLE_TOP`) |
| armchair (the kingpin's wingback, side on, facing east) | 45 x 66 | 22, 62 | 1 x 1 | (4, 7), solid |
| bench (the crew's, along the table's north side) | 111 x 22 | 55, 18 | 3 x 1 | (5, 5), solid |
| lamp-green (the card-table lamp, its shade about 125 px up) | 57 x 150 | 28, 149 | 1 x 1 | (6, 7), not solid |
| coatrack (fedoras, a trench coat), cabinet (OPENINGS drawers A to E), crates (bread), wastebasket (score sheets) | 37 x 104 / 76 / 48 / 30 | 18, 100 / 72 / 45 / 27 | 1 x 1 | (2, 4), (11, 4), (11, 9), (10, 4); solid |

Seats: **11 px** (`SHOP_ZEBRA_BACK_SEAT_H`: the bench's and the wingback's, the zebra rig's `sit: 11`).

### The TV (`tv`): 16 frames x 400 ms (6.4 s)
A flat screen on the wall: a board (8 x 8 of 4 px) playing the Najdorf's first ten moves (`SHOP_ZEBRA_TV_MOVES`: 1.e4 c5 2.Nf3 d6 3.d4
cxd4 4.Nxd4 Nf6 5.Nc3 a6, the last move's squares lit), an eval bar wobbling, the chat column scrolling a line every two frames (names in
green, violet, cyan; messages as white bars: no words, no logo, no streamer, no site), a red LIVE dot blinking.

### The people (`SHOP_ZEBRA_BACK_SEATS`)
- **The kingpin** in his wingback at the head (west) at **[4.3, 6.82]**, facing east (as drawn): `sitTalk`, `sitScoff`, `sitListen`.
- **The crew** on the bench, turned to him (facing west: mirrored): `npc-zebra-crew-c` (Toque) **[5.15, 5.06]**, `-d` (Fedora)
  **[6.15, 5.06]**, `-e` (Beanie) **[7.15, 5.06]**: `sitArgue`, `sitTalk`, `sitListen`, `sitPuff`, by the chatter.

### The challenge: here, at the table (`SHOP_ZEBRA_BACK_MARKS`)
- **Boss** seated at the head **[4.3, 6.82]**; **you** standing at the foot (east) **[8.45, 6.75]**; **the board** on the table's middle
  **[6, 6.5]**, 27 px up: the roll-up board drawn on the table (`SHOP_ZEBRA_BACK_BOARD_PX` [59, 48] in the table's pixels) is where the
  game's board goes, over it. Boss on the left, you on the right.
- **The talk beat** (Eric: walk up and talk to him): the crew `standUp` (they turn to face you, east: unmirrored), `draw`, `aim` with
  Fedora's line; the kingpin `sitRelax` with "Relax, relax. Put the bread down."; the crew `lower`; his challenge line; then his
  `breadPop` and the battle. The lines: [zebra-chatter-nov10.md](zebra-chatter-nov10.md). The crew stay standing (there's no sit-down
  animation) until the room loads again.
- **Its camera:** its own (`SHOP_ZEBRA_BACK_CAM` = `{ south: -0.8, west: -0.35, zoom: 1 }` from the table's middle, as Ginger's
  `BossIntro.cam`). CHALLENGE_FEEL's usual (south 0.8, west 0.75) is made for a 20-square room: here it left the phone's lower half empty
  and you at its edge. This one fills the phone with the room and keeps the kingpin and you both on screen.

### Lights
`SHOP_ZEBRA_BACK_LIGHTS` / `_POOLS`: the green lamp (warm, strength 1, halo 34, a big pool on the table), the TV's cool glow (halo 18),
the doorway's warm spill. The room is dim (the mockup washes it about 36 % dark before the lights): the chat's `night` tone.

## The door between the rooms (new)
**What the code adds** (a code round, after Eric approves):
1. `RoomArt` gains a second room: `back: { layout, floor, n: 14, lights, pools, marks, cam }` (the `SHOP_ZEBRA_BACK_*` exports).
2. A `door` place (`door: "back"` in the front room, `door: "front"` in the back) works like the way out: standing on its inside squares
   (`SHOP_ZEBRA_DOORS.back.inside` (3, 7), (4, 7); `SHOP_ZEBRA_BACK_DOORS.front.inside` (3, 9), (4, 9)) shows a card (**"Go in"** to the
   back, **"Go out front"** back), and walking into its squares goes through.
3. Going through: the same fade the town uses for a home (to black, load, from black), no zoom. You arrive at `arrive`: the back room's
   **[3.5, 9]** facing north; the front room's **[3.5, 7]** facing south. Each room keeps its own clock and camera; the back room's
   pieces load (behind the black) the first time you go through.
4. The boss is in the back room, not in the town (Eric). Challenging him is talking to him there: walking up to him (within `talkRange`)
   shows his card with Challenge; the talk beat plays, then the battle.
5. "Back to town" after the battle puts you back in the back room at your mark (or in the town, as the others: the director's call).
- **Sounds:** the door's `creak` going through (cue below).

## Cues for the sound round
| cue | where | what |
| --- | --- | --- |
| `thump` | mixer f0, f6 | the dough slapping the bowl, over a steady low motor hum (a loop while the front room shows) |
| (loop) | tv | a soft stream murmur (a voice-less hum and keyboard clicks) and a piece's click on each move (every 600 ms, the frames where the board changes) |
| `creak`, `latch` | the door between rooms | a heavy door's creak, then its latch, as the fade starts; the slot's shutter is still art only |
| (loop) | the back room | the chatter's murmur: low overlapping voices under the bubbles, the crew's `tap` (`sitArgue`) on the table |
| `peek` | HOUSE_ZEBRA f4 | a blind slat's flick |

## Calls for Eric
1. **The bakery's name** (the game writes it on the sign; the kingpin is Don Dough, Eric, Nov 11): **Rolling Dough** (dough is money: the mockup shows this one), **The Family Bakery**,
   or **Totally Normal Bakery**.
2. **The counter zebra:** none of the five drawn crew stands there (two guard the door, three sit at the table). Either a **sixth zebra**
   in a paper cap and apron (the stills' stand-in, from the crew rig), or **guard B** (paper cap, apron) moves behind the counter and only
   one guard stands by the door. I'd draw the sixth.
3. **The puff:** I left it to the crew's art: they have `sitPuff` (a warm breadstick clamped like a cigar, a curl of steam). Nothing
   smokes in the room's art; there's no ashtray.
4. **The crew sit along the far side turned to the kingpin** (facing west, side on): the zebras are drawn in profile, so they can't face
   the camera. In the talk beat they turn to you as they stand.
5. **The checker floor** (black and white, four checks a square): a bakery's classic, and a wink at a chessboard. It could be one check a
   square, or terracotta.
6. **The front room's jokes:** the A-board (JUST BREAD / MOVE ALONG), the big sign JUST A BAKERY, the menu (BREAD 2, MORE BREAD 3,
   THAT'S IT), the employee of the month (a baguette in a bow tie), NO LOITERING, the doormat MOVE ALONG, NO CHESS IN HERE on the back
   door, eyes peeking through the front door's blinds.
7. **The back room's nod to the rivals:** a giraffe sketched on the cork board and crossed out in red.
8. **The back room's camera** is its own (above): the usual one left half the phone empty.
9. **The chatter** (22 exchanges, 12 front-room lines, the talk beat, the battle start): every chess line checked (above). The kingpin
   teases with "kid", "cute", "genius", never "are you stupid".
10. My picks: the zebra-striped awning and Boss Crate box, the burgundy and gold, the BIG MIX mixer, the green card-table lamp, the TV's
    stream (the Najdorf), the OPENINGS cabinet, the fedoras on the coat rack.

## Stills and the GIF (not in the repo)
Made with `bakery-view.ts`, kept out of the repo (the director sends them to Eric): outside, front, front at the counter and back, each
`-phone.png` (390 x 844) and `-computer.png` (1440 x 900, the town's center column with the side panels as plain blocks), and
`bakery-walk.gif` (phone, 15 s: up to the door, across the front room past the guards (watching), through the back door, round the table,
the crew draw, he waves them down, his challenge line).
