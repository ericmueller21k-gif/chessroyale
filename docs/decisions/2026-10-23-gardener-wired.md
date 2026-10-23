# Puddles, the hippo gardener, wired in and playable (Oct 23, 2026)

The wiring lane for **Puddles** (id `gardener`; the name is one constant, `GARDENER_NAME` in core `boss.ts`). His rules:
[2026-10-21-gardener-rules.md](2026-10-21-gardener-rules.md); his art and animations:
[2026-10-20-gardener-still.md](2026-10-20-gardener-still.md) and [2026-10-21-gardener-animations.md](2026-10-21-gardener-animations.md)
(Eric: "hippo is good to go"). He is **live**: his roster line has `kit: "Gardener"`, so his select tile, the random pick, raids, Boss alone and
home's turning card all meet him. The test links `?boss=gardener`, `&power=water` and `&seeds=N` work without `&wip=1`; a new one,
`&seedspeed=N`, runs the page's garden clock N times faster (a seed every 30 / N s), so no test waits for a real 30 s. How it works now:
[docs/areas/bosses.md](../areas/bosses.md) (his row). The director reviews the watering on the board, the meter's clock and the plants'
blocking before this merges.

## What a player sees

| Moment | On screen | Length |
| --- | --- | --- |
| **The opening's five seeds** (as the first crowd turn begins: the `plantMany` event) | his `plantMany` animation where he stands; at its `toss` cue (330 ms) five seeds leave his hand, 80 ms apart, and arc to five squares of the board's middle four ranks (a seeded pick, the same on every device); each plops (`seedPlop`, 425 ms) and nothing stays. His line ("A few seeds to start…" or "Good soil here. Very good soil.") | 800 ms of animation, 5 flights of 620 ms; never holds a move |
| **A seed every 30 s of the garden's clock** | the meter rises by one; his `plant` animation tosses one seed the same way (a soft whiff, no grunt; a soft plip as it lands). His line only now and then (15%) | 740 ms; never holds a move |
| **The seed meter** | by the rage meter in the boss bar: a small seed, "Seeds 7", and a bar filling toward the next seed; full and still at 10; held (dimmed, a dashed edge) while a watering is being placed | |
| **Watering** (his whole turn, as the crowd's turn after it begins) | the dock says "Puddles spent his turn watering."; he steps up to the board's top-left corner and hauls the hose (`tug`); at the `spray` cue (460 ms) the water starts and the sweep crosses the board from its left edge (420 ms, then a wet shine); each seed's square sprouts as the front reaches it; then each outcome from 1340 ms, 250 ms apart, in the rules' order (killer plants, grown pieces with the queen last, plain plants, nothing): a killer plant opens round the piece and snaps shut (the piece fades off at `snap`, 350 ms in, the way a captured piece goes) and gulps; a bud swells and pops (the piece is on at `pop`, 270 ms in, with a pop-in: small, a little too big, its size, over 160 ms; the queen's is golden with a chime); a plain plant unfurls and stays green; nothing wilts | `waterMs`: 1340 ms to the last outcome's end (4080 ms for ten seeds) |
| **His reaction** | `cheer` (a piece grew; "Look at that! A fine crop." or "Grown it myself!"), `bigCheer` (a queen), `shrug` (nothing came up at all) | 720, 1200, 800 ms |
| **A killer plant that ate one of his own pieces** | his line as it gulps ("Not that one! Bad plant!" or "Well… it was hungry.") | |
| **The plain plants** | drawn on their squares while they block: `green` the turn it grew, `toFall` then `fall` the next, `toDrop` then `drop` the third, `gone` (480 ms) as it leaves | |
| **A move onto or through a plant** | refused as Big Boy's block is: nothing moves, the dock says "A plant is in the way." for three seconds, and you pick again; a knight jumps them | |
| **His attack on a king** (the Last Stand, a mate) | he drops in beside the king and sprays it ten times (`GARDENER_ATTACK`, a splash on its square each hit), his own squirts as sounds | 2.78 s |

## The timing check: the art against `waterMs` (nothing needed fixing)

Every length and cue in the rules (`GARDENER_ANIM`, `GARDEN_ART`, `WATER_BEATS`, `waterMs`) was measured against the art by a test
(`gardener-wired.test.ts`) and they are **equal**: the cast 1340 ms with its `spray` cue at 460; the sweep 420; a sprout 300; `kill` 870 (`snap` 350),
`bud` 550 and `budQueen` 630 (`pop` 270), `grow` 290, `wilt` 490, `gone` 480; the reactions 720, 1200 and 800. `waterMs` is the cast, then each
outcome from 1340 ms at 250 ms apart for its art's length: 2210 ms for one killer plant, 2830 for a killer plant, a pawn, two plants and a nothing, 4080
for ten seeds, so the server never moves on before the board has finished. Every sprout is up before the first outcome: the sweep's front
(measured on the sprite: frame i has it at x -24 + 50 i of 256, the lower rows leading by 0.35 px a row) reaches the last square 364 ms in, so the last
sprout starts 824 ms into the moment and holds its seedling from 1124 ms (`sproutsBy` 1180) to 1340. One cosmetic edge: the wet shine (760 ms after the sweep) runs
to 1640 ms, so it is cut 10 ms short after a single plant and 300 ms short in a watering of no seeds, where it fades under the next moment.

## The meter and its clock: one rule

- **The count is the rules' own** (`seedsAt`, `seedFill`, from the view's `garden`: `since`, `base`, `fixed`, `taken`) read on the **garden's clock**
  (`garden-clock.ts`, `gardenNow()`): online the server's (the app's match tells the garden its offset: `Date.now()` and the offset the last message's `now`
  gave, `setGardenSource` in `net.ts`; the solo match clears it), solo and Boss alone the page's visible time (`gardenClock()`, which stands still while
  the page is hidden). I chose a source set by the match over a field on every boss view: the four places `net.ts` makes a boss view stay as they are,
  and the garden is the only reader, the way the hidden rook's registry (`camo.ts`) is.
- **Held while `taken` is set** (a watering's count taken, its placement still to come): the meter shows the count taken and the bar where it stood at
  the moment it was taken (the rules' `seedFill` at `taken.clock`), whatever the clock does; no seed is shown landing only to vanish. A set count
  (`?seeds=N`) shows N with a full bar.
- **The meter redraws itself** four times a second while a seed is on its way (a 250 ms interval; none at the cap or held), and the screens around it
  not at all; on the Boss screen the bar's piece is drawn every frame already, which costs a reading of two numbers.

## The toss: when the screen's own clock sees the count rise

A seed's landing is a moment of the garden's clock, not an event of any turn, so the toss is played by the board's layer (`SeedWatch`, in
`components/Gardener.tsx`), on every screen that draws the board and not during the intro:

- **A timer that waits for the next seed's time** (`setTimeout` to `seedsAt`'s `next`, in real ms: `realMs`, which divides by `?seedspeed` solo): no
  look per frame, and nothing the board is drawn again for. A test (`e2e/gardener.spec.ts`) reads the board's drawing count (`hbDraws`) across a landing
  and its toss: unchanged. The seeds in the air redraw only themselves.
- **A toss only for a landing that came a moment ago** (`freshLanding`: less than 2 s of the garden's clock) and not yet tossed for on this device
  (`hasTossed`, by the landing's key `since:n`). So a screen drawn later, a reload, and a page hidden online (where the server's clock ran on: the
  timer fires late, the landing is old) toss nothing for time they didn't see; solo the clock stood still, so nothing rose. Nothing is tossed while the page
  is hidden. The e2e hides the page (a fake `visibilitychange`) for 9 s of a seed every 7.5 s: no seed counted, no toss, and shown again at most one.
- **His body never cuts another animation off** (`figureBusy`, `BossCharacter.tsx`): the `plant` animation plays in place (`playInPlace`) only when his
  beat's one-shot animation is over, no run in place is under way and no power moment is on screen (`.power-moment:not(.pm-stay)`, the one that hides him
  while the boss casts at the corner). Otherwise only the seed flies, from where his hand is.
- **From where his hand is:** his frame's hand point at the `toss` cue (`HAND`, 23, 54.5: the middle of the seeds in the air in that frame, a test
  measures it) is placed on the screen from where his figure's canvas stands (a phone's bar or a computer's side, whichever shows), in the board's own
  size; a corner of the board stands in where no figure shows. The first seed's first frame is at his hand (the e2e).
- **The squares are only for show** (the middle four ranks, seeded by the toss's key: `tossSquares`). The FAQ says so: "the seeds you see him toss and
  sink in are only for show".
- **One speaker for his tosses' lines:** the watch says them (`pickLine` with the `plantMany` and `plant` chances), and the two moments' `line` is null, so
  a first turn the boss moves on (the crowd Black) never says one twice.

## The board under the watering

`gardenerFen` (the Boss screen, as Smudgy's `smudgyFen`): the position before the watering until each outcome's cue, built from the moment's `growth`
(the killer plant's `ate` letter put back until `snap`; the grown piece taken off until `pop`), over the position the game holds. The board's own
animation does the rest: the eaten piece fades as a captured one does, the grown one appears with a pop-in (`PieceDecor` class `gd-pop`, the board
draws it on the piece's own element for 160 ms). The plant, the bud, the jaws and the sprouts are **one canvas over the pieces** (`BoardEffects`,
`pw-fire-board gd-plants`): the killer plant draws over the piece (one layer; left as the art has it). **The plain plants** are in the same canvas: the
watering's own are drawn by its moment (`grow` into `green`) for as long as the Boss screen has it, and from `garden.plants` after (and on every other
screen): `green`, `fall`, `drop` by `left`; `toFall` and `toDrop` play only for a change this device saw (`plantSeen`, a screen drawn later carries on), a plant
first seen at 2 or 1 just *is* so (a reload shows each in its state, no watering played again: the moments are the turn's events only, and `garden.water` stays
in the view for the rules); `gone` plays once as one leaves the list (`plantLast`, not when the battle is over). A sprout **holds its seedling** until its
outcome's turn: the board art's `gardenPlant` effect has no `loop`, because the board's default for a start animation is to loop into the effect's loop, and
with `green` there every sprout grew into a tree (seen in the frames, not by a test: the first watering's GIF).

## The calls made here, and why

1. **The sweep is not flipped, and his caster is not mirrored.** The animation decision says the board flips the sweep for a hippo on the right; every
   boss's cast stands at the board's top-left corner and he stands on the left, so the sweep comes in from the left edge as drawn (the geometry is
   `garden-sweep.ts`, free of a flip). His water at the nozzle runs to the left, off the board's edge into where the sweep starts: it reads as one stream.
2. **His phone-bar drawing has no spray** (`gardener-bar.ts`, `BossKit.bar`): the still's note says his spray reaches 44 px left of his feet, past the
   `wide` box's 29, and wants `spray: 4` or `0`. The bar's drawing is the same frames with every spray layer left out (a test compares each frame, cue and
   length); the cast at the board's corner and a computer's side keep the spray. He takes the bar's `tall` box (88 px: 28 rows of headroom for the entrance's
   drop and the cheers' hops) and `wide` (28 px left and 25 right of his feet, past the usual 24).
3. **His character's own name is "Gardener"** (it was "The Hippo"): `POWER_MOMENTS` and the prewarm look a kit up by its character's name, as every other
   boss's matches its kit key. No pixel changed.
4. **Beats and kit moments:** `plantMany`, `plant`, `cheer`, `bigCheer`, `shrug` and `ownEaten` join the `Beat` list (his lines and animations by the beat of the same
   meaning, as Moo's `flurry`); the five of them but `ownEaten` are also kit moments (`KitMoment`), so each reaction is its own animation and its own lines.
5. **Lines as the director wrote them, 48 of them** (`gardener-lines.ts`, a test compares each), none says his name. The one for a crowd move a plant refuses ("Keep
   off the grass.") is **not used**: the kit has no such beat, and the brief says not to add one. **Chances** are Moo's, less his moon, flurry and daze, plus
   the opening five, the watering, its reactions and a killer plant's meal always, and the 30 s seed 15%. The longest line, "Welcome to my garden. Stay as
   long as you like. Longer, ideally." (64 characters), and the next ones are in the bubble whole and in view at 320, 360, 390 and 1280 (the e2e); no test caps a
   boss's lines but Alfil's and Chub & Chirp's (42) and Hollow's (44) on their own, and the clown's 28 on his.
6. **The select tile has no blurb in the current grid**, so "A patient gardener. Every 30 seconds he plants a seed, and when he waters, the board grows." is
   not shown anywhere (the tiles are portraits; the stage shows his name, his rating and a line; the grid's redesign comes later). It is here for that.
7. **The rage warning says "After your move: Watering"** (his watering comes at the start of his turn after your move, as Alfil's Slam and Moo's Full
   Moon), not the placeholder's "Next turn: Watering".
8. **The dock's line on the turn he spends watering** is "Puddles spent his turn watering." (from the boss's name, as Smudgy's Repaint says his), so the turn
   with no move of his is never an empty dock.
9. **His strength stays at −250** (the rules' raid sim: `reports/gardener-sim.md`). Big Boy's roster test ("weaker underneath than the others") tied with him at
   −250, as it would with Alfil and Chub & Chirp, who are named in the test as at the same offset; Puddles is named beside them with his reason. (Moo & Moon went
   to −240 for the same tie, the director's call then; 10 points are nothing to Stockfish's floor, but Puddles' offset is what the sim tuned.)
10. **A very soft rustle** (`gardenerRustle`) is the sound of the leaves unfurling, a bud swelling and jaws rising or opening: the shared effects test wants a
    sound for every cue of an effect, and the sprouts (ten at once) are played `quiet`. The sweep's own `spray` cue is the same instant as his, so the board plays
    it quiet too (`BossEffect`'s new `quiet`). The effects test also took the sweep's size: a board effect is eight cells of either size (the first bosses' 24
    px or a square's own 32).
11. **`?seedspeed=N`** (a test switch: admins, local, e2e; `testParams()`) multiplies the page's garden clock, so a test sees a seed land every 30 / N s with no
    real wait. It does not touch the rules or the server.
12. **Test-only pokes in the e2e and the frames script:** the watering with a grown piece in it needs him to have lost material, which the start position doesn't give by
    turn 3, so the board test sets his army short (a position set from the page, as the paint test does) and sets the battle's seed to one whose first watering
    rolls a killer plant, plain plants and a grown piece (`rollSeed` in the test, the same function the rules use). The page's own code is untouched by either.
13. **`net.ts` and `solo.ts` are touched** (the garden's source), which the CI plan counts as shared foundations: the whole e2e suite runs on this PR, not only his area's.
14. **Sounds** (`gardener-sounds.ts`, synthesized; the others' style): a deep friendly grunt and a bigger bellow (a pulse train through two formants, low, warm,
    a little rough: not a snarl), a cheer (two short rising grunts), heavy footstep thumps, an oof and a flop, the toss's quiet whiff, a soft plip for each seed landing,
    the hose's rubbery creak, the spray's hiss starting (`spray` cue), swelling for the sweep (`sweep`) and dying to drips (`stop`), the killer plant's snap and gulp,
    a bud's bright pop, the queen's sparkly chime, the wilt's deflating sigh, his shrug's breath, ten squirts for his attack (a jet and a shorter sputter in turn) and
    his select sound (a happy grunt, then a splash). All under a move's peak and loudness (the #271 rule: peaks 0.10 to 0.26 against a cap of 0.32, means −24 to −35 dB
    against −23.3), the toss and the plip the quietest; mute is respected (everything goes through `play`). Nothing is made when the app loads: his sounds are made ahead
    in the sound worker, as the other bosses'.

## Every player-visible text, exactly

- The meter: `Seeds 7` (the count; its box says `Seeds 7 of 10` to a screen reader).
- The rage warning's second line: `After your move: Watering` (the banner's first line is the usual `RAGE!`).
- The dock on the turn of his watering: `Puddles spent his turn watering.`
- A move onto or through a plant: `A plant is in the way.` (the rules lane's); the boss's only move through one: `His only move: past the plant.` (the rules lane's).
- The Boss alone menu's card: `plants seeds as the clock runs · Watering` (the rules lane's).
- His FAQ block's Seeds bullet now ends its second sentence: "…so there's nothing to spot: the seeds you see him toss and sink in are only for show."
- His tile and stage: `Puddles`, and one of `Mind the flower beds.`, `Good soil here. Very good soil.`, `Everything's coming up roses.`
- His lines (`GARDENER_LINES`, as written):
  entrance: `Mind the flower beds.` / `Big feet, gentle hands. Wipe yours.` / `Welcome to my garden. Stay as long as you like. Longer, ideally.`;
  the opening's five (`plantMany`): `A few seeds to start…` / `Good soil here. Very good soil.`;
  one seed (`plant`, 15%): `Another one.` / `Take your time. They grow either way.` / `Plop.`;
  move: `Slow and steady.` / `One step at a time.` / `Easy does it.` / `Patience.`;
  capture: `Weeded out.` / `Pulled it up by the roots.` / `That one was crowding the bed.`;
  hurt: `My petunias!` / `Hey! I just watered that.` / `Ouch. That'll leave a mark on the lawn.`;
  strike: `Spritz!` / `Little drink for you!`;
  thinking: `Hmm… let it grow.` / `Good things take time.`;
  check: `Check. Feeling the heat?` / `Check. Nowhere to plant your feet.`;
  smug: `Everything's coming up roses.` / `Green thumb. Both of them.`;
  rattled: `Somebody's trampling my garden!` / `This was not in the seed catalog.`;
  the warning: `Clouds are rolling in…` / `Feels like rain.`;
  the watering (`ultimate`): `Watering time!` / `Let's see what comes up!` / `Drink up, little ones!`;
  a piece grew (`cheer`): `Look at that! A fine crop.` / `Grown it myself!`;
  a queen grew (`bigCheer`): `A queen! Prize of the county fair!` / `Now that's what I call a harvest!`;
  nothing came up (`shrug`): `Hm. Dry year.` / `Next season.`;
  a killer plant ate his own piece (`ownEaten`): `Not that one! Bad plant!` / `Well… it was hungry.`;
  victory: `Another fine harvest.` / `Everything in its season.`;
  defeat: `Trampled… my whole garden…` / `I'll replant. I always do.`;
  his attack on a king: `Hold still, your majesty. You look thirsty.` / `Spritz! Spritz! Spritz!` / `A royal soaking!`.

## Tests

Unit: `packages/app/test/gardener-wired.test.ts` (listed in the area page), the art's `gardener.test.ts` and `gardener-art.test.ts`, the roster, kit, king-attack
(the face direction and the 64 squares), the effects' and FAQ tests with him added, and the lists that count the bosses (the roster, the lobby's pick, Big
Boy's). E2E: `e2e/gardener.spec.ts` (nine: the rules' watering; the opening toss; a seed landing on `?seedspeed` and a hidden page; the watering on the board
frame by frame; online with a reload; the bar at 320, 360, 390 and 1280; his king attack; his long lines), `king-attack.spec.ts`, `boss-select.spec.ts`
(his tile and stage, fourteen tiles, the layout), `boss-smoke.spec.ts` (his passive and his ultimate fire within its time: the opening toss at the start, the
admins' trigger for the watering), `formats.spec.ts`, `home-ranked.spec.ts`. Frame by frame: `node scripts/frames-gardener.mjs <dir> [stage] [phone|desktop]`.

Not tested: a real phone (Eric's).
