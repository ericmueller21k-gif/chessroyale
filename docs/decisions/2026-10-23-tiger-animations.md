# The circus tiger: his balloons and the pump, his animation pack and the burning hoops (Oct 23, 2026)

Lane: `characters`. Area page: [bosses.md](../areas/bosses.md). After his still ([2026-10-23-tiger-still.md](2026-10-23-tiger-still.md))
and the bar's free room ([2026-10-23-boss-bar.md](2026-10-23-boss-bar.md)). Look only: nothing in the game draws any of it yet; the
rules and the wiring come later. Step 1 (below, approved as is) is the balloons and the pump; step 2 (further down) is his animation
pack, his own moments, his attack on a king and the burning hoops. The director accepted the computer proposal of 1e (the pump at the
22 px slot's left end): that is for the wiring, no art change.

**His passive, as the art shows it:** a small balloon pump sits in the boss bar's free room. He puts a limp balloon on its nozzle; it
inflates in 4 stages (15 s each), a little more of a chess piece at each; then it is released, flies onto the board at the end of his
turn and becomes one of his pieces; or, too big, it pops. The pieces: pawn (most), knight, bishop, rook, queen, and a fake queen that
looks exactly like a queen and always pops.

**Eric (Oct 23):** "by the third, and then the final one where it's the actual balloon, it should be pretty clear, distinguishable as
far as what the piece is"; and on the bunch he holds: "It's a bit hard to make out what the pieces are... if they could be slightly
sharper, it would probably help." The pixel style stays: sharper means cleaner pixel shapes, never smoothing.

## What was built

- **`packages/app/src/characters/tiger-bar.ts`**: the balloons (`BALLOON_SHAPES`: five pieces, four stages each; `BALLOON_COLORS`;
  the shading rule `shaded`; `swell` and `squash` for the strain and the puff) and the pump, `TIGER_PUMP`, a character of its own for
  `BossUi.barProp` (34 x 36 frame, placed by its foot under the nozzle, one sprite pixel to one CSS pixel as his figure in the bar).
  Its animations: `bare`; `put<Piece>`; `stage1`, `stage<2-4><Piece>` (holding); `grow<2-4><Piece>` (the step up, 400 ms);
  `pop<2-4><Piece>` (400 ms); `release<Piece>` (330 ms). `pumpAnim(kind, piece, stage)` names them.
- **`packages/app/src/characters/effects/tiger.ts`**: `BALLOON_FLY` (`fly<Piece>`, loop, 480 ms) and `BALLOON_LAND` (`land<Piece>`,
  790 ms), square sprites as the other bosses' board art (32 frame pixels a square). Not registered in `effects.ts` (no wiring).
- **His bunch redrawn** in `tiger.ts` with the pump's drawings (below). The rest of him is the approved pixels, and a test keeps it so.
- Tests: `packages/app/test/tiger-bar.test.ts` (new) and `tiger.test.ts` (the figure's hash, the bunch's gaps).

## The balloons

Typed by hand at their real size (a silhouette and its knot), shaded by the still's rule (a light rim at the left, a dark one at the
right and under it, one shine), with the renderer's 1 px dark outline round every balloon. Sizes in pixels, silhouette (wide x high,
the knot row included; the outline adds 2 each way):

| | stage 1 | stage 2 | stage 3 | stage 4 |
| --- | --- | --- | --- | --- |
| pawn | 7 x 7 | 7 x 9 | 7 x 11 | 9 x 15 |
| knight | 7 x 7 | 8 x 10 | 9 x 15 | 12 x 20 |
| bishop | 7 x 7 | 5 x 12 | 7 x 15 | 9 x 20 |
| rook | 7 x 7 | 7 x 8 | 9 x 11 | 11 x 15 |
| queen | 7 x 7 | 7 x 10 | 9 x 15 | 11 x 20 |

- **Stage 1** is the same limp, leaning blob with a crease for every piece. **Stage 2** is a blob in the piece's proportions: a round
  top over a round bottom (pawn), a lean with its top to the left (knight), a tall narrow pinched shape (bishop: a pointed top; queen:
  a flat, slightly notched top, so a careful eye might guess), a squat column (rook). **Stage 3** has the feature: the pawn's head on
  its collar, the knight's head with two ears and a snout (facing left, the board's way, on the bar and the board alike), the bishop's
  ball and mitre with its slit, the rook's three merlons on a straight tower, the queen's five points and ball. **Stage 4** is the
  finished piece, its base flared, the queen slim-waisted under a wide crown so she never reads as the rook.
- **The fake queen** is the queen's drawings: there is no other, so they can't differ.
- **The color is passed in** (my call, as the brief asked): each balloon takes one of six colors, the reference's yellow, red, blue,
  green, purple and pink (three tones each: dark, round, light), as a `look` of the pump and of the board sprites, not tied to the
  piece. The shape, not the color, tells the piece, so the first stages keep their suspense and a red balloon is not a promise of a
  queen. Every piece reads in every color on light and dark grounds (the dark outline does it; checked on the stage sheet and on the
  three board schemes, green on Green's dark square and yellow on Gold's included).
- **Over-swell and pop** (from stage 2, 3 or 4): the shape swells past its size (each row as wide as its widest neighbor and a pixel
  more each side, its notches filled, a row more on top, never below: the knot stays on the nozzle), then once more, strains (a long
  shine, a squash and a stretch: the wobble), bursts in a white and yellow flash, and five rubber scraps fly out, fall and shrink to
  specks; the nozzle is left bare. 60 + 60 + 45 + 45 + 50 (`pop`) + 50 + 50 + 40 = 400 ms. Cues: `squeak` (the swell), `pop`.
- **Growing a stage:** the plunger strokes down (`pump`, 70 ms), the old shape squashes (70), the new one comes in squashed (`squeak`,
  80), stretches (80) as the plunger rises, and stands (100): 400 ms, ending on the next stage's look. The squash widens the shape's
  outer ends and drops a row that repeats the one under it, the stretch doubles one, so no feature (an ear, a merlon, a point) is lost.

## The pump

A circus balloon pump in his vest's red and gold: the nozzle on a little gold stand at the left (a steel tip under the knot), a red hose
along the bottom to the barrel at the right (red, lit from the left, gold bands at its top, middle and foot, on a gold base plate), its
plunger's T-handle on top. 26 x 20 px with its outline. Its plunger strokes by itself at each stage change. The barrel stands right of
the widest swell's reach (10 px left and 9 right of the knot, the knight's), so a swollen red balloon never touches the red barrel.

**Heights:** the pump and the biggest stage-4 balloon (knight, bishop, queen) are 30 px from the base to the balloon's top, the
pawn's and rook's 25; stage 3 is 25 (21 for the pawn and rook), stages 1 and 2 stay inside the pump's own 20 (22 for the bishop's tall
blob). The over-swell reaches 32, 2 past the 30 (the brief allowed 4). At rest everything is in the frame's bottom 30 rows (a test).

**Its states:** `bare`; `put<Piece>` (the limp balloon dropped on, `squeak`, 160 ms); holding (`stage1`, `stage<n><Piece>`); `release<Piece>`:
the finished balloon lifts 1, 3, 5 px off the nozzle on its string (`whoosh` on the first), then the prop shows `bare` and the flight
takes over where the knot was (`RELEASE_KNOT`).

## The flight and the landing (board art)

At the board's art size (32 frame pixels a square), the balloon is the bar's own stage-4 drawing pixel for pixel (20 of 32 high with
its outline, 11 to 14 wide; 23 to 28 with its string), so the balloon that leaves the bar is the one that lands. On a 320 px phone board
(40 px squares) a queen balloon is about 27 CSS px tall.

- **`fly<Piece>`** (loop, 4 x 120 ms): it bobs a pixel, its string swaying under it. The wiring moves it from the bar to the square.
- **`land<Piece>`** (790 ms, its first look the flight's): it drifts down (90, 90, 80 ms; its string folds and lies on the square, its
  shadow grows), touches down squashed (`thump`, 70), bounces 2 px up stretched (70) and settles (70); a few puffs rise at its foot
  (50), one cloud covers it whole (`poof`, 90: put his real piece on the square at this cue, under the cloud), opens into a ring (80)
  and wisps (70) round the real piece, and is gone.

## The bunch he holds (1d)

Redrawn with the pump's drawings, in his palette's colors: **a red queen, a blue knight, a green rook** in a row above his head and **a
purple pawn** under the rook, by his brow. No king (he never makes one; it was in the bunch before). The bishop is drawn too (yellow),
not in the bunch: the rook's merlons and the knight's head are the two silhouettes least like the others, and with the queen and the
pawn the four are as different as the five pieces allow. Each balloon has a clear gap round its outline (a test: no two outlines touch
or meet), so their shapes don't merge as the old overlapping knight, king and bishop did. The queen, knight and rook are stage 4; the
pawn is stage 3 (7 x 11): a stage-4 pawn under the rook would reach his face, and the wide box (29 px from his feet) and the stage's
70 px top leave no other place. The strings run from each knot behind his head into his fist, as before.

**Nothing else of him changed:** `tiger.test.ts` keeps a SHA-256 of his approved figure (d570e8f) drawn without the balloons and their
strings; it is the same after this change, and a later step that redraws any of his body, face, hat, vest, tail or paw fails it.

## The bar (1e)

Mocks (Puddles' bar, `?barslot=1`, the pump with a stage-4 queen pasted into the slot at its real size, bottom right, 2 px in): at 320,
390 and 428 his slot is 65 px high, and the 30 px pump sits well inside it, clear of the status; at 1280 Puddles' slot is 35 px (his
Seeds row makes the column taller), and it fits.

**The computer's 22 px slot** (a boss with no passive bar, measured on Sawyer's bar at 1280): the pump doesn't fit. At the slot's
right, its top is 8 px above the slot and the queen's crown runs into the status ("60 moves left"). Proposal, for the wiring to
decide: on a computer, place the pump at the slot's **left** end, where the row above is empty (the status is right-aligned and
76 px wide; the slot is 330 to 376 px wide); it then reaches 8 px above the slot inside the bar, covering nothing (mocked:
`bar-mock-1280-22px-proposal.png`). The other ways: give him a passive row (his column grows to Puddles' 35 px), or draw the computer's
pump smaller (a second, smaller set of drawings: not proposed).

## Calls made

- **The color is passed in, not tied to the piece** (above).
- **One drawing per stage, the fake queen the queen's:** identical until the pop by construction.
- **The board balloon is the bar's stage-4 drawing at one frame pixel**, not a bigger redraw: the same balloon all the way, drawn at
  its real size, and the land's puff hides the swap to the real piece whatever its size.
- **Cue names** (sounds to come, no files): `pump`, `squeak`, `pop`, `whoosh`, `thump`, `poof`.
- **The release lifts 5 px** (in the frame), then hands over to the flight, rather than flying out of the prop's frame.

## Review pictures

In the director's scratchpad (`tiger/anim/`): `balloon-stages.png` (5 pieces x 4 stages at 1x and 4x, light and dark; the knight in six
colors at 1x and 2x), `balloon-pop.gif`, `balloon-grow.gif`, `balloon-land.gif` (Classic, Green, Gold at 40 px squares, 3x),
`bunch-before-after.png`, `tiger-lineup.png`, `bar-mock-320.png`, `bar-mock-390.png`, `bar-mock-428.png`, `bar-mock-1280.png`, and
`bar-mock-1280-22px.png` with its `-proposal`.

# Step 2: his animation pack, his own moments, his attack on a king, the hoops

## What changed in the code

- **`packages/app/src/characters/tiger.ts`**: every animation as poses (`TigerPose`, `tigerLayers(pose)`), `TIGER_ANIMS`, `TIGER_HOP_AIR`
  and `TIGER_ATTACK`. New pose numbers: `air` and `dx` (all of him off the ground or across), **`rear`** (degrees: his body turns about his
  hips onto his hind legs, his head, arms, vest and tail going with it; about 65 is standing, as Eric's second picture), `pawF` (his far
  forepaw lifted as an arm) and `holdF` (the strings in it), `bunch` (the whole bunch moved) and `loose` (let go: the strings trail),
  `hoop` (a burning hoop in his paw), `limp` (a limp balloon in it), `bat` (a balloon to bat), and the eyes' new `joy` (shut, smiling).
  The mouth shows as the jaw opens (dark, a pink tongue). The limp and batted balloons are pink by default, their color a `look` of his
  (the pump's six colors, `j l m` keys).
- **Standing up is numbers, not a redraw:** the torso and the vest are the still's own drawings turned about his hips (`turned`: read back
  pixel by pixel, nearest-neighbor, no smoothing), so his stripes run across his upright body and the cream of his chest faces the board.
- **Frame:** 76 x 106 (the still's 76 x 78 with 26 rows of headroom above for the entrance's drop, the hop and the bunch held high when he
  stands, and 2 below for the landing's shake), foot at (36, 100). The still's pixels are where they were relative to his feet;
  `TIGER_STILL_BOX` says where the old frame is in the new one, and the hash test now reads that box (and checks nothing is drawn outside
  it): the same SHA-256 as before, so nothing of the approved figure moved. `TIGER_ATTACK` is 44 px wider on the left (120 x 106).
- **`packages/app/src/characters/effects/tiger.ts`**: `HOOP_RING` (the ring of fire round a 2 x 2 block), `HOOP_FLY` (a hoop in flight) and
  `BALLOON_HIT` (his attack's hit on a king's square). Not registered in `effects.ts`.
- Cue names for the sounds to come (no files): `drop`, `thump`, `yawn`, `swat`, `oof`, `growl`, `squeak`, `flop`, `huff`, `spring`,
  `rustle`, `touch`, `cheer`, `whoop`, `wince`, `flame`, `throw1` to `throw3`, `land`, `bonk`, `pop`; on the board `whoosh`, `thump`,
  `flame`, `puff`.

## His animations

The shared eleven have Smudgy's frame counts, lengths and looping (a test keeps them); ms is where each beat starts. His attitude
throughout: a bored, grumpy circus cat. He yawns where another boss roars (he hated the roaring), watches through half-shut eyes, and
only his balloons make him smile.

| Animation | Frames, ms | Cues (ms in) |
| --- | --- | --- |
| idle (loop) | 16, 2000 | none |
| entrance | 10, 1310 | drop 0, thump 340, yawn 690 |
| thinking (loop) | 16, 2080 | none |
| move | 6, 710 | thump 190, thump 430 |
| capture | 12, 1100 | swat 175 |
| hurt | 7, 720 | oof 0 |
| check | 8, 950 | growl 100, squeak 420 |
| smug (loop) | 8, 1200 | none |
| rattled (loop) | 8, 640 | none |
| defeat | 6, 1550 | oof 0, flop 180 |
| victory (loop) | 12, 1320 | huff 220, thump 880 |
| **hop** | 6, 620 | spring 110, thump 370; **frame 3 (180 to 300) is the airborne pose to hold** (`TIGER_HOP_AIR`) |
| **place** | 7, 820 | rustle 110, **touch 440** (the balloon is on the nozzle) |
| **cheer** (a balloon landed) | 8, 720 | cheer 0 |
| **bigCheer** (a real queen landed) | 11, 1160 | cheer 0, whoop 400 |
| **wince** (a balloon popped) | 7, 780 | wince 0, huff 420 |
| **hoops** (the ultimate's cast) | 13, 1360 | flame 90, **throw1 300, throw2 580, throw3 860**, huff 950, thump 1190 |
| kingAttack (`TIGER_ATTACK`) | 32, 2780 | drop 200, land 360, **bonk 560 and every 170 ms (ten, on `kingAttackHits()`), pop 90 ms after each**, huff 2260, drop 2480 |

- **Idle (2000):** frame 1 is the still. He breathes (a pixel, 625 to 1625); his four balloons bob a pixel each, out of step (the queen from
  250, the pawn sideways from 500, the knight from 750, the rook from 1250); an ear flicks (375, 500); his head dips a pixel (750 to 1250);
  his tail swishes (1000 to 1500); he blinks (1375, 1500).
- **Entrance (1310):** his shadow spreads (0, 100); he drops in, eyes wide, feet tucked, the hat lifting off his head and the balloons
  trailing (200, 270); lands in a crouch with dust, eyes shut, ears flat, the frame shaking (340, `thump`); straightens, eyes half shut
  (470, 580); a huge bored yawn, eyes shut, the jaw wide (690 `yawn`, 850); settles with his half-lidded look (1010).
- **Thinking (2080, loop):** eyes half shut on the board, head down a pixel, an ear turning, the tail tip tapping, the balloons bobbing;
  a blink every fourth beat; in the third round a slow yawn (1040 to 1430) as he sinks a pixel.
- **Move (710):** a crouch (0), a step with the front foot (100), down with a thump and dust (190), a step with the hind feet (300), down
  (430), settle (550). Eyes half shut throughout.
- **Capture (1100):** a crouch (0), his paw drawn back (90), a lazy swat at the board, the balloons jerking on their strings (175, `swat`),
  held (260), back (345), then a pleased little grin with his eyes shut-smiling and his tail swishing (430 to 940), settle (940).
- **Hurt (720):** every color pale, knocked back 2 px, eyes shut, ears flat, the hat jolted up and tipped, the balloons yanked (0, `oof`);
  reels (70, 150, 240); a glare with his ears back and his tail low (330, 440); steadies (560).
- **Check (950):** a crouch (0), a growl he can't be bothered to make a roar: the jaw open, ears back, tail up (100 `growl`, 220); closes
  (320); he shakes his bunch at the board (420 `squeak`, 540, 640); settles (790).
- **Smug (1200, loop):** head back, eyes half shut, a thin grin now and then, the hat tipped further, the tail swishing slowly, a slow blink.
- **Rattled (640, loop):** shaking a pixel either way, eyes wide, ears flat back, the tail up and stiff, the hat bouncing, the balloons
  jittering on their strings.
- **Defeat (1550):** flash and reel (0, `oof`); his paw drops and he lets go of the strings (80); he slumps down onto his belly, head
  down, ears limp, the hat tipping over his eyes (180 `flop`, dust; 290, 410) while his four balloons float up and away; held without
  them (550).
- **Victory (1320, loop):** up on his hind legs, the bunch held high in his raised paw, the old act's pose without the enthusiasm: half-shut
  eyes (0), a little smug grin and the hat tipped (660), a small bounce, his tail swishing, a foot tap (880 `thump`).
- **Hop (620):** a crouch (0), the spring (110, `spring`), in the air, feet tucked, the balloons trailing (180: **hold this frame while the
  hop moves him**), coming down (300), the landing with dust (370, `thump`), settle (470). One animation for both ways: mirror it
  (`flipX`) for the way back if the pump is behind him.
- **Place (820):** his paw goes to his vest (0) and comes out with a limp balloon (110, `rustle`), brings it forward (210), leans in and
  down to the nozzle in front of him (320), **sets it on (440, `touch`: the pump's `put<Piece>` starts here, the balloon now the prop's)**,
  draws back (560), settles (680). The strings stay in the same paw throughout.
- **Cheer (720):** perks up (0, `cheer`), then a small pleased grin with his eyes shut-smiling, the tail up and swishing, a pixel's bounce,
  the balloons bobbing (90 to 540), back to half-lidded (630).
- **Big cheer (1160):** a crouch, eyes wide (0, `cheer`); he half rears up (90) and holds it, grinning wide, the bunch lifted, the hat tipped,
  sparkles round him (180 to 840; `whoop` at 400); down again (950), still pleased (1060).
- **Wince (780):** a flinch, eyes shut, ears flat, the hat jumping (0, `wince`), hunched (80, 180), eyes open half (290), an annoyed lash of
  his tail (420, `huff`), settles (550, 670).
- **Hoops (1360, Alfil's Slam's length):** he rears up (0); standing, the strings moved to his far paw up behind his head, a burning hoop
  in his near paw and a sour look (90, `flame`: the hoop burns as the board's does, tongues of fire licking up and out all round its
  steel ring in the same colors, flickering each frame, held out toward the board clear of his muzzle); winds it back over his head (200); throws (300, `throw1`: **the hoop leaves his paw**; the
  board's `hoopFly` takes it from his paw to its block); the next hoop in his paw (390), back (490), `throw2` (580), the third (670), back
  (770), `throw3` (860); a weary huff with his eyes shut (950); down onto all fours (1100, 1190 `thump`).
- **His attack on a king (2780, the shared beats):** shadow on the ground (0, 100), drops in (200, `drop`), lands with dust (360, `land`),
  a balloon in his paw (470); then **ten times: he swats a balloon at the God King and it bonks on him** (`bonk` on each hit's own time,
  560, 730, ...: the balloon squashed flat against the king's side, drawn in the frame; the board's `balloonHit` on the king's square)
  **and pops there** 90 ms later (`pop`: a white and yellow flash, scraps), as the next balloon comes up in his paw; the colors go round
  red, yellow, blue, green, purple, pink. A bored huff (2260, `huff`), and he hops out of the frame (2380 to 2720, the last frame
  empty). Suggested kit values when wired in: `kingAttack: { ch: TIGER_ATTACK, anim: "kingAttack", perSquare: 36, stand: 1.8, facesLeft:
  true, hit: balloonItem }`, with `balloonItem` as `waterItem` (`name: "balloonHit"`, `hit${i % 2 ? "L" : "H"}${from}`).

## The hoops (board art)

- **`hoopFly`** (square, `fly`, loop, 4 x 70 ms): a small burning hoop turning over; the board moves it on an arc from his paw (at each
  `throwN`) to its block.
- **`hoopRing`** (a strip of its own size: `HOOP_SIZE` = 96 frame pixels, the 2 x 2 block of 64 and `HOOP_MARGIN` 16 round it; place it with
  the block on the four squares): **land** (330 ms, ends on burn's first look): it comes down tilted from above (`whoosh` 0, 70), lands flat
  (`thump` 140) and its flames flare up with sparks (`flame` 220). **burn** (loop, 4 x 110 ms): the crowd's first turn. **dying** (loop,
  4 x 150 ms): its last turn, low orange flames and embers. **out** (400 ms, ends empty): the flames die, the steel goes black with embers
  (0), a puff of smoke rises all the way round (90, `puff`), the ring breaks up in it (190) and the smoke thins away (290).
- **How it reads:** a steel hoop (a rounded square fitted to the block, lit from the top left, dark bands of the old act's tape) sitting
  just outside the block's edge, with tongues of fire licking **outward and up off it, never in**: the four squares inside are clear
  (a test checks every burning and dying frame), so the pieces in them are in full view, and the ring of fire round them reads as nothing
  in or out. The flames reach into the neighboring squares' edges, which is the point (the hoop is in the way). Every pixel of steel
  and fire has the dark outline, so it reads on light and dark squares of Classic, Green and Gold (`hoops-board.png`, at 40 px squares, a
  320 px phone board, at 3x). Three at once, staggered: `hoops.gif` (Classic, a 320 px board at 2x, 300 ms apart).

## Calls made (step 2)

- **He stands only where it helps:** victory, the hoops, and halfway in the big cheer. Everything else is on all fours, as his still.
- **A yawn, not a roar:** his entrance and his thinking yawn; his check is a growl he can't be bothered to finish. His smiles (`joy` eyes, a
  small grin) are for his balloons: the capture, the cheers, the victory.
- **The strings never leave his paw** except in defeat (he lets the bunch go and it floats away) and the hoops (he moves them to his far
  paw so the near one can throw).
- **The attack's sound:** `bonk` on every hit (where the board marks the king's square) and `pop` 90 ms after it on every beat, rather than
  the two alternating, since each balloon both bonks and pops (Eric's "it bonks and pops").
- **The hoop's shape:** a rounded square, not a circle: a circle round two by two squares cuts into the neighbors' middles or the four
  pieces' corners; fitted to the block, the hoop hugs it and keeps every square inside clear.
- **The hop's airborne frame** is a frame of its own (180 to 300 ms) that the wiring holds; the hop is short (620 ms) so it reads as a
  spring, not a flight.

## Not done, or for Eric

- No sounds (cues only), and nothing wired; his name is still open.
- On the phone's boss bar his `wide` box holds the still; the standing poses (victory, the hoops) and the entrance's drop want the bar's
  `tall` box (as Puddles' cheers do), and the hoops are best cast at the board's corner from the full drawing.
- The big cheer is 11 frames (1160 ms), Puddles' 12 (1200): one beat shorter, a grumpy cat's big cheer.

## Review pictures (step 2)

In `tiger/anim/` and `tiger/anim/pack/`: one GIF per animation at 3x on the dark ground (`pack/tiger-<anim>.gif`) and
`pack/tiger-idle-light.gif`; `tiger-sheet.png` (every frame of every animation, with times and cues); the king attack as
`pack/tiger-attack-kingAttack.gif`, `tiger-king-attack-strip.png` and `tiger-king-attack-mock.gif` (a stand-in king 1.8 squares off and
`balloonHit` on his square); `hoops.gif` and `hoops-board.png`.
