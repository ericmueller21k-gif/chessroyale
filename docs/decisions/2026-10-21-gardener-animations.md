# The hippo gardener's animation pack and board art (Oct 21, 2026)

**Eric** approved the third-pass still ("hippo is good to go", `cca20b5`, `2026-10-20-gardener-still.md`) and asked for his animations
and the board art as GIFs. His look is as approved: the first frame of `idle` is the still's pixels (a test keeps a hash of them,
`gardener.test.ts`), and nothing of him was redrawn, only posed. His powers' rules come later, separately: nothing is wired in
(he isn't in `CHARACTERS`, `BOSS_KITS`, `KING_ATTACKERS` or the roster, the board art isn't in `effects.ts`), and `packages/chess` is
untouched.

## What changed in the code

`packages/app/src/characters/gardener.ts`: every pose is numbers on his parts (`GardenerPose`, `gardenerLayers(pose)`). New since
the still: `bob`, `dx`/`air` (the whole of him, and off the ground), `head`, `jaw` (a part of its own: a tusk shows as it opens),
`earN`/`earF`, `eyes` (`open`, `half`, `shut`, `wide`, `joy`), `brows`, the nozzle arm (`fist`, `elbowN`, `nozzle`), `grab` (his near
hand open off the nozzle, which then hangs on its hose), the water (`spray` its length, `droop`, `seed`: a new seed each frame
makes it shimmer), the other hand (`hand`, `elbowF`, `open`, `free`, `lift`: both shoulders up for the shrug), the hose (`sag`) and
the spare hose behind his hip (`loop`: 1 as it rests, 0 all fed out), `tail`, `stepN`/`stepF`.

- **The hose is connected in every frame.** The front hose is one part redrawn from the nozzle's fitting through his other hand (or,
  with `free`, straight) to his hip, and it moves with him (it follows `bob`: the earlier draft left its hip end behind when he sank);
  the spare hose is a part of its own that shrinks as it feeds out. A test checks it in every frame of every animation: one piece,
  touching the nozzle, ending at his hip.
- **The water leaves a little below the nozzle's axis** (`SPRAY_ANG`: the still's 8 degrees gives its 172, as drawn), so a raised nozzle
  fountains up and over and a lowered one sprays the near squares. (The first draft had it the wrong way round: a raised nozzle sprayed
  down across his face and the sweep ran high to low.)
- **Frame:** 90 x 102 (the still's 84 x 88 with 14 more rows above and 6 more columns on the left: 28 rows of headroom over his
  idle's top row for the entrance's drop and the cheers' hops, and room for a longer spray), foot at (55, 96). The still's pixels are
  where they were relative to the foot; the select stage and the boss bar place him by his feet and his idle's top row, so they are
  unchanged (still 69 px from the halo over his ears to his feet). The attack frame (`GARDENER_ATTACK`) is 40 px wider on the left
  (130 x 102, foot (95, 96)). On the phone's boss bar the spray still wants `spray: 4` or `0` (the still's note), and the cheers and
  the entrance's drop want the bar's `tall` box.
- Cue names are for the sounds to come (`grunt`, `thump`, `oof`, `flop`, `toss`, `tug`, `spray`, `sweep`, `stop`, `cheer`, `whoop`,
  `shrug`, `jet`, `spurt`): no sound file yet.

## His animations

Frame counts and lengths are the other bosses' (a test keeps them against Smudgy's); the moments are as long as Alfil's. ms is
where each beat starts.

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| entrance | 10, 1310 | drop 0, thump 340, grunt 690 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 710 | thump 190, thump 430 |
| capture | 12, 1100 | grunt 430 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | grunt 100 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, flop 250 |
| victory (loop) | 12, 1320 | grunt 220, thump 880 |
| **plant** (3 seeds) | 7, 740 | **toss 280** |
| **plantMany** (the opening's 5) | 7, 800 | **toss 330** |
| **water** (the ultimate's cast) | 10, 1340 | tug 100, **spray 460, sweep 590, stop 1010** |
| **cheer** (grew a piece) | 8, 720 | cheer 80 |
| **bigCheer** (grew a queen) | 12, 1200 | cheer 90, whoop 450 |
| **shrug** (nothing came up) | 7, 800 | shrug 300 |
| kingAttack (`GARDENER_ATTACK`) | 32, 2780 | drop 200, land 360, **jet 560 / spurt 730 in turn, every 170 ms (ten)**, grunt 2260, drop 2480 |

- **Idle (2000):** frame 1 is the still. He breathes (a pixel, 625 to 1625), the water runs 0 to 625, thins to a dribble by 1000, stops
  and a drop forms at the nozzle's cap and falls (1000 to 1500), then comes back (1500 to 2000); an ear flicks (375), his head nods a pixel
  (750), his tail lifts (1125), he blinks (1375).
- **Entrance (1310):** his shadow spreads on the ground (0, 100); he drops in with the nozzle up and his jaw open (200, 270), lands in a
  crouch with his eyes shut, ears down and dust, the frame shaking (340, `thump`), straightens with the water coming back (470, 580),
  raises the nozzle in a happy bellow with sparkles (690, `grunt`), settles (860) and holds the still's pose (1020).
- **Thinking (2080, loop):** the nozzle lowered and the water off, he chews and tilts his head to the board, ears and tail easing,
  blinking every fourth beat; a water drop rises off his head, then two, then three; in the third round his free hand comes up to his
  chest, as if scratching his chin.
- **Move (710):** a crouch (0), a heavy step with the near foot (100), down with a thump and dust (190), the far foot (300), down (430),
  settle (550); the water runs throughout.
- **Capture (1100):** a crouch (0), then ten beats of a cheer from 90: the nozzle up with the water fountaining, his jaw wide, ears
  flapping, small hops, drops and sparkles (`grunt` at 430), a calm look (940).
- **Hurt (720):** every color goes pale (0, `oof`), he is knocked back with his eyes shut and the nozzle flung up, the water cut off
  (0 to 70), reels with it sputtering (70, 150, 240), his head down (330), a glare with his brows down (440), steadies (560).
- **Check (950):** a crouch (0), the nozzle levelled at the board, brows down, a hard jet (100, `grunt`, 220), off (320), a second jet
  with a sparkle (420, 540), a dribble (640), steadies (740).
- **Smug (1200, loop):** head back, heavy-lidded, the nozzle low with a lazy trickle now and then and a drop, his free hand on his belly,
  an ear flick, a slow blink.
- **Rattled (640, loop):** shaking a pixel either way, eyes wide, brows worried, jaw open, ears back, sweat flying, the water wobbling
  and the hose jiggling.
- **Defeat (1550):** flash and reel (0, `oof`), the water cuts out and he lets go of the hose (90), sinks onto his haunches with the
  nozzle down at his belly and the hose going slack (250, `flop`, dust), head down, ears limp (460), held with a drop at the nozzle (820).
- **Victory (1320, loop):** the nozzle up with the water arcing over, his free hand open over his head, small hops, jaw wide, drops and
  a sparkle falling (`grunt` 220, `thump` 880).
- **Planting (740; 800 for the opening's five seeds):** he lets the nozzle drop and hang on its hose (the other hand keeps the hose at
  his hip) and opens his near hand on a handful of seeds (0), looks down at them (90), draws the hand back in a crouch (180), tosses
  (280, `toss`: **the seeds leave his hand**), follows through (390), takes the nozzle up again (490) and settles (610). Only the cue
  frame has seeds in the air on him; the board's seeds fly on from his hand.
- **Watering (1340, about Alfil's Slam cast):** he takes the hose in his other hand at his hip, narrowing his eyes (0), hauls it out
  hand over hand (100, `tug`: the spare hose behind his hip shrinks to half; 230: to a stub, the hose taut, his eyes shut), braces with
  the nozzle up and the loop gone (340), the water starts (460, `spray`), he sweeps it from the near squares to the far: low (590,
  `sweep`), level (730), high (870), the water dies to a dribble as the hose goes slack and the loop returns (1010, `stop`), and he
  breathes out (1160).
- **Cheer (720):** the nozzle up and a quick fountain (0), then six hops with his jaw wide and drops falling (80, `cheer`), a smile (560).
  **Big cheer (1200):** both hands up, the nozzle fountaining high, bigger hops, gold sparkles all round (90, `cheer`; 450, `whoop`),
  winding down (900, 1000). Both reuse the capture's poses (`UP`, `fount`) with the free hand raised for the big one.
- **Shrug (800):** he looks at the wet board with his eyes wide and brows up (0), tilts his head and starts to raise his shoulders and
  his free hand (90), shoulders up, head sunk, his free hand out at his side palm up, a drop of sweat (180), held (300, `shrug`), lets it
  drop, eyes shut, a drop forms at the nozzle (450), falls (570), settles (670).
- **His attack on a king (2780, the shared beats):** shadow on the ground (0, 100), drops in (200, `drop`), lands with dust (360,
  `land`), then **sprays a jet of water at the God King each beat, ten of them, staring at him with his brows down, relentless**
  (a 90 ms jet, an 80 ms sputter, from 560: `jet` and `spurt` in turn on the hits' own times, `kingAttackHits()`; the jet is drawn in
  the frame, 2 pixels thick on a flat arc with a pale glint and drops thrown off it, ending in a splash at the king's head, then a little
  lower in turn), a satisfied `grunt` (2260), drops out of the frame (2380 to 2720, the last frame empty). Suggested kit values when
  wired in: `kingAttack: { ch: GARDENER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft: true, hit: waterItem }`, with
  `waterItem` as `moonItem` (`name: "waterHit"`, `hit${i % 2 ? "L" : "H"}${from}`). The preview has no king, so
  `gardener-king-attack-mock.gif` is a mock-up with a stand-in king 1.8 squares off and `waterHit` on his square at each cue;
  `gardener-kingAttack-strip.png` is every frame.

## The board art

`packages/app/src/characters/effects/gardener.ts` (not registered in `effects.ts`; its header lists how each plays): five sprites in
the usual format, drawn to read on the light squares and the dark ones of every board color scheme (Classic `#c0ad90`, Green `#8fb36b`,
Gold `#e8b640`; the light square is `#f0d9b5` in all three). Every plant, seed and drop of water has a dark outline (near-black green for
the plants, deep navy for the water), the plants stand on a small mound of soil, and the greens are darker than the Green scheme's
squares, so **a green plant on a green square still reads**. A square is 32 frame pixels as the other bosses' effects; the sweep
covers the board at the same pixel size (256 x 256), so the drops are the same size as the seeds'.

| Sprite | Animations | What it is |
| --- | --- | --- |
| `seedFly` (square) | fly (loop, 220) | a seed tumbling; the board moves it on an arc from his hand to the square (a CSS transform, as `carrotFly`) |
| `seedPlop` (square) | plop (425, ends empty; **plop 0**) | it lands in a puff of dirt (0), dips into the soil (55), a dimple with a few crumbs (125), the dimple fading (205, 295), gone (385). Nothing is left. |
| `waterSweep` (board) | sweep (420, **spray 0**), sheen (760, ends empty) | spray streaks with a navy edge and a haze at the front cross the board from its left edge to its right, the lower rows leading (a hose sweeping from the near squares to the far); a see-through blue tint is left behind, then twinkling glints and a few running drops, fading |
| `gardenPlant` (square) | sprout, grow, green, toFall, fall, toDrop, drop, gone, kill, bud, budQueen, wilt | the sprout and everything it turns into |
| `waterHit` (square) | hit<H\|L><L\|R> (200, ends empty) | his jet landing on a king: the stream coming in, a burst, drops falling |

**The sprout and its outcomes** (all drawn over the piece on the square; the piece shows through where it must). Every outcome starts
from the sprout's last frame, `seedling`, with its first frame a small change of it.

- `sprout` (300, **sprout 0**): the soil heaves with specks of dirt (0), a green sprout pokes up (60), opens (130) and is the seedling (200).
- **Plain plant**, one state a turn: `grow` (290, **grow 0**: a small leafy plant unfurls) then `green` (loop, 1040: swaying gently: the
  turn it grew), `toFall` (340: the tips go yellow, then it all turns) then `fall` (loop: oranges, ambers and red-browns: the next turn),
  `toDrop` (340: leaves begin to fall) then `drop` (loop, 960: the lowest leaves gone, a few left on a bare stem, others falling and
  lying on the soil: the third turn), `gone` (480, ends empty: the last leaves fall, the stem browns and folds, the mound settles and sinks).
- **Killer plant**, `kill` (870, ends empty; **rise 0, open 270, snap 350, gulp 470**): the seedling swells a bulb and it rises as a
  snapping plant (a flytrap's jaws, green with a pale rim, crimson inside, teeth), shut (60, 130), jaws open (200, 270: wide open, round
  the piece), **snaps shut on it at 350: take the piece off at `snap`, the way a captured piece goes**, white flecks flying, chews
  (400: the pod bulges, 470 `gulp`: stretches), sinks back (540, 620), soil smoothed (700, 770), gone (830).
- **A grown piece**, `bud` (550, ends empty; **swell 0, pop 270**): a pink-tipped bud swells (0, 70, 140), trembles (210), and opens at
  270 (`pop`: a ring of pink petals bursts out round the middle of the square with sparkles; **put the piece on its square at `pop`**, its
  own pop-in as a captured piece's, scale 0.35 to 1.2 to 1 over about 160 ms in the mocks), the petals drift apart and fade (350, 430),
  gone (510). `budQueen` (630): the same but grander: a golden bud with a white tip, sparkles on it before it opens, a double ring of
  eight gold and pale petals (a corona) with bigger sparkles at the pop (270), one more step of fading (510), gone (590). Another piece
  than a pawn or a queen plays `bud`.
- **Nothing**, `wilt` (490, ends empty; **wilt 0**): the sprout leans and its leaves go yellow (0, 70), droops brown (150), lies down on the
  mound (240), shrivels (320), sunk (390), gone (450).

Checked on a light square and a dark one of each scheme at 40 px squares (a 320 px phone board: nearest-neighbor 32 to 40) and at 3x
(`board-art.png`, with the GIFs). The Green scheme's green plant reads by its dark outline and soil mound; the fall leaves and the queen's
gold are outlined against the Gold squares; the sweep's navy-edged streaks carry it on the light squares and its pale cores on the dark.

## Calls made

- **The toss is his near hand, with the nozzle left hanging**, not the far hand reaching across his chest (which hid the seeds and
  made a slab of arm) and not a seed packet raised by his head (it read as a salute): the near arm is the one toward the board, so the
  seeds fly clear of his face. The packet was dropped ("keep it small"); the seeds are two-pixel tan and brown ovals so they read on the
  dark ground and the light.
- **The ultimate keeps the hose in his hand** while he hauls (`tug`): the loop behind his hip shrinks as the hose comes out, so it reads
  as pulling from behind his hip, as Eric said of the hose.
- **Reuse:** the cheer, the big cheer, the capture and the victory share the fountain poses (`UP`, `fount`), the shrug and the planting
  share the lowered nozzle (`DOWN`), and the thinking, smug and defeat share the free hand's poses: numbers, not new frames.
- **The sweep flips:** it is drawn coming in from the board's left edge and the board flips it for a hippo on the right (his art
  faces left, so the mocks put him on the board's right, and play it flipped, as the attack's hits come `from` a side). The sprout on a
  square starts when the front reaches it (`SWEEP_MS` = 420 for the whole board, plus the lean of the front), the board's call.
- **Outcome timing is the board's:** the sprite plays each outcome from the sprout; the mocks stagger the outcomes and play his one
  reaction at a time (`cheer` at a pawn's `pop`, `bigCheer` at the queen's, `shrug` just after a `wilt`).
- **Seeds are decorative:** `seedPlop` is 425 ms and leaves nothing, so it is light enough to play over your turn; the real spots are
  decided at the watering.

## Not done, or for Eric

- No sounds (cues only), and nothing wired. His name is still open.
- The board art is not in `effects.ts` (one line each to add it, and `EffectName`'s documentation in `power-art.ts`).
- The killer plant draws over the piece; its open jaws cover the piece's sides at 270 ms. If it should stand behind the piece's
  front, the board would draw `kill` in two layers (the page would have to split it).
- On the Gold scheme the queen's gold petals read by their dark outline, not by color.

## Tests

`packages/app/test/gardener.test.ts`: the still's pixels (a hash of the approved first frame), every shared animation's frame count,
length and looping against Smudgy's, the moments' lengths, every cue in order (the toss, the watering's four, the ten jets on
`kingAttackHits()`), the seeds in the toss, the hose connected in every frame, nothing cut off at any frame's edge, every color in
the palette. `packages/app/test/gardener-art.test.ts`: the palettes and frame sizes, what ends on an empty frame, the cues, the plain
plant's three states chained from the sprout, the outlines and the soil, the sweep's see-through tint. Run alone:
`npx vitest run packages/app/test/gardener.test.ts packages/app/test/gardener-art.test.ts`.

Preview: `npm run preview:characters -- <dir> extra=packages/app/src/characters/gardener.ts only=gardener,gardener-attack scale=3`
(`ground=#f3f1ec` for the light ground). The board GIFs are composed from the same frames and the game's own piece art by a script
outside the repo.
