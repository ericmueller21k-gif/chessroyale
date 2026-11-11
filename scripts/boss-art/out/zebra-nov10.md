# The zebra bakery's characters (Nov 10-11): Don Dough, his five crew, the bread rifle, the puff, the bread splash, Rising Dough, Gold Plate

**Eric's design (Nov 10, `notes/zebra-eric.md`):** a mob that runs "just a bakery", really chess-obsessed nerds; the zebras are
the giraffes' rivals. They stand upright like the giraffes and hold big French rolls two-handed like rifles. The kingpin has a
big pudgy belly. His battle start: he pulls the roll, "fires" at you (a little *pop*), and laughs. His God King save is the
same, as rapid fire. Working id **`zebra`**. **Eric named him Don Dough (Nov 11)** and gave him his passive, **Rising Dough**
("Eric, Nov 11" in `notes/zebra-eric.md`), and his ultimate, **Gold Plate**; their art is in the last two sections.

**Drawn by hand** on the weekly plan usage (no API spend). Art only: nothing is wired into the game.

## Files
| Folder | Exports | What |
|---|---|---|
| `crew-zebra/zebra-rig.ts` | `build`, `frame`, `ZEBRA_PALETTE`, `PARTS`, `ARMS`, `paintRoll`, `ZEBRA_TABLE_TOP` | The one zebra, dressed six ways (as `npc-grex/giraffe-rig.ts` is for the giraffes) |
| `boss-zebra/boss-zebra.ts` | `BOSS_ZEBRA` (id `boss-zebra`, name "Don Dough"), `BOSS_ZEBRA_MUZZLE`, `BOSS_ZEBRA_PORTRAIT`, `KINGPIN` | Don Dough: 23 animations |
| `crew-zebra/crew-zebra.ts` | `NPC_ZEBRA_GUARD_A`, `_GUARD_B`, `NPC_ZEBRA_CREW_C`, `_D`, `_E`, `ZEBRA_WATCH_FRAME`, `LOOKS` | The five crew |
| `zebra-props/zebra-props.ts` | `ZEBRA_ROLL`, `INTRO_ZEBRA_PUFF`, `INTRO_ZEBRA_STORM`, `INTRO_ZEBRA_FRONT` | The roll on its own, the muzzle puff, the splash |
| `zebra-props/zebra-dough.ts` | `ZEBRA_DOUGH`, `ZEBRA_TIMER`, `KINDS` | Rising Dough: the dough on the board, the oven timer |
| `zebra-gold/zebra-gold.ts`, `zebra-gold/pieces/*.svg` | `GOLD_FX`, `GOLD_CLINK_PAWN`; `gold-<q\|r\|b\|n><l\|d>.svg` | Gold Plate: the gold pieces, the gilding, glint and clink |

**Pictures** (all on the game's dark ground):
- `zebra-sheet.png`: the dealer giraffe (left, for scale), then the kingpin and the five crew, feet on one line, at 3x.
- `boss-zebra/frames-1.png` and `frames-2.png` (every frame at 2x); `boss-zebra/gifs/<anim>.gif` (3x, all 23).
- `crew-zebra/frames-guards.png` and `frames-table.png` (2x); `crew-zebra/gifs/<anim>.gif` (3x, each with every crew member
  that has it, side by side); `back-room-chatter.gif` (the kingpin's `sitScoff` beside C talking, D listening, E arguing).
- `zebra-props/props.png` (the roll lying and leaning, the puff's frames, 4x), `splash.png` (two tiles and the front, 3x),
  `gifs/splash.gif`, `gifs/puff.gif` (6x).
- `zebra-props/dough.png` and `timer.png` (4x); `zebra-props/gifs/dough-proof.gif`, `dough-rise.gif`, `dough-squash.gif`,
  `dough-land.gif`, `timer-roll.gif`, `timer-ding.gif` (6x).
- `zebra-gold/pieces.png` (each piece beside its gold one, both colors, on the board's squares), `zebra-gold/effects.png` (the
  gilding, glint and clink over real pieces), `zebra-gold/gifs/gild.gif`, `shine.gif`, `glint.gif`, `clink.gif` (6x);
  `boss-zebra/gifs/goldPlate.gif`, `goldBrag.gif`.
- **The whole Gold Plate moment:** `zebra-gold/gifs/gold-plate-moment.gif` (10 s, 3x) and `zebra-gold/moment-keyframes.png`.
  - It is a mockup: Don Dough on the left, three board squares with his queen (black's), and a placeholder speech bubble.
  - It was made by a one-off script, not kept.
- Make them again: `scripts/boss-art/zebra-stills.ts` (`sheet`, `gif`; its header has the usage).

## Size, frame and feet
- **Everyone's frame: 96 x 104, foot [36, 100]**, three-quarters facing our right, light from the top left, room scale 1:1
  (37 px a square). Mirror to face left. The frame is wider than the giraffes' 64 so the roll held out in front fits.
- **A zebra stands about 69 px** from hooves to ear tips, a head under the giraffes (79): Eric's rivals look up at them.
  The toque adds about 8 px. The kingpin is the same height and about twice as wide at the middle.
- **Every frame stays inside its box**: no pixel on any frame's edge, all six figures and the props (checked by script).
- **Seated** poses sit on a seat 11 px up (the dealer's stool height). The bakery's chairs go under them.
  - The table pokes land about 24 px over the foot, at about (54, 76). A table top drawn there matches.
  - `ZEBRA_TABLE_TOP` is 27, a park table's height.

## Don Dough, the kingpin (`BOSS_ZEBRA`)
**The look:**
- A charcoal fedora with a red band, flour-dusted, his ears up behind it.
- A burgundy pinstripe vest straining over the belly: gold buttons, little gaps pulled open, his stripes peeking out under its hem.
- A white waist apron tied under the belly.
- A gold pinky ring and one gold tooth.
- The roll slung across his back, its end over his far shoulder. His roll is 36 px; the crew's are 32.

**The portrait:** `BOSS_ZEBRA_PORTRAIT` = {x 22, y 22, w 40, h 36} of `idle` frame 0 (his head and hat, as Jefferson's 40 x 36).

| Animation | Frames, length | Cues | What it does |
|---|---|---|---|
| `idle` | 12, 2.4 s, loops | none | Hooves on the belly, heavy-lidded smirk, the belly breathing, a pat on it, a blink |
| `entrance` | 9, 1.4 s | `thud` f2, `tip` f6 | Drops in arms up, lands with a belly bounce, tips his fedora |
| `thinking` | 8, 1.9 s, loops | none | Hoof on chin, eyes up, then one brow up and a sideways look |
| `move` | 5, 0.8 s | `point` f1 | Points a hoof at the board, a smug jab |
| `capture` | 11, 1.4 s | `draw` f1, `pop` f4 | Pulls the roll over his shoulder, aims, pops a puff, a laugh, slings it back |
| `hurt` | 6, 0.9 s | `hurt` f0 | A white flash, the hat jolted up, the belly wobbling, a glare, he fixes the hat |
| `check` | 10, 1.6 s | `draw` f1, `cock` f3 | Pulls the roll and holds it on you, brows down, a wink and a gold-tooth grin |
| `smug` | 8, 1.5 s, loops | none | Chin up, one brow up, a chuckle bouncing the belly |
| `rattled` | 8, 1.0 s, loops | none | Shaking, sweat drops, eyes darting, a grimace |
| `cheer` | 5, 0.7 s | `chuckle` f1 | Two nods and belly pats |
| `bigCheer` | 10, 1.2 s | `draw` f1, `laugh` f3 | The roll pulled and thrust overhead, two hops, laughing |
| `victory` | 8, 1.1 s, loops | `laugh` f0 | The roll pumped overhead, hopping, laughing, flour and crumbs falling like confetti |
| `defeat` | 8, 1.2 s, the last holds | `hurt` f0, `snap` f1, `thud` f2 | The hat flies off, the roll snaps in two, he sits down hard, dizzy stars; the hat lies on the floor beside him |
| **`breadPop`** | 17, 2.4 s | `draw` f2, **`pop` f6**, **`laugh` f9** | His battle start. He reaches over his shoulder and pulls out the roll, shoulders it, sights down it, "fires" (a puff of flour and crumbs out of its end, a little kick), then laughs four bounces with the roll over his belly, and slings it back. It ends on `idle` frame 0. |
| **`volley`** | 8 x 70-80 ms, 0.6 s, loops | **`volley` f0** | His God King save: aimed, rapid fire. The roll kicks up and back, four puffs a loop drifting off, a mad grin, the belly shaking. To start from his rest, play `breadPop` f1-f4 (the pull) first, or cut straight in. |
| **`relax`** | 6, 1.0 s | **`relax` f1** | Standing: a calm-down pat of the air to his crew, "easy, easy", eyes half shut, a smile |
| `sitRelax` | 6, 1.0 s | `relax` f1 | The same, seated |
| **`goldPlate`** | 15, 4.2 s | `stir` f2, **`gild` f8**, `kiss` f12 | Gold Plate, his cast. A white bowl of gold glaze against his belly. He stirs it with a pastry brush, humming, eyes shut (the build-up he enjoys). He lifts the brush dripping gold and admires it, then brushes three broad strokes out at the board, glitter flying (start GOLD_FX `gild` at f8). Then a proud chef's kiss, flung open with a sparkle. It ends on `idle` frame 0 |
| **`goldBrag`** | 8 x 200 ms, loops | none | After the gilding, while the piece shines and he says his line: chin up, talking, a hoof pointing down at the board (your pawns), then patting his belly with a smug chuckle |
| **`drop`** | 9, 1.2 s | **`drop` f5** | Rising Dough: a hoof into his apron pocket, up with a lump of raw dough, a little toss in his hoof, a wind-back and a lob out to our right (it leaves the frame at about (90, 34) on f7), a smug look after it. The board then plays `ZEBRA_DOUGH` `land` on its square |
| `sitTalk` | 10, 1.5 s, loops | `tap` f4, f6 | Seated, gesturing, then two pokes at the table ("rook b1 takes, check") |
| `sitListen` | 10, 2.3 s, loops | none | Seated, hooves on the belly, a nod, then one brow up |
| `sitScoff` | 8, 1.4 s, loops | `tsk` f1 | He's always right: chin up, eyes shut, a hoof raised and wagged, "no, no, no", then an open hoof |

**`BOSS_ZEBRA_MUZZLE`**: where a puff leaves the roll, per animation and frame (frame px; null on the other frames).
- `breadPop` f6: (70, 54).
- `capture` f4: (70, 54).
- `volley` f0, f2, f4, f6: (70, 54).
- The puffs are drawn into his frames already, and each stays where it was fired as the roll moves on. For a bigger burst,
  play `INTRO_ZEBRA_PUFF` with its foot on that point (it is facing right; mirror it with him).

## The crew
- **One zebra, five ways**, each known by his hat, as the giraffe crew are.
- **The door guards** (front room) stand with the roll across the chest:
  - `npc-zebra-guard-a`: a tweed flat cap, dark shades, a black vest, a toothpick.
  - `npc-zebra-guard-b`: a baker's paper cap, a black vest under a white apron, a sticking plaster on his muzzle.
- **The table crew** (back room) sit; their rolls lie on the table (`ZEBRA_ROLL` `table`):
  - `npc-zebra-crew-c`, the theory nerd: a tall chef's toque, round glasses, a white apron, a pencil behind his ear.
  - `npc-zebra-crew-d`: a grey fedora, a navy turtleneck, a scar over his eye.
  - `npc-zebra-crew-e`: a red beanie, a mustard knit sweater vest, a red bow tie.

| Animation | Who | Frames, length | Cues | What it does |
|---|---|---|---|---|
| `guard` (= `idle`) | guards | 10, 2.0 s, loops | `flick` f6 (A only) | The roll held across the chest, brows down, a breath, a blink, a glance back; A flicks his toothpick |
| `watch` | guards | 5 frames, **not played** | none | His eyes and head turned from far behind (f0) to far ahead (f4) |
| `sitTalk` | table | 12, 1.9 s, loops | none | Gesturing (each starts at his own point in the loop), mouth going, brows up on a point |
| `sitListen` (= `idle`) | table | 10, 2.2 s, loops | none | Arms folded, a nod and a smile, a blink, a look back |
| `sitArgue` | table | 10, 1.5 s, loops | `tap` f1, f3 | Brows down, two jabs at the table, a head shake, a shrug |
| `sitPuff` | table | 10, 2.0 s, loops | `puff` f4 | Seated, a warm breadstick clamped like a cigar, a draw on it, a curl of steam |
| `standUp` | table | 4, 0.5 s | none | Startled, a hoof to the table for the roll, up on his feet with it at his side. It ends on `draw` f0 |
| `draw` | all five | 5, 0.6 s | `draw` f1 | The roll pulled up from his side (the guards from across the chest), swung round and pointed at you, a grit. It ends on `aim` f0 |
| `aim` | all five | 8, 1.5 s, loops | none | Holding the point, a squint, a twitch, a blink |
| `lower` | all five | 4, 0.7 s | none | Relaxes, the roll swung down to point at the floor, a little smile; the last frame holds |
| `puff` | all five | 10, 2.0 s, loops | `puff` f4 | Standing, the roll down behind his leg in his far hoof, the breadstick in his teeth, steam curling up |

- **How the code picks `watch`'s frame:** `ZEBRA_WATCH_FRAME(dx)`.
  - `dx` is your x minus the guard's, in squares, in the way he faces (negate it for a mirrored guard).
  - It returns `2 + round(dx / 1.5)`, clamped 0..4: frame 2 level with him, 0 far behind him, 4 far ahead.
  - Show that frame and change it as you walk. The loop never plays.
- **The talk beat** (Eric: they stand guard, draw, point at you; he says relax; they put them down):
  - The table crew play `standUp` then `draw`. The guards play `draw`.
  - Then all hold `aim` while he plays `sitRelax` (or `relax` if he's stood).
  - Then all play `lower`.

## Props
- **`ZEBRA_ROLL`** (40 x 40, foot [20, 38]): the crew's roll on its own.
  - `table`: lying on the table with a little shadow.
  - `lean`: stood on end, leaning.
- **`INTRO_ZEBRA_PUFF`** (32 x 24, foot **[3, 13]** = the muzzle point): `puff`, once, 6 x 70 ms, cue `pop` f0.
  - A white-hot pop of flour, a cloud rolling forward and thinning, crumbs flung ahead and falling.
- **`INTRO_ZEBRA_STORM`** (128 x 128, tiles both ways) and **`INTRO_ZEBRA_FRONT`** (48 x 128, tiles top to bottom): his
  splash, "loaves of bread". Each is 6 x 70 ms and loops.
  - Cues: `tumble` on the storm's f0, `whoosh` on the front's f0.
  - Play them exactly like Alfil's sandstorm, Jefferson's fireworks and Ginger's blizzard: the tile at 3x behind its front,
    sweeping in from the left.
  - **The storm:** a warm flour haze in soft diagonal bands, a slow flour twinkle, and seven loaves tumbling: three
    scored French rolls, two baguettes, two round boules with a cross cut.
  - **The front:** a rolling wall of flour, with flour puffs and crumbs flung out ahead. Its left side matches the storm with
    no seam.
  - **No flashing:** the haze never changes brightness. The rolls turn 30° a frame, the boules 15°. It is no faster than
    the other wipes.

## Rising Dough (`zebra-props/zebra-dough.ts`)
Eric: he drops lumps of dough that show what they'll become; squash them before they rise. The timer counts "minutes" that
are moves, one off for every move (yours and his), with "a cool millisecond drop down where it looks like all of a sudden a
minute passed".

**`ZEBRA_DOUGH`: 32 x 32, foot [16, 31].** It is a board square's effect frame (`effects/common.ts` `SQUARE`), its base on the
square's bottom middle, drawn at the board's square size. For each kind `k` (p, n, b, r, q):

| Animation | Frames, length | Cues | What it does |
|---|---|---|---|
| `land` (any kind) | 4, 0.3 s | `plop` f2 | A plain lump drops in from above, stretches, plops flat with a little flour, settles. Then show `k` |
| `k` | 4 x 320 ms, loops | none | Raw dough shaped roughly like the piece, proofing (a slow breath), flour on its lit side |
| `kRise` | 8, 0.9 s | `rise` f0, `pop` f4 | It swells and browns to a golden crust, then pops in a ring of flour that thins out. Draw his real piece on the square from f4; the flour clears over it |
| `kSquash` | 6, 0.6 s | `squash` f0 | Pressed flat as your piece lands on it: a pancake with splats, a puff of flour round your piece (drawn on top by the board), the pancake fading |

- The shapes, at square size:
  - pawn: a ball on a collar;
  - knight: a horse's head looking left, an eye and a mane line;
  - bishop: a tall dome with a slit and a tip;
  - rook: a block with three crenels;
  - queen: a slim body under a fan of five crown points.
- The baked frames stay inside the square.

**`ZEBRA_TIMER`: 38 x 22, foot [19, 20].** One per dough, shown on his side:
- **Sizes:** 2x on a phone (76 x 44 CSS px), 3x on a computer (114 x 66). Stack them down his side, the newest at the bottom.
- **The look:** a white kitchen timer with a red button. The dough's kind is printed on its left. A green-grey LCD shows MM:00
  in seven-segment digits (the unlit segments show faintly). From 01:59 down the digits are red.

| Animation | Frames, length | Cues | What it does |
|---|---|---|---|
| `kNN` (NN 00-15) | 1, still | none | Shows NN:00 (e.g. `n07`, `q15`) |
| `kRollNN` (NN 01-15) | 7, 0.25 s | `roll` f0 | The drop from NN:00: the minute goes and the seconds race 59, 47, 36, 24, 13, 05, 00 in a blink. It ends showing (NN-1):00, the same as `k(NN-1)` |
| `kDing` | 6, 0.8 s | `ding` f0 | At 00:00: the LCD flashes dark and light, bell lines ring off its top, a jiggle. Then play the dough's `kRise` |

Eric's times (pawn 4, knight and bishop 7, rook 10, queen 15) fit: the timer goes to 15.

## Gold Plate
Eric: "He makes his queen gold plated and it becomes shiny gold, and can no longer be captured by pawns for the rest of the
game."

**The gold pieces** (`zebra-gold/pieces/gold-<k><l|d>.svg`):
- They are the board's own cburnett drawings (BSD; `board/pieces/SOURCES.md`), recolored gold, the same size and shape.
  Draw one as the board draws `piece.<color>.<kind>`, in his piece's place once it's gilded.
- There are four kinds (queen, rook, bishop, knight) in both colors, so he can be either side and still gild something if he
  has no queen.
- White's set (`l`): bright gold with a metallic shine, a dark brown outline.
- Black's set (`d`): antique gold, the black outline kept, its light details pale gold. The two sides stay distinct.
- The license's credit stays as it is (the files are derived from the set already credited). A line in `SOURCES.md` will say
  they are recolors.

**`GOLD_FX`: 32 x 32, foot [16, 31].** A board square's effect, drawn over the piece's square:

| Animation | Frames, length | Cues | What it does |
|---|---|---|---|
| `gild` | 8, 0.8 s | `gild` f0 | A see-through band of gold sweeps up the piece from its foot, glitter falling behind it, then a big four-point sparkle at its top and two small ones. **Swap in the gold piece at f3**, under the band |
| `shine` | 8, 1.5 s | `shine` f0 | The beat where it shines: a glare sweeps across it corner to corner, then a big sparkle blooms at its top with little ones round it, and fades |
| `glint` | 5, 2.6 s, loops | `glint` f2 | The gold piece's idle. Nothing for 1.8 s, then a sparkle runs up it: shoulder, middle, top. Only three frames carry pixels, so it's cheap. Its cue should be very soft, or none |
| `clink` | 6, 0.5 s | `clink` f1 | A pawn bouncing off it: sparks at the corner it hits, little "ting" lines, a spark falling |

- **The clink** is drawn for a pawn coming from the square's bottom left. Mirror it left to right, and top to bottom for a
  pawn coming down.
- **`GOLD_CLINK_PAWN`** = [0.3, 0.42, 0.28, 0.12, 0.04, 0].

**The moment, 10 s end to end** (Eric, Nov 11: "take a few seconds, like 10 total, where an animation plays, turns his piece
gold, then he says a note about how your pawns are worthless vs it"):

| Time (ms) | Him | His piece's square | Words |
|---|---|---|---|
| 0 | `goldPlate` starts: the bowl comes out (cue `stir` at 580 ms) | his piece as it is | |
| 580-1780 | stirring the glaze, humming, eyes shut | | |
| 1780-2480 | lifts the brush, dripping gold, admires it | | |
| 2480 | the first of three strokes at the board (cue `gild`) | `GOLD_FX` `gild` starts | |
| 2720 | | **swap in the gold piece** (`gild` f3, under the band) | |
| 2840 | follow-through | | |
| 3240 | | `gild` ends | |
| 3300 | | `shine` (1.5 s, cue `shine`): the glare, the big sparkle | |
| 3100-3900 | the chef's kiss (cue `kiss` at 3100), flung open with a sparkle | | |
| 4200 | `goldPlate` ends on his idle's first frame (held 100 ms) | | |
| 4300 | `goldBrag` (loops): chin up, pointing at your pawns, belly pats | | |
| 4780 | | `glint` loops from here on, for the rest of the game | |
| 5200-7700 | `goldBrag` | | **his line**, a speech bubble for 2.5 s (the code round's line: your pawns are worthless against it) |
| 8400 | `idle` | | |
| 10000 | the moment ends; play resumes | | | It is how far the real pawn has come along its diagonal toward the
  gold piece on each frame, in squares: it comes in, touches, and bounces back home.

## Cues for the sound round
None of these have sounds yet.

| Cue | Where | Sound |
|---|---|---|
| `pop` | kingpin `breadPop` f6, `capture` f4; `INTRO_ZEBRA_PUFF` f0 | A little cork-like *pop* with a soft flour *puff*, toy-like, never a gunshot |
| `volley` | kingpin `volley` f0 (once a 0.6 s loop) | Four quick soft pops in a rattle, the same voice as `pop` |
| `laugh` | kingpin `breadPop` f9, `bigCheer` f3, `victory` f0 | A big belly laugh, "hah-hah-hah", deep and pleased with himself |
| `chuckle` | kingpin `cheer` f1 | A short one, "heh-heh" |
| `draw` | kingpin `breadPop` f2, `capture`, `check`, `bigCheer` f1; every crew `draw` f1 | A crusty *fwip* of bread pulled fast, with a little crackle of crust (five at once in the talk beat: keep it quiet and a little random in pitch) |
| `relax` | kingpin `relax` f1, `sitRelax` f1 | A calm "ehh, relax" grumble |
| `cock` | kingpin `check` f3 | A crunchy crust squeeze, as if cocking it |
| `tsk` | kingpin `sitScoff` f1 | "Tsk-tsk" |
| `tap` | kingpin `sitTalk` f4, f6; crew `sitArgue` f1, f3 | A hoof knocking a wooden table |
| `puff` | crew `puff`, `sitPuff` f4 | A soft contented exhale with a whisper of steam |
| `flick` | guard A's `guard` f6 | The giraffe dealer's toothpick flick |
| `thud`, `tip`, `point`, `hurt`, `snap` | his `entrance`, `move`, `hurt`, `defeat` | A belly-flop thud, a hat brim's soft tick, a little *hm*, an "oof", a crusty *crack* as the roll snaps |
| `tumble`, `whoosh` | the splash's storm f0, front f0 | A soft floury rush, a whoosh |
| `drop` | Don Dough's `drop` f5 | A soft *whup* of a lump of dough lobbed |
| `plop` | `ZEBRA_DOUGH` `land` f2 | A wet, doughy *plop* on the board |
| `roll` | `ZEBRA_TIMER` `kRollNN` f0 | A fast electronic tick-roll, a quick trill of beeps falling (about 0.2 s, quiet: it plays every move) |
| `ding` | `ZEBRA_TIMER` `kDing` f0 | A kitchen timer's *ding-ding* (bright, short, not a harsh alarm) |
| `rise`, `pop` | `ZEBRA_DOUGH` `kRise` f0, f4 | A soft swelling *fwoomp*, then a light oven *pop* with a puff |
| `squash` | `ZEBRA_DOUGH` `kSquash` f0 | A squishy *splat* with a flour puff |
| `stir` | Don Dough's `goldPlate` f2 | A gentle glaze stir with a pleased hum, "mm-mm-mmm" |
| `gild` | Don Dough's `goldPlate` f8; `GOLD_FX` `gild` f0 | A rising shimmer, a soft glissando of chimes |
| `shine` | `GOLD_FX` `shine` f0 | A bright *shing* |
| `kiss` | Don Dough's `goldPlate` f12 | A chef's-kiss *mwah* |
| `glint` | `GOLD_FX` `glint` f2 (loops) | A tiny high *tink*, very soft (it repeats every 2.6 s, so maybe none) |
| `clink` | `GOLD_FX` `clink` f1 | A bright metallic *clink*, a pawn bouncing off gold |

## Calls for Eric
1. **The kingpin's look**:
   - a fedora (mob) with flour on it, plus a waist apron (baker), not a baker's cap;
   - the pinstripe vest straining over the belly;
   - a pinky ring and one gold tooth.
   - The baker's cap went to guard B and the chef's toque to crew C instead.
2. **His roll lives slung across his back** (its end over his far shoulder), so "he pulls out his bread" reads as a draw over
   the shoulder, and the roll is part of his silhouette in every pose. Between shots he slings it back.
3. **"Puffing a little bit":** a warm breadstick clamped like a cigar, with a little cartoon curl of steam. There is no
   smoking: it's fresh bread.
   - `puff` (standing) is for all five, `sitPuff` for the table crew.
   - Say if you'd rather drop it.
4. **The pop is a puff of flour and crumbs**, not a muzzle flash, with a toy-like *pop* cue.
5. **The crew's looks** (Eric: "I'll have to come up with something funny"):
   - a flat cap with shades and a toothpick;
   - a paper cap with a plaster;
   - a toque with glasses and a pencil (the theory nerd);
   - a grey fedora with a turtleneck and a scar;
   - a beanie with a bow tie and a sweater vest.
   - Swapping any hat or top is one line in `LOOKS`.
6. **Zebras stand a head under the giraffes** (about 69 px to 79): the rivals look up at them. They can be made taller.
7. **Four at the back table** is the kingpin and C, D, E. The two guards stay in the front room.
8. **The splash is light** (a cream flour haze) where the others are dark or icy, so the golden loaves read.
9. **Rising Dough:**
   - The dough is raw-dough cream, shaped like its piece; the rise browns it before the pop.
   - The timer's kind icon is printed on it, so each timer matches its dough.
   - The last minute is red, and the seconds race on every move: 0.25 s, so a move never waits on it.
10. **Gold Plate:**
   - His cast is a baker's golden glaze: stirring a bowl of gold glaze with a pastry brush, humming, then strokes at the board
     and a chef's kiss.
   - The moment runs 10 s: cast 4.2 s, the gilding and shine over it, his line at 5.2-7.7 s, idle by 8.4 s.
   - The gold pieces are recolors of the board's own set, bright gold for white and antique gold for black.
   - The idle glint is a sparkle every 2.6 s; its sound may be better left out.
11. **Gameplay ideas** (from before his passive and ultimate were chosen; Eric has since picked Rising Dough and Gold Plate, so these are only for later):
   - *Bread Line*: a row of pieces is "on hold" (frozen) for a turn.
   - *Crumb Trail*: a capture leaves a crumb square the next piece to land on loses its turn.
   - *Hot Out of the Oven*: his ultimate drops a loaf on three squares; pieces there are blocked for two turns.
   - The `volley` art fits a several-square strike.

## For the code round
- Register `BOSS_ZEBRA` (Don Dough) in `characters/index.ts` and its kit (portrait `BOSS_ZEBRA_PORTRAIT` from `idle` f0).
- Gold Plate: the 10 s timeline in "Gold Plate"; `goldPlate` then `goldBrag` (him); on the piece, `GOLD_FX` `gild`, the swap to the gold SVG at its f3, `shine`, then `glint` looping; a pawn's blocked capture plays `clink` with the pawn moved by `GOLD_CLINK_PAWN`. Add the gold SVGs to `board/pieces/` with a line in `SOURCES.md`.
- Rising Dough: `drop` (him), then `ZEBRA_DOUGH` `land` and `k` on the square; each move plays the timer's `kRollNN`; at 00:00 `kDing` then `kRise`; your piece landing on it plays `kSquash`.
- `breadPop` is the battle start; `volley` is the God King save.
- Add the sounds above in a `zebra-sounds.ts`. They must pass `boss-sounds-finite.test.ts`, and they should be quiet: the
  five-way `draw` happens at once.
- The crew are NPCs as the giraffe crew are. The back room's table and chairs (the bakery's art session) should seat them at
  11 px with the table pokes at about 24 px over their feet.
