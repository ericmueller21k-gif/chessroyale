# The circus tiger: his balloons and the pump (step 1 of his animations, Oct 23, 2026)

Lane: `characters`. Area page: [bosses.md](../areas/bosses.md). After his still ([2026-10-23-tiger-still.md](2026-10-23-tiger-still.md))
and the bar's free room ([2026-10-23-boss-bar.md](2026-10-23-boss-bar.md)). Look only: nothing in the game draws any of it yet; the
rules and the wiring come later. Step 2 (his animation pack and the burning hoops) will add to this file.

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
