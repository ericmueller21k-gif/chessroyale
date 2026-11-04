# Jefferson's battle intro art (Nov 4): the crew comes over, your floor lift, the firework wipe

**Eric's design (Nov 4):** you both walk to the marks in his warehouse, and he hollers for his crew. **The crew stop what
they're doing and come over**: the lift guy and the forklift guy step off their machines, the dealer leaves his corner, the
leaners push off the wall, the clipboard guy tucks his board and the dozer wakes. They stand round the table behind, in a loose
ring, watching. The board already stands on its wobbly crate stack. **The floor tile at your mark rises on a cylindrical
piston** and lifts you level with the board. He stands: no stool. The code adds his God King attack swing. Then the wipe:
bursting fireworks, sparkler trails and stars. The boss is on the left and you on the right, in about 13.5 s.

- **Brief:** `notes/briefs/brief-jefferson-art.md`.
- **The room and crew:** `shop-grex-nov4.md`.

## Cost
**Drawn by hand on the weekly plan usage** (Eric, Nov 4), not with the API runner. There was no API spend.

## Stills (mockups from the challenge camera)
- **The fight start**, you both on your marks: [phone](house-intro-grex/view-fight-start-phone.png) and
  [computer](house-intro-grex/view-fight-start-computer.png).
  - The board on its crates is in the middle.
  - The lift guy on his lift is in view, top left, on both.
  - The clipboard guy is in view on both.
  - The dealer by his SHOP sign is in view on the computer, and out of view to the right on the phone.
- **The key frames, one sheet** (phone, 1.0 to 12.8 s): [view-intro-keyframes.png](house-intro-grex/view-intro-keyframes.png).
  1. The line.
  2. The call.
  3. The crew stopping.
  4. The wave-over, with the crew walking in.
  5. The crew round the table.
  6. The lift rising.
  7. You lifted, the crates creaking.
  8. The God King swing's slot.
  9. The brag.
  10. The wipe half across.
  - **Every figure is fully on screen at rest and at the end of every move**, on phone and computer. The ring was checked on
    both.
- **His moves and the props at 3x:** [view-moves-and-props.png](house-intro-grex/view-moves-and-props.png).
- **How they were made:** `scripts/boss-art/intro-grex-view.ts <dir> <phone|computer> <t,...>`.
  - `SHEET=<png> COLS=n` puts every still in one picture.
  - The camera is CHALLENGE_FEEL.cam.across (0.75 squares west and 0.8 south of the table's middle, zoom 1), under the
    room's 52 px header.
  - The phone is 390 x 844 and the computer 1280 x 720.
  - The slab and board on the crates are stand-ins: the renderer draws the real ones.
  - No GIFs (Eric, Nov 4).

## For the code helper
### Jefferson: `BOSS_GREX_INTRO` (id `grex-intro`) in `boss-grex/boss-grex.ts`
- **His drawing is the game's** (`characters/grex.ts`). Every pose is built with his own rig (`grexBuild`), so its parts are
  his own (GREX.parts). Nothing new is drawn on him.
  - The hoof at his muzzle uses his rig's near arm, which reaches to wherever he grips his Roman candle. The pose grips an
    unseen candle there and leaves the candle's layer out.
- **His frame is GREX's:** 100 x 122, foot **[48, 118]**, facing our right. **Not mirrored.**

| Animation | Frames | Cues | What it does |
|---|---|---|---|
| `call` | 8 frames, 1.11 s, once | `shout` f1 and f5 | He ducks his head a little, cups his near hoof by his muzzle and hollers twice. Little sound-lines come off his mouth, his far sparkler is raised and waved, and his flames roar up on each shout. |
| `waveOver` | 4 x 130 ms, loops | `whoosh` f0 (soft) | "Over here": the near arm swung out and pulled in, twice a loop, a grin. |
| `brag` | 10 frames, 1.4 s, once | `laugh` f2, `fizz` f5, `stomp` f8 | Both sparklers up, a twirl, a laugh with big flames, a smug hip-pop and point, a stomp. It ends on his idle's first frame. |
| `idle` | 1 | none | His idle's first frame. |

### The props: `house-intro-grex/house-intro-grex.ts`
- **`INTRO_GREX_TABLE`** (the crate stack): the tables' geometry, **111 x 72, foot [55, 66]**.
  - It is the room's `board-stand` without its slab and board: the renderer draws those.
  - **The slab's top is `INTRO_GREX_TABLE_TOP` = 59 px over the foot.** TABLE_BOARD.top is 27, so this one is 32 higher.
    Draw the slab and board at 59.
  - **Hide the room's `board-stand`** for the intro and draw this at the table's spot (9.5, 10.5). It is the same picture in
    the same place: no jump.
  - Animations:
    - `idle` (8 x 180 ms, cue `creak` f2): a slight wobble, the top three crates a px either way.
    - `creak` (once, 7 x 90 ms, `creak` f0): a bigger wobble. Play it as your lift clunks home.
  - **`INTRO_GREX_TABLE_SWAY`:** per frame, the slab's [dx, dy] shift in the table's px. Draw the slab and board that much
    over, so they ride on the top crate.
  - **`INTRO_GREX_TABLE_PALETTE`:** the slab is plank wood ("1" to "5"), the squares cream `L` #f4e4b8 and firework orange
    `D` #cc5a2c.
  - **`INTRO_GREX_TABLE_INK`:** the same squares with their shades and lines. As with Alfil's and Wrangler's, keep the
    town's `TABLE_INK` for the pieces: the charcoal pieces read on the orange.
  - **His side has no stool: he stands.**
- **`INTRO_GREX_LIFT`** (your floor lift): **37 x 80, foot [18, 64]**. Its foot is the plate's middle on the floor: put it
  on your mark (`SHOP_GREX_MARKS.you`, (11, 10.5)).
  - **The plate:** the mark's steel plate, 30 px (`SHOP_GREX_PLATE`), with a hazard rim and a tread, seen from above, 24 px
    deep. Its front edge is a 3 px hazard-striped steel band.
  - **The piston:** a chrome cylinder, 13 px across, lit on its left, with collar rings every 9 px. It comes out of a dark
    hole with a steel collar, which covers the floor's painted plate while the lift is up. A puff of steam comes out as it
    moves.
  - Animations:
    - `flush`: 1 frame, the same as the floor's mark.
    - `rise`: once, 9 frames, 1.3 s, eased; `hiss` f0, `clunk` f8 (it locks at the top).
    - `up`: holding.
    - `down`: once, 0.9 s, `hiss` f0 and `clunk` f8. It is for after the match; the wipe covers the intro's end.
  - **`INTRO_GREX_LIFT_H`:** the plate's height per frame, in px.
    - flush [0];
    - rise [2, 5, 9, 14, 19, 24, 28, 31, 32];
    - up [32, 32];
    - down, the reverse.
  - **Stand your pawn's foot that much up, on the plate's middle.**
  - **`INTRO_GREX_LIFT_MAX` = 32.** At the top, the board (59) is 27 px over your feet, as a park table's is over the floor:
    "level with the board". You are then about his height, as Eric asked.
  - Draw the lift just in front of the table's depth (your mark's row). Draw your pawn on it, after it.
- **`INTRO_GREX_STORM`** (128 x 128, tiles both ways) and **`INTRO_GREX_FRONT`** (48 x 128, tiles top to bottom):
  - 6 x 70 ms, looping. The storm's cues are `whistle` f0, `pop` f2 and `bang` f4; the front's is `fizz` f0.
  - Play them exactly like Alfil's sandstorm and Wrangler's dust: the tile at 3x behind its front, sweeping in from the left.
  - **The storm:** a night sky in soft bands (navy to violet) with eight cartoon bursts (white, gold, pink, cyan, green,
    violet, orange), two glittering sparkler trails, a rocket going up and twinkling stars.
  - **The front:** a wall of sparkler fizz (gold and white glitter), sparkler wires sticking out of it, and sparks flying out
    ahead. Its left side matches the storm, with no seam.
  - **No flashing:** each burst opens, droops and thins over the loop, out of step with the others, and the sky never
    changes brightness. It is no faster than the other wipes.
- **`INTRO_GREX_CREW_SPOTS`:** the loose ring behind (north of) the table, in squares (a figure's foot), with each one's
  facing toward the table.
  - **Every spot is fully on screen on the phone and the computer.**
  - All are north of the board, of him and of you, so none hides them.

| who | figure | spot | faces | plays there |
| --- | --- | --- | --- | --- |
| the lift guy | `npc-grex-lift-guy` | (6.6, 9.4) | east | `watch` |
| leaner A | `npc-grex-leaner-a` | (7.3, 8.3) | east | `watch` (sparkler at his side) |
| the clipboard guy | `npc-grex-crew-c` | (8.4, 7.6) | east | `watch` (clipboard tucked) |
| the dealer | `sidekick-grex-dealer` | (9.6, 7.2) | west | `idle` (the toothpick flick) |
| the dozer | `npc-grex-crew-d` | (10.7, 7.6) | west | `watch` (half awake) |
| leaner B | `npc-grex-leaner-b` | (11.7, 8.3) | west | `watch` (sparkler in his mouth) |
| the forklift guy | `npc-grex-fork-guy` | (12.4, 9.4) | west | `watch` |

- **`INTRO_GREX_CREW_SETOFF`:** each one's delay (ms) after the crew set off, so they don't move as one:
  - crew-c 0;
  - leaner A 150;
  - leaner B 250;
  - the lift guy 350;
  - the forklift guy 450;
  - the dealer 600;
  - the dozer 900, after his `wake`.
- **Where each sets off from:**
  - the two machine guys: their machine's foot plus `NPC_GREX_STEP_OFF`, after its `stepOff`. The machine then stays
    `parked` where it was.
  - the rest: their places (`SHOP_GREX_CREW`, `SHOP_GREX_KEEPER`).
- **The walking:** they walk at about 3.2 squares a second (the mockup's), facing the way they go, **round the table's north
  side**. They never pass between him and the table or you and the table.
  - The mockup's routes go up the west side for the west crew and up column 13 for the forklift guy.
  - After the match they go back to their loops and places, with no walk back (Eric).

### Sounds (cues and where they fit)
Jefferson's sounds are in `characters/grex-sounds.ts`. The new ones must pass `boss-sounds-finite.test.ts`, and the no-chimes
test if it applies to him.

| Cue | Where | Sound |
|---|---|---|
| `shout` | `call` f1, f5 | **new**: his holler, a short cocky "hey!" with a little rasp (his laugh's voice) |
| `whoosh` | `waveOver` f0 | his own whoosh, soft and short |
| `step` | every crew `walk` f0/f3, both `stepOff`s | **new**: a hoof's clop on concrete, soft; seven giraffes at once, so keep it quiet and a little random in pitch |
| `snort` | the dozer's `wake` f0 | **new**: a startled snort |
| `hiss` | your lift's `rise` f0 | **new**: a hydraulic hiss, rising |
| `clunk` | your lift's `rise` f8 | **new**: a heavy metal clunk as it locks |
| `creak` | the table's `idle` f2 and `creak` f0 | **new**: wooden crates creaking (quiet on idle, louder on `creak`) |
| `laugh`, `fizz`, `stomp` | `brag` f2, f5, f8 | his own |
| `whistle` | the storm f0 | **new**: a rising firework whistle, short |
| `pop` | the storm f2 | **new**: a small firework pop (soft, toy-like) |
| `bang` | the storm f4 | **new**: a soft, muffled bang (never sharp or loud) |
| `fizz` | the front f0 | his sparkler fizz |

**The room's own cues** (on the loops, quiet, only while near): `beep` (the lift's drive, the forklift's reverse: a soft
reversing beeper), `engine`, `hydraulic`, `whir`, `clunk` and `creak` (the forklift), `fizz` and `puff` (the leaners), `tick`
(the clipboard), `snore` (the dozer), `flick` and `psst` (the dealer).

### Suggested timeline (about 13.5 s; the mockup plays it)
| Time (s) | What happens |
|---|---|
| 0 | You both on your marks (his at (8, 10.5), yours on the lift's plate at (11, 10.5)); his line, one of the code round's at random (the shared intro, to about 2.5) |
| 2.6 | `call` (1.1): he hollers for the crew |
| 3.5 | The crew stop. The lift and the forklift play `stepOff` (0.53) and then `parked`. The dozer plays `wake` (0.56). The others drop their loops. |
| 3.7 | `waveOver` (two loops, 1.04) |
| 3.9 | The crew set off, each after `INTRO_GREX_CREW_SETOFF`. They walk round the north side to their spots and arrive by about 8.0, each then playing `watch` (the dealer `idle`). |
| 4.7 | He's back to his idle, watching them come |
| 8.3 | Your lift's `rise` (1.3): your pawn rides up to 32 px (`hiss`) |
| 9.5 | It locks (`clunk`, the rise's f8). The table plays `creak` (0.63). |
| 9.7 | (The code's God King attack swing, as for the others, to about 11.0) |
| 11.0 | `brag` (1.4), then his idle |
| 12.5 | The wipe sweeps in (0.6), holds while the battle loads and slides out |

## Calls Eric may want to change
1. **The table is five crates high, the slab 59 px over the floor**, more than twice the park table's 27. **Your lift rises
   32 px**, so the board is the usual 27 px over your feet and you're about his height.
2. **Your lift's plate is your mark**, a steel plate with a hazard-striped rim on the floor from the start. The piston is a
   chrome ram with collar rings, coming out of a dark hole with a little steam.
3. **His call is two hollers with a hoof cupped by his muzzle**, made with his own rig's arm. He ducks his long neck a
   little to bring his mouth to it.
4. **The ring:** seven of the crew in a loose arc behind the table, about 1-3 squares back, the dealer in the middle behind the
   board. Everyone faces the table.
5. **The machine guys step off toward the camera**, and the machines stay parked where they were.
6. **The dozer wakes with a snort** and comes over last, half awake.
7. **The wipe's front is a wall of sparkler fizz**, with wires sticking out and sparks flying ahead.
8. **Timing:** the crew walk at about 3.2 squares a second so the slowest, the dozer from the far corner, arrives by 8 s. The
   intro runs about 13.5 s, inside Eric's 13-15.
9. There is no review sheet Character for the props: the moves-and-props still covers it.
