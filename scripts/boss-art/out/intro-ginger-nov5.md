# Ginger's battle intro art (Nov 5, revised after Eric's look the same day): the staff's blast, the icicle table, the elves and the board, the blizzard wipe

**Eric's design (Nov 5):** in his igloo candy shop, you both walk on to the marks and he says his line. **He draws power with his
magic candy-cane staff** (a glow gathering), then **shoots a blast above the battle spot**. **An ice shard drops**: after Eric's
look (Nov 5) **a big icicle, tall and pointed, with a round flat top**; it plummets point first and **stabs into the icy ground**,
cracking it, in a puff of snow. Its round top is the table. **Two
elves rush over carrying the chessboard** (with a line: the code's) and **toss it up onto the ice table**. **He casts once more and
the pieces appear from a small white magic light** on the board. The code adds his God King attack swing. Then **the wipe: a
blizzard of snowflakes and candy canes of different colors**. The boss is on the left and you on the right, in about 13.2 s.

- **Brief:** `notes/briefs/brief-ginger-art.md`. **The room and the elves:** `shop-ginger-nov5.md`.
- **Eric's fixes (Nov 5) in this revision:** the battle spot and the table centred at the room's middle (9.5, 9.5), Ginger's own
  camera framing (centred on the table), the icicle with a round flat top, the smaller gnome-ish elves.

## Cost
**Drawn by hand on the weekly plan usage**, not with the API runner. There was no API spend.

## Stills (mockups from the challenge camera)
- **The key frames, phone** (1.0 to 13.3 s): [house-intro-ginger/view-intro-keyframes.png](house-intro-ginger/view-intro-keyframes.png):
  the line; the charge; the blast flying; the burst and the shard forming; the shard falling; the landing (the crack, the puff);
  the carriers out of the stockroom ("Coming, boss!"); the toss; the board in the air; the cast and the white light; the light
  fading; the brag; the wipe half across; covered.
- **Computer** (the line, the fall, the board in the air, the table with the board): [house-intro-ginger/view-intro-computer.png](house-intro-ginger/view-intro-computer.png).
- **His moves and the props at 3x:** [house-intro-ginger/view-moves-and-props.png](house-intro-ginger/view-moves-and-props.png).
- **Every figure is wholly on screen at rest and at the end of every move**, on phone and computer (`CHECK=1`, shop-ginger-nov5.md).
- Made by `scripts/boss-art/intro-ginger-view.ts <dir> <phone|computer> <t,...>` (`SHEET=<png> COLS=n`), the timeline in
  `scripts/boss-art/ginger-place.ts` (`INTRO_T`). The camera is CHALLENGE_FEEL.cam.across (0.75 squares west and 0.8 south of the
  table's middle, zoom 1; for Ginger centred on the table, `INTRO_GINGER_CAM`: west 0) under the room's 52 px header; the phone 390 x 844, the computer 1280 x 720. The board on the slab is a
  stand-in (the renderer draws the real one and the pieces); his line in the mockup is a placeholder.

## For the code helper
### Ginger: `BOSS_GINGER_INTRO` (id `ginger-intro`) in `boss-ginger/boss-ginger.ts`
- **His drawing is the game's** (`characters/gingerbread.ts`): every pose is built with his own rig (`gingerLayers`), so its parts
  are his own (GINGERBREAD.parts). Nothing new is drawn on him; the glows are his own palette swaps.
- **His frame is GINGERBREAD's:** 84 x 93, foot **[43, 88]**, facing front, the cane in his right hand (our left). **Not mirrored.**

| Animation | Frames | Cues | What it does |
|---|---|---|---|
| `charge` | 9 frames, 1.05 s, once | `charge` f1 | He lifts the cane high; its stripes glow ice-blue, his eyes go icy, frost swirls in round the hook in tightening rings, sparkles gather, a shiver. |
| `blast` | 7 frames, 0.75 s, once | `blast` f1 | The cane thrust up overhead, a flash at the hook, **the blast leaving it up and to our right** (on his frame from **`INTRO_GINGER_BLAST_FROM` = [32, 19]**; the props' blast flies on from there at f1), a recoil, the glow fading. |
| `cast` | 8 frames, 0.91 s, once | `cast` f3 | The cane swung down and pointed at the board on his right, glowing, a white mote leaving its tip (**at f3 the white light starts on the board**). |
| `brag` | 9 frames, 1.16 s, once | `laugh` f1, `thump` f5 | A cackle with a fist up, then the cane thumped on the floor in a puff of frost. It ends on his idle's first frame. |
| `idle` | 1 | none | His idle's first frame. |

### The props: `house-intro-ginger/house-intro-ginger.ts`
- **`INTRO_GINGER_BLAST`** (70 x 70, foot [35, 35], its middle):
  - `fly` (loops, 4 x 60 ms, `whoosh` f0, soft): a spinning comet of frost with a sparkle tail. **Fly it from his hook
    (INTRO_GINGER_BLAST_FROM on his frame, scaled as he's drawn) to `INTRO_GINGER_BLAST_TO` = over (9.5, 9.5), 120 px up, in 0.45 s,
    on a little arc** (the mockup adds sin(u·π) x 30 px of lift).
  - `burst` (once, 6 x 70 ms, `burst` f0): a ring of frost flung out there, flakes.
- **`INTRO_GINGER_SHARD`** (111 x 112, foot [55, 106]: where its point touches the floor; lift 0 there):
  - **The look (Eric, Nov 5): one big icicle, tall and pointed, with a round flat top.**
    - **The top:** a disc 69 px across, its top face seen 9 px deep, a 5 px frosted rim.
    - **The body:** clear ice 40 px across under it, tapering in a long concave point 84 px down, with ridges running down it,
      lit on the left.
  - `form` (once, 4 x 80 ms, `freeze` f0): it packs together in the burst, its point growing. **Hold it at 70 px up** (the blast's
    120 less 50: its middle in the burst) until the fall.
  - `fall` (loops, 2 x 60 ms): speed streaks over its top. **Drop it from 70 px to 0 in 0.32 s, accelerating** (lift = 70 (1 - u²)),
    at the table's spot **`INTRO_GINGER_TABLE_AT` = (9.5, 9.5)**.
  - `land` (once, 5 frames, 0.42 s, **`crunch` f0**):
    - **it stabs into the floor**, its point cut at the floor line: 62 px go in (`INTRO_GINGER_SHARD_SINK`);
    - its top drops to 56, 34, 25, 28 and settles at 27, with ice chips flung out.
    - Then swap in the table.
- **`INTRO_GINGER_CRACK`** (111 x 74, flat): **lay it on the floor like a tile, centred on (9.5, 9.5), 3 squares across by 2 deep**.
  `crack` (once, 4 x 70 ms from the landing's f0: cracks running out from a crushed white middle), then `idle` (cracked: it stays
  through the match).
- **`INTRO_GINGER_PUFF`** (111 x 56, foot [55, 52], upright, just in front of the table): `puff` (once, 6 x 80 ms from the landing's
  f0): snow billowing out both ways from the table's foot, thinning away.
- **`INTRO_GINGER_TABLE`** (the same frame and foot as the shard): the icicle stabbed into the cracked ice, a stub of its body
  tapering into the floor under its **round flat top**.
  - **Its top is `INTRO_GINGER_TABLE_TOP` = 27 px over the floor: the park table's.** Draw the board on the round top's face (69 x
    9 px as seen): it fits within it. So **no step is needed for you**: you
    stand at it as at a park table, and he stands too (no stools).
  - `idle` (6 x 220 ms, `glint` f2, very soft): a frost glint running along its face.
  - **`INTRO_GINGER_TABLE_PALETTE`:** the slab frosted ice ("1" #f4fcff to "5" #5f9fd2), the squares `L` #eaf6ff and `D` #7fb2dc.
  - **`INTRO_GINGER_TABLE_INK`:** the board's squares ice-white and a mid ice-blue, with their shades and lines. Keep the town's
    `TABLE_INK` for the pieces: the charcoal and cream pieces read on both.
- **`INTRO_GINGER_BOARD`** (40 x 14, foot [20, 11], its underside's middle): the board the elves carry, wood under ice-blue and white
  squares. `carry` (1 frame); `spin` (loops, 4 x 70 ms, `whoosh` f0, soft: it tips as it flies). **`clack` as it lands on the table**
  (the code's moment: the end of its flight); then the renderer's board takes over.
- **`INTRO_GINGER_LIGHT`** (48 x 48, foot [24, 24], its middle: on the board's middle at (9.5, 9.5), 31 px up): `appear` (once, 4 x 70 ms,
  `sparkle` f0: a mote swelling to a soft white glow), `shine` (loops, 4 x 90 ms: rays turning, sparkles circling over the board),
  `fade` (once, 5 x 90 ms: thinning to sparkles drifting up and out). **Show the real pieces as it fades** (fade them in over its
  450 ms).
- **`INTRO_GINGER_STORM`** (128 x 128, tiles both ways) and **`INTRO_GINGER_FRONT`** (48 x 128, tiles top to bottom): 6 x 70 ms,
  looping; the storm's cues `blizzard` f0 and `gust` f3, the front's `whoosh` f0. Play them exactly like Alfil's sandstorm and
  Jefferson's fireworks: the tile at 3x behind its front, sweeping in from the left.
  - **The storm:** a pale icy haze in soft diagonal gust bands, driving snow streaks, big six-armed flakes turning, and **five candy
    canes tumbling across (red, green, blue, purple, pink)**, a turn each over the loop.
  - **The front:** a wall of dense white snow, flakes blown out ahead. Its left side matches the storm with no seam.
  - **No flashing:** the haze never changes brightness; it's no faster than the other wipes.

### The two board elves (`npc-ginger-elf-board-a`, orange, the front; `-board-b`, teal, the back)
They are the little gnome-ish elves now (25 px, 36 x 44, foot [17, 41]: shop-ginger-nov5.md).
- They're not in the room until the intro: **they come out of the stockroom door**, the room's `bay-door` at (8, 4). Show
  `bay-door-open` from 6.0 to 7.3 s.
- **`INTRO_GINGER_BOARD_ROUTE`** (the board's middle): **(8, 4.75) → (8, 7.0) → (9.5, 7.0) → (9.5, 8.2)**.
  - Elf A is 0.4 squares east of the board's middle, elf B 0.4 west, both facing east (`INTRO_GINGER_ELF_SPOTS.carry`).
  - They run at 3.5 squares a second, playing `carry` (6 x 80 ms, `step` f0 and f3).
  - That's down column 8 past the stand, then along row 7 behind the ice, to just behind the table.
- **The board while carried:**
  - It sits at the route's point, **lifted `ELF_BOARD_HANDS.carry[frame]` (10-11 px)**: their hands, at their shoulders.
  - Elf A holds it 5 px behind his foot, elf B 6 px ahead of his (`ELF_BOARD_HANDS.dx`).
  - Draw it just in front of them.
- **The toss** (both play `toss`, once, 5 frames, 0.59 s, `heave` f2):
  - a dip, a heave with a hop, its arms up;
  - the board rides their hands at `ELF_BOARD_HANDS.toss` (8, 7, 15 px) and **is let go at f3**.
  - Fly it (`spin`) from (9.5, 8.2) at 15 px up onto the table's round top, at (9.5, 9.5) 27 px up, in 0.45 s on an arc (the mockup
    adds sin(u·π) x 34 px).
  - The little elves can't reach the table, so the arc does the work. `clack` as it lands.
- **After the toss:** `cheer` for half a second, then they walk (0.5 s) to **`INTRO_GINGER_ELF_SPOTS.watch`**: A to (11.3, 7.9)
  facing west, B to (7.0, 7.9) facing east. They watch in `idle` until the wipe.
- **Their line** ("Coming, boss!" in the mockup: the code's): a bubble over them while they run, about 6.3 to 7.7 s.

### Ginger's camera
**`INTRO_GINGER_CAM = { south: 0.8, west: 0, zoom: 1 }`**: the challenge camera centred on the table.
- It's a new per-boss field: a BossIntro `cam` override.
- It keeps the centred fight and both staircases at the catwalk's ends in the phone's view.
- Every resting figure is checked wholly on screen with it.

### Sounds (cues and where they fit)
Ginger's sounds are in `characters/gingerbread-sounds.ts`. The new ones must pass
`boss-sounds-finite.test.ts`, and the no-chimes test if it applies to him.

| Cue | Where | Sound |
|---|---|---|
| `charge` | `charge` f1 | **new**: an icy hum swelling, a shimmer of frost on top |
| `blast` | `blast` f1 | **new**: a sharp frosty zap-whoosh going up |
| `whoosh` | the blast's `fly` f0, the board's `spin` f0, the wipe's front f0 | his own whoosh, soft |
| `burst` | the blast's `burst` f0 | **new**: a crisp frosty pop, glassy |
| `freeze` | the shard's `form` f0 | his own freeze sound (or a short crackle of ice forming) |
| `crunch` | the shard's `land` f0 | **new, the big one**: **the ice plummeting into the ground: a heavy crunch-crack**, a deep thud with ice splintering and the floor's ice cracking out after it |
| `step` | the carriers' `carry` f0/f3, every elf's `walk` f0/f3 | **new**: little elf footsteps on packed snow, soft, a tiny shoe-bell jingle now and then, a little random in pitch |
| `heave` | the carriers' `toss` f2 | **new**: a small two-elf "hup!" |
| `clack` | the board landing on the table (the end of its flight) | **new**: a wooden board's clack on ice |
| `cast` | `cast` f3 | **new**: **his cast**, a bright icy chime-less sweep (a rising shimmer, no bell) |
| `sparkle` | the light's `appear` f0 | **new**: a soft sparkling twinkle as the pieces appear |
| `laugh`, `thump` | `brag` f1, f5 | his own cackle; the cane's thump on the floor (his idle's) |
| `blizzard`, `gust` | the storm f0, f3 | **new**: a howling blizzard wind, and a gust over it |
| `glint` | the table's `idle` f2 | very soft, or silent |

**The room's own cues** (on the loops, quiet, only while near): `step` and `jingle` (the elves, the shopkeeper's shoe bells), `tap`
(the walkers' canes on the floor, elf A's tap on a dispenser), `pour` (candy pouring into the box: a soft rattle), `tip` (the box
tipped into the sack), `scribble` (elf B's pencil).

### Suggested timeline (about 13.2 s; the mockup plays it)
| Time (s) | What happens |
|---|---|
| 0 | You both on your marks (his at (8, 9.5), yours at (11, 9.5)); his line (the shared intro, to about 2.5) |
| 2.8 | `charge` (1.05): the glow gathers round the hook (`charge`) |
| 3.9 | `blast` (0.75); at its f1 (3.99) the blast flies (`blast`) over the battle spot, 0.45 s |
| 4.44 | The blast bursts 120 px over the table's spot (`burst`, 0.42) |
| 4.56 | The icicle forms in it (`form`, 0.32, `freeze`), and hangs a beat at 70 px |
| 5.0 | It falls point first (0.32, accelerating) |
| 5.32 | **It stabs in** (`land`, 0.42, **`crunch`**): the crack spreads (0.28), the puff of snow (0.48). From 5.74 it is the table |
| 6.0 | The stockroom door opens (to 7.3) |
| 6.1 | The two carriers come out with the board and run round behind you both (1.8 s); their line from 6.3 to 7.7 |
| 7.9 | They're behind the table |
| 8.0 | `toss` (0.59, `heave`); the board is let go at 8.33 and lands on the table at 8.78 (`clack`) |
| 8.59 | They cheer, then (9.1) walk to their watch spots (0.5) and watch |
| 9.0 | `cast` (0.91); at its f3 (9.32) the white light appears on the board (`sparkle`: appear 0.28, shine 0.5, fade 0.45) |
| 10.1 | The pieces appear as the light fades (to 10.55) |
| 10.6 | (The code's God King attack swing, as for the others, to about 11.9) |
| 11.9 | `brag` (1.16), then his idle |
| 12.6 | The wipe sweeps in (0.6, `blizzard`), holds while the battle loads and slides out |

## Calls Eric may want to change
1. **The table is the icicle's round flat top, 27 px over the floor** (the park table's): the icicle stabs 62 px into the floor as
   it lands, so no step is needed for you and no stools for either of you.
2. **The fight is centred** (9.5, 9.5), and **Ginger's camera is centred on the table** (west 0) so both staircases stay on the
   phone.
3. **The blast is a spinning comet of frost** that bursts over the battle spot, and the icicle forms in the burst. The whole fall
   is in view on phone and computer.
4. **The crack is a flat decal** on the ice (it stays through the match), and the puff an upright billow at the table's foot.
5. **The board elves come out of a stockroom door** beside the shopkeeper, under the catwalk. They're orange and teal: not the
   walkers, who keep their canes and loops through the intro, and the dispensing pair keep working too.
6. **They carry the board between them at shoulder height** (little gnome-ish elves now, 25 px). They toss it with a hop and the
   board arcs up onto the table.
7. **His last cast points the cane at the board**, and the light is a soft white glow with turning rays.
8. **The wipe's canes are red, green, blue, purple and pink**, tumbling, in a pale blizzard.
9. **Timing:** about 13.2 s, inside Eric's 12-14.
