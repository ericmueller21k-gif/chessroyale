# The town square: ten bots out, one goes home each minute (Oct 28, 2026)

Phone and computer. Builds on the sidekicks in town (`2026-10-28-sidekicks-in-town.md`), which kept six of the twenty
bots out at once and swapped one every 10 to 20 s, fading out and in where they stood.

## Eric's words (Oct 28)

> "no lag so I'd say drop in all little guys but do it like this, they work on 1 minute timer, 10 out at a time, randomly
> one each minute starts to head home, is replaced by another and then that same one can't be replaced again until all
> the others have been if that makes sense, even cooler is they walk and fade into their respective house and then the
> new one walks out from their home. They all walk near the town square area and persist there until the trigger tells
> them it's time to leave, for issues like being interrupted because they are in a match, simply check their status and
> pass them for that round and recheck later"

## The rules

- **Ten out** (`botsOut` 10 in `town/feel.ts`): ten of the twenty in the world, ten at home (not drawn, not tapped, on
  no square).
- **One change a minute** (`botTurnMs` 60 000, one fixed number): a timer checked in the town's tick (`takeTurns`), not
  per-frame work.
- **Who goes**: at random among the bots out still **due** this round. A round starts with every bot out; each goes home
  once; the bots that come out meanwhile aren't due until the next round. So no bot is sent home twice before all the
  others have gone once (Eric's "that same one can't be replaced again until all the others have been").
- **Busy bots are passed over** (`canGoHome`): seated (in a game, at a table, or across from you after one), held (its
  card or its table's card open), on its way to or from a game with you (`meet`, `leave`), within `botTurnAway` (5)
  steps of you, or out less than `botOutAtLeastMs` (90 s). Another free bot due goes that minute; none free, the minute
  is skipped and the next one tries again. A passed-over bot stays due. A bot is never sent home mid-game.
- **Who comes**: the one home longest (`homeQueue`, first in, first out), so all twenty come round; never the one that
  just went home.
- **Going home**: the bot walks to its door the town's own way round (on walkable squares, round anyone standing) and fades
  out there over `botFadeMs` (0.5 s); then it's home. A sidekick's door is its boss's home's; a pawn has no house, so it
  goes to the Colosseum's gate. **Coming out** is the same the other way: it fades in at its own door and walks to the
  square. The walk takes as long as it takes (the far homes a while).
- **Ten in the world all along**: the next comes out the moment the other gets home, so the one walking home and the one
  walking out both count toward the ten.
- **Tapping one on its way**: it holds while its card is open, as any bot does, and carries on when the card closes.
  Play keeps it out for the game.
- **Where they stay**: the bots out wander only in the square (`inSquare`: the park with its tables, the walk and the
  Colosseum's apron, as wide as the park, off the bosses' roaming ground). One that ends up elsewhere (a test hook calls
  it to you) walks back.

## Calls

- **Who comes: the one home longest** (the brief's call, kept): all twenty come round in turn, and it can't be the one
  that just left (that one is last in the queue).
- **A pawn's home is the Colosseum's gate** (the brief's call, kept): it fades out on the apron's free square nearest the
  gate, and comes out there. (Stepping into the gate itself would put it behind the Colosseum's picture, which is drawn
  over everything north of its front edge: it would vanish rather than fade.)
- **A sidekick's door** is the middle of its boss's home's front: the plot's front row in its middle column, where the
  bosses start in front of it. The homes' doorways are drawn near their middles; the game never had door positions, and
  a fixed rule needs none (Folio's house moving, Oct 28, changed nothing here). The kid walks to the square in front and
  steps onto the doorway as it fades. When its boss stands on that square, it takes the plot's front square either side
  (`doorway`), so two never share a square.
- **When the next comes out: as the other gets home**, not as it sets off ("and then the new one walks out from their
  home"; the brief's "both count toward the ten" holds either way). Ten in the world at every moment.
- **A round's last bot doesn't turn straight back.** In rounds, the bot that came out at the last minute of one round is
  due at the next round's first minute; picked then it would walk out and straight home. So a bot out less than 90 s
  (`botOutAtLeastMs`) is passed over like a busy one: within a round it changes nothing (a newcomer isn't due anyway).
- **Seated is busy** (the brief): a bot due that sits down at a table waits its turn there, so some minutes pass with
  nobody sent (in the unit test's hour, about 40 changes in 62 minutes). The rotation then runs a little slower than one
  a minute, never faster.
- **Walking through the bosses' grounds**: a bot going home crosses its boss's roaming ground and may pass through the
  boss for a step, as people do when walking (where they stop is what's kept apart).
- **Who's at home as the town opens**: as before, a shuffle by the town's seed (the same each time; back from a game, the
  bot you played is out). The home queue starts in the shuffle's order.
- **The test hook** `__townTurns(ms)` (turns every `ms`, the next one now) speeds the minute for the e2e test and the
  GIFs; `__townBots()` also tells whether a bot is going home, where it's headed, whether it's fading out or in, its door,
  whether it stands in the square, and its place in the queue.

## Tests

- `packages/app/test/town-bots.test.ts`, "the bots take turns" (new): ten out and ten in the world all along, the ones
  out standing in the square; one change a minute, only on the minute; the rounds (every bot out once before any twice,
  never within 90 s of coming out); busy bots passed and still due, the held one next once free, and each kind of busy;
  the one home longest next, as the other gets home, never the same; a sidekick to its boss's door and a pawn to the
  gate, fading out there over `botFadeMs`, the next fading in at its own door and walking to the square, every sidekick's
  door reachable; a bot going home held by its card and carrying on, one you play staying, never sent while seated across
  from you.
- `e2e/town.spec.ts` (phone and desktop, new): with the hook, one bot walks home and fades out at its door and is gone;
  the one home longest fades in at its own door, ten in the world all along, and walks to the square.
- **Test checks changed** (none guards a rule in `docs/rules/eric.md`):
  - `town-bots.test.ts`, "botsOut are out at once, the others at home (on no square); now and then one goes home and
    another comes out" → replaced by the turns tests above: "six out, at most one extra while one fades, every bot out
    within two hours, a held bot never goes" → "ten out exactly, ten in the world, the rounds, the queue, the doors"; the
    held bot's check → "busy bots are passed over… the held one next once free". Its "every bot out over two hours" is
    the rounds and the queue now (all twenty come round in turn).
  - `town-world.test.ts`, "bots sit at the tables now and then, a stool each": its "nobody shares a square" check skips a
    bot walking home or out while it walks (`tripping`): such a bot crosses the bosses' grounds and may pass through a
    boss for a step, as people do; where it stops is still kept apart. The check is unchanged for everyone else.

## Many figures: the name tags drawn once, and the testers' crowd (the director, Oct 28)

Eric plans for about 50 real players in the town, drawn as the bots are. So each figure's cost was traced and cut, without
changing a pixel or drawing fewer.

- **Where a frame's time goes** (a Performance trace and builds that left one thing out each; phone, 50 extra figures):
  the main thread spends about 24 ms a frame, of which about 19 ms is the canvas's drawing itself (rasterized at the
  frame's commit, in software headless) and about 4 ms our JavaScript. Of the drawing, the ground is the most (about 10
  ms: without it, 13.6 ms a frame); the figures came next, and in a figure the costliest part was its **name tag**: a
  rounded pill drawn every frame with `shadowBlur = 4`, and its name with `fillText`. The tags cost about 3.8 ms a frame
  at 50 figures (the commit 23.0 → 19.1 ms with them stamped).
- **The tags, drawn once** (`tagArtOf`, `drawTag`): each name, size and color is drawn once into a small canvas at the
  device's pixels, its shadow included, and stamped with `drawImage` each frame, its alpha by `globalAlpha`; about 64
  kept, the least lately used making way (never one drawn this frame or the last). A tag fading (the far edge, a bot
  fading at its door, the statue's close-up) stamps its shadow, its pill and its name one over the other, each at the
  alpha, because one stamp of the whole tag at that alpha shows less of the pill through the name than the old drawing
  did (up to 47 levels of 255 apart). Compared pixel for pixel with the old drawing in the browser (DPR 1, 2, 2.625 and 3,
  white and gold, alpha 1, 0.6 and 0.25): no channel differs by more than 3 levels of 255 (the canvases' rounding). Each
  tag lands on the device's pixel grid (it moved by under half a device pixel: a sixth of a CSS pixel on a 3x phone).
  Stills of the whole town with 20 figures, before and after, look the same.
  - **A tag drawn before its font came** would have kept the fallback font for good (the stills caught it: a heavier,
    wider face). Each tag remembers how many web-font loads had finished when it was drawn (`loadingdone`) and is drawn
    again once more have. (Main measures a tag's width once too, so a tag first measured before Archivo loaded keeps a
    pill too wide for its name; the branch's is measured in its font. Only in that first moment's race.)
- **The far-to-near sort** is an insertion sort in place (`sortFarFirst`): stable like `Array.prototype.sort` (the same
  order), nothing allocated, and a pass or so, the list being nearly in order from the last frame.
- **Checked and left**: a figure's two shadows (two ellipse fills): drawn once and stamped instead, they measured no
  faster (48.2 against 48.7 fps) and their sizes would snap to half pixels, so they stay as they were. Off-screen
  figures: `drawThings` works out each one's place (needed to sort) and asks `drawable` (behind the camera or the rim,
  past either side, below the box) before any drawing; its tag is only for one drawn and near. Per-frame allocations:
  none in the figures' path (the tags list reuses its entries, the sort sorts in place). Keeping people one a square
  (`keepApart`) compares every pair, but 75 walkers take 24 µs a tick (125: 62 µs), so it stays. Text is measured once
  per tag drawing.
- **The testers' crowd, `?crowd=N`** (N up to 100; `addCrowd` in `world.ts`): N more pawns with names ("Guest 1"…)
  wandering the square, for measuring and for Eric to try on his phone. A test switch: it counts only where
  `testSwitchesAllowed()` is true, so on hunchess.com for an admin (ADMIN_EMAILS) once the account has loaded:
  `https://hunchess.com/town?crowd=50` shows 50 a moment after the page opens. Never for players. They're not bots: no
  card, no turns, no tables.

### Frame rates (eric.md's method)

Headless Chromium, a phone 390 × 844 (pixel ratio 3) and a computer 1440 × 900, the town's default view by day, 5 s walking
(a tap ahead every 1.25 s), frames counted in the page, medians of 4 runs taken in turn, main twice (the noise control).
Main is origin/main at #398; for the crowd rows, main with only the crowd switch copied in (`addCrowd` and its reading),
so the figures are the same and only the drawing differs. Main has six bots out, this branch ten.

| fps (main thread ms a frame) | phone | computer |
|---|---|---|
| main, 6 out (twice) | 53.0 (18.3), 53.7 (18.2) | 42.0 (23.9), 41.6 (24.1) |
| **this branch, 10 out** | **52.5** (18.6) | **46.3** (21.6) |
| the phone again, 8 runs each: main twice / this branch | 53.5, 53.9 / **54.7** (17.8 against 18.3, 18.1) | |
| main again (twice) / **this branch, 10 out, one walking home in view** (`__townTurns`: a turn at once) | 51.3, 52.8 / **52.9** (18.5) | 40.4, 38.7 / **43.7** (22.9) |
| main, 20 more (twice) | 51.0 (19.6), 51.8 (19.3) | 39.0 (25.7), 40.1 (25.0) |
| **this branch, 20 more** | **52.4** (18.8) | **43.9** (22.9) |
| main, 50 more (twice) | 44.6 (22.5), 43.4 (23.1) | 37.7 (26.6), 38.4 (26.1) |
| **this branch, 50 more** | **51.0** (19.6) | **42.4** (23.7) |

So: on a computer this branch is faster than main in every case (4 to 5 fps). On a phone, with 20 and 50 more it's
faster (1 and 7 fps); with ten out and no crowd, the first round read 0.5 to 1.2 fps under main's two medians (inside
the 0.7 between main's own two, and run for run the four pairs differed by 0.3 to 1.2), and a second round of 8 read 0.8
to 1.2 above them: level with main, within this machine's noise. Ten figures (four more than main's six, all of them now
in the square, so on screen) cost about what the tags drawn once saved.

## Two bugs from Eric's iPhone (Oct 28)

### The park's boards warped while the camera moved

Eric: "the chessboard is all wonky on the screen… I was below it on the map, and then I used my finger to drag up… for a
few frames… those chessboards get all like weird", and then: "It happens when I run too… it doesn't matter if you drag
with your finger or if your character forces the screen to move". In his screenshot two tables' boards near the bottom
of the screen are drawn several times the table's size, skewed, their pieces stretched.

- **Reproduced** headless on a phone: south of the park, a touch drag in steps of 10 px with a still frame after each, and
  a walk north with the camera following. The old build drew the warped boards in both (frames saved with this PR's
  report: `bug1-*.png`); a log of the boards' corners showed them projected up to 1400 px from their tables.
- **Cause**: a table's top is placed by lifting the board, in the camera's true perspective, to the height of the table's
  picture, worked out as the picture's pixels over the screen pixels a unit of lift moves the point there (`a.y - b.y` at
  a lift of 1). Low on the phone's screen (its camera pitched 42°, the ground there nearly under it), lifting a point
  brings it toward the camera more than up the screen: that divisor falls from about 28 px to 8 and less, the lift grows
  without bound, and the board with it (1.5 to 2.5 times its foot's scale and more, 75 to 285 px sideways); past it,
  `proj` fails. The picture is a cut-out, the same shape anywhere, so the two part ways. It showed only while a table was
  in that band of the screen, the few frames a moving camera keeps it there, by drag or by walking. The computer's camera
  never gets there (1.10 at most).
- **Fix** (`tableLift` in `camera.ts`): where the board would be drawn more than `tableBoardGrow` (1.2, in `feel.ts`) times
  its foot's scale, it's worked out at the nearest place an eighth of a square farther off where it fits, and drawn from
  there at the picture's own place and scale (one transform; its cached picture likewise). Everywhere else nothing
  changes: the same numbers, so the same pixels (over the screen's usual rows the board is drawn 1.04 to 1.17 times its
  foot's scale). Test: `town-camera.test.ts`, every on-screen row at three zooms, phone and computer.

### Lag south of the park

Eric: "below the park, it's actually really laggy there… when you're kind of moving the map around and even running
around… when you run up into where the park is in the Colosseum, suddenly the frames pick back up… it happens every time."

- **Measured** (phone, the camera at square 22,6 as in his screenshot, or walked there; against the camera in the park;
  `__townGlide([c, r])`, a test hook, puts the camera on a square): main 39 fps south against 50 to 53 in the park.
- **Cause** (left-one-out builds, then a build that counted): things in the far band (the far Colosseum, the homes, the
  park's trees, tables and lamps seen from afar) are softened through a scratch canvas (`blitSoft`): drawn into it,
  hazed, then drawn from it onto the world. It was one canvas for all, kept at the size of the biggest picture it ever held
  (the far Colosseum's), cleared whole for each thing and, rewritten while the world's canvas still held the last picture
  drawn from it, copied whole. South of the park the whole park and the Colosseum lie in the far band: about 15 softened
  things a frame, 3.3 million device pixels cleared a frame against 0.04 million drawn. In the park: one. With
  `blitSoft` left out, the south spot drew as fast as the park.
- **Fix**: a scratch canvas for each thing softened in a frame, in turn, each cleared only where it's used and two pixels
  round it (the scaled draws sample one past their edges). The same pixels: 40 softened pictures drawn both ways over
  scratch canvases full of stale red, at DPR 1, 2.625 and 3: no channel value differs.
- **Frame rates** (phone, medians; the branch is this whole PR):

| fps (ms a frame) | south of the park | the park |
|---|---|---|
| main, panning (4 runs; twice south) | 39.3 (25.5), 37.8 (26.5) | 52.7 (19.0) |
| **this branch, panning** | **54.8** (18.2) | **55.4** (18.0) |
| main, walking (8 runs) | 40.4 (24.7) | 49.2 (20.3) |
| **this branch, walking** | **52.6** (19.0) | **53.3** (18.6) |

South of the park is now level with the park (0.6 and 0.7 fps under its medians, run for run either side of it), 14 to
16 fps above main there, and the park itself is no slower than main's.
