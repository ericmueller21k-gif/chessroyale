# Timber's battle intro: the log, the shavings storm, his table and the stumps

## The plan (short)
Eric's design (Nov 3, his words): "When he walks in, to the left there's a giant thick wooden log. He picks it up and
walks it over (doesn't have to look too realistic) and sets it in the middle where the chessboard goes. Then he starts
gnawing at it, and that's the clever part: a big storm of wood shavings and sawdust comes up like a fog, then it falls
and dissipates, and you see he's chewed it into a board (the table with the board). The seats are little wooden stumps."
- **Sides:** the boss stands on the **left**, you on the **right**, with the table between you.
- **Length:** about **12 s** in all.
- **Sounds:** his existing sound set.

The art comes in **two runs**:
1. **This run: the props**, in `house-intro-timber`: the log, the shavings storm, his table, the two stumps, and the
   full-screen sawdust transition.
2. **A second run: Timber himself**, in his own file (`boss-beaver.ts`, which holds his rig): lifting, carrying,
   setting down and gnawing the log you draw here. It reads your file, so **the log must be exactly as described below**.

The code comes later from another helper. Follow Alfil's and Big Boy's intros for the structure:
- `scripts/boss-art/out/house-intro-alfil/house-intro-alfil.ts` and `scripts/boss-art/out/intro-alfil-nov2.md`;
- `scripts/boss-art/out/house-intro-bigboy/house-intro-bigboy.ts` and `scripts/boss-art/out/intro-bigboy-nov2.md`.

## The timeline (code plays it; ~12 s)
| Time | What happens | Who draws it |
|---|---|---|
| 0.0 | You and Timber are in the circle; he says his line. The log lies on the floor to the **left**, west of the circle. | the log: `lying` |
| 1.5 | He walks to the log. | his run: `walk` |
| 2.5 | He heaves it up. | his run: `lift` |
| 3.1 | He carries it to the middle, where the table stands. | his run: `carry`, moved by code |
| 4.6 | He stands it on end in the middle, `thump`. | his run: `setDown`; then the log's `standing` |
| 5.1 | He gnaws it: chips fly and bites appear in it. | his run: `gnaw`; the log's `gnawed` |
| 6.6 | The **shavings storm** boils up from the log: a fog of shavings and sawdust that hides the log, the middle and most of him. | `rise` |
| 7.6 | It churns. Under it, code swaps the log for the **table** and the **stumps**. | `hold` |
| 8.2 | It falls and thins away, leaving a ring of shavings on the floor and the table and stumps standing. | `settle` |
| 9.4 | Timber dusts off his paws and chitters. | his run: `done` |
| 10.4 | The **sawdust transition** sweeps across the screen, then you're in the game (about 12 s). | `STORM` + `FRONT` |

## Read first
- Alfil's and Big Boy's intros (above).
- `packages/app/src/town/houses/park.ts`: `PARK_TABLE`, `TABLE_BOARD`, and the palette keys `"1"`-`"5"`, `L`, `D`.
  The renderer draws the board's slab with `"4"` for the front, `"2"` for the top and `"1"` for the top edge, and `L`/`D`
  for the squares.
- Timber, for his colors and his wood: `scripts/boss-art/out/boss-beaver/boss-beaver.ts`.
- His home and shop: `scripts/boss-art/out/house-timber/house-timber.ts` and
  `scripts/boss-art/out/house-shop-timber/house-shop-timber.ts` (their wood colors, bark and growth rings).

## The pieces (id `house-intro-timber`; one file)
### 1. `INTRO_TIMBER_LOG`: the giant log (the second run draws Timber carrying this same log)
- **Lying on the floor**, as seen by the town's camera looking north: a thick barked log lying east to west, about
  **64 px long, 30 px thick**, its round cut ends showing growth rings and its bark in his browns.
- **Standing on end in the middle:** the same log stood upright, about **32 px across and 52 px tall**, with its top
  showing the rings.
- **Picture:** wide enough for both, with the **foot at the log's bottom middle**.
- **Animations:**
  - `lying`: 1 frame;
  - `standing`: 1 frame;
  - `gnawed`: 6 frames, played while he gnaws. Bites appear one by one round its middle and top, chips spray out, and
    the log narrows to an hourglass by the end.
- **Export `INTRO_TIMBER_LOG_LOOK`:** a few lines of notes the second run reads, with the log's colors (palette keys
  and hex), bark pattern and sizes, so it can draw the same log in Timber's paws.

### 2. `INTRO_TIMBER_SHAVINGS`: the storm (upright; foot = the table's foot)
- **Look:** a billowing cloud of wood shavings (curls in his raw-wood and plank colors), sawdust and wood-dust fog. Pale
  and warm, mostly opaque at its peak.
- **Size:** about **170 px wide and 150 px tall**, so at its peak it hides the whole middle: the log, the table's spot,
  the stumps' spots and most of Timber beside it.
- **Animations:**
  - `rise`: 8 frames at about 110 ms. It boils up from the log's base and grows.
  - `hold`: 4 frames at about 120 ms, looping. Full, churning, with curls tumbling in it. Code swaps in the table and the
    stumps underneath.
  - `settle`: 10 frames at about 120 ms. The shavings fall, the fog thins and drifts off, and it ends as a low ring of
    shavings on the floor round the table's foot, which code can keep or fade.

### 3. `INTRO_TIMBER_TABLE`: the table he chewed out of the log
- **Geometry:** the same as `PARK_TABLE` (the same width, height, foot and `TOP_Y`), so the renderer's slab and board land
  in the same place.
- **The leg:** a chunky carved log pedestal, with gnaw marks round it and bark left at its foot.
- **No stools:** drop them; the stumps are separate pieces.
- **`INTRO_TIMBER_TABLE_PALETTE`:**
  - `"1"`-`"5"` for the slab, a varnished slab of his wood;
  - `L` and `D` for the board's squares, maple and walnut, **easy to read**: the town's cream and charcoal pieces must
    show clearly on both. Show this in the review sheet on a small 8 x 8 board with a few of `TABLE_PIECES`' shapes.

### 4. `INTRO_TIMBER_STUMP`: a seat
- **Look:** a short wooden stump with a flat sawn top showing rings, bark round its sides, and a root or two.
- **Placement:** each stands where one of `PARK_TABLE`'s stools does (one on each side). Its top is at the park stools'
  seat height (`TOWN_FEEL.sitSeat` x 37 px, about 10 px over the foot), so players sit on it as on a stool.
- **Animations:**
  - `idle`: 1 frame;
  - `pop`: 6 frames. Your call how it appears: it springs up out of the floor with a puff of sawdust, or drops in. Say
    which.
- **Export the seat's height** (`INTRO_TIMBER_STUMP_SEAT_H`).

### 5. The sawdust transition: `INTRO_TIMBER_STORM` and `INTRO_TIMBER_FRONT`
These are exactly like Alfil's sandstorm, so the same code plays it: two small pictures scaled 3x with no smoothing.
- `INTRO_TIMBER_STORM` (128 x 128, **tiles seamlessly both ways**, 6 frames at 70 ms, looping with no jump): a thick wall
  of blowing sawdust, wood shavings and chips racing right, in his wood colors. Fully opaque.
- `INTRO_TIMBER_FRONT` (48 x 128, **tiles top to bottom**, 6 frames): its leading edge. Its left side matches the storm;
  its right side is ragged, with chips and curls flying ahead.

### 6. `HOUSE_INTRO_TIMBER`: the review sheet
Its `idle` shows the pieces side by side. It has one extra animation per piece animation, plus a 3 x 2 tiling of the
storm with its front on the right to check the seams.

## Cues (his sound set: `packages/app/src/characters/timber-sounds.ts`)
His sounds are `gnaw`, `chomp`, `clack`, `knock`, `pat`, `tap`, `whack`, `saw`, `thump`, `clatter`, `slap`, `swoosh`,
`slide`, `chitter`, `oof`, `hup` and `burp`. Put cues on your frames, for example:
- `gnaw`/`chomp` on the log's `gnawed` bites;
- `clatter` as the storm rises;
- `saw` while it holds;
- `knock` as each stump pops;
- `swoosh` on the transition.

List every cue with its frame.

## Looks
- Render each animation frame by frame at 2x or 3x on both backgrounds.
- Render the review sheet at scale 1, **one frame only**: a many-image request can't take a picture over 3,000 px.
- Check that:
  - the log reads as a log both lying and standing;
  - the storm fully hides the middle at its peak and settles cleanly;
  - the table's leg and slab colors read, and the board is easy to read;
  - the stumps sit on the stools' spots;
  - the storm tiles have no seams.

Call done with notes: each piece's size and foot, its frames beat by beat, every cue, and the log's look for the second
run.

## How to write it
Build the file in steps (the palette, the log and the table first, then the storm, the stumps and the transition),
rendering as you go. Keep each turn's writing under about 600 lines.
