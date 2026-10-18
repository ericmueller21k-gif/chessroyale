# Chub & Chirp wired into the game, and live (Oct 18, 2026)

**Eric (Oct 18):** "make them LIVE". So Chub & Chirp are a normal boss now: their roster line has its kit
(`kit: "Chub & Chirp"`), which makes them playable (`isPlayable`): their tile on the Boss raid screen, the random pick,
raids and lobbies, Boss alone's menu, and home's turning card. The spec is Eric's boss sheet (every rule approved); the
rules: [2026-10-18-hopper-leapfrog.md](2026-10-18-hopper-leapfrog.md), [2026-10-18-carrot-patch.md](2026-10-18-carrot-patch.md);
the art ("gifs are perfect"): [2026-10-18-hopper-still.md](2026-10-18-hopper-still.md),
[2026-10-18-hopper-animations.md](2026-10-18-hopper-animations.md). How it works: [docs/areas/bosses.md](../areas/bosses.md)
(their row). The model was Alfil's wiring ([2026-10-17-alfil-wired.md](2026-10-17-alfil-wired.md)).

## What was built

- **Their kit** (`characters/kits.ts`): every moment on their animations (their own entrance, move, capture, hurt,
  check, smug, rattled, defeat, victory; `strike` their capture; Leapfrog `leapfrog`; the warning their `check` chirp; the
  Carrot Patch `carrotPatch`; the spin `raceWon` or `raceLost`); the portrait (both heads); the phone bar's wider box
  (`wide`: below); their attack on a king (`HOPPER_ATTACK`, `facesLeft`, `perSquare` 36, `stand` 1.8, a carrot bonk on
  the king's square each hit: `carrotHit`, `carrotItem`). They're in `CHARACTERS` (the character tests cover them) and
  in `KING_ATTACKERS` (the server waits for the attack at a mate; the face-direction and 64-square tests cover them:
  Chub's eye in the rabbit's head, `FACES`' new `head`).
- **Their moments on the board** (`components/Hopper.tsx`), timed by **`HOPPER_BEATS`** (`packages/chess/src/bosses/hopper.ts`),
  each beat a cue of their animation (a unit test checks every one):

| Moment | Beats (ms into it) | What you see |
| --- | --- | --- |
| Leapfrog (its own screen, before his move) | banner to `liftAt` 720; `overAt` 885, `landAt` 1050; 1600 (unchanged) | "LEAPFROG!" ("Over your pawn on e4"); Chirp crouches and hops at the board's corner; his pawn stays on its square until the `takeoff`, arcs over yours and lands beyond it on the `land` |
| The cast (his whole turn; as your turn begins) | banner to the first toss 1100; `castAt` 900, tosses 1100 to 1940 (210 apart), each carrot 300 in flight; the ladder 2400 to 4900 (was 2800 in all) | "CARROT PATCH!" ("5 carrots, 12 moves each"); five bounds, a carrot tossed each, tumbling from Chub's paw to its square, thunking into the soil; then his ladder for 2.5 s |
| A pull (his: as your turn begins; yours: as your move lands, while he thinks) | the pop at 0, the token from 60 (the art's second frame); 600 | it pops out of the soil, wobbles, goes in a sparkle; the puller's token (a disc of its color with a carrot) in the square's corner by the dug hole |
| His spin (the race over; as your turn begins after his move) | the race won or lost 0 to 1000; the reel 1000 to 4000 (3 s); the prize drops from 4200, 160 apart, 450 each; 5000 (was 4400) | `raceWon` (a carrot held up) or `raceLost` (ears droop) at the corner; a row of prize cards slides past the gold line in the board's middle and stops on what he rolled (the card glows gold); the prize pieces drop onto their squares (a soft land each); the board shows them only once down |
| His fifth carrot (no spin) | `cheerAt` 300; 2500 (unchanged) | "FIVE CARROTS!" ("Chub & Chirp win the battle"), his cheer, then the result (when it also mates, his attack on your king first: below) |

- **The board under them** (`hopperFen`, Boss.tsx): on the hop's screen his pawn is on its own square until it takes
  off and on the square beyond once it has landed (the moment draws it in the air between); on the spin's screen each
  prize piece shows once it has dropped. The board doesn't animate those changes. The hop's screen is treated as Big Boy's
  bounce (his last move isn't news: no ring, no God King's word, no blunder check).
- **The carrots on the board** (`carrotItems`, one canvas under the pieces, the art's `carrotPatch`): none until its
  flight lands in the cast, then planted (leaves swaying, each a little out of step), popping out as its pull plays, the
  token after. A pull with no moment on this screen (an older one, or yours seen on another screen) is simply claimed.
- **The dock's count** (`RaceBadge`, on every boss screen while the race is on, through the turn of his spin): the
  pixel carrot, his count on a disc of his color and yours on yours (as the tokens), and your moves left ("7 left",
  "over"); its label reads it out ("Carrots: Chub & Chirp 2, you 1. 7 moves left."). On a computer (or with the God
  King beside the row) at the status box's left; on a phone at the left of the God King's line under the row.
- **The ladder and the reel read the settings** (`carrot-race.ts`): the ladder's words from `carrotOdds` (one prize,
  its name; one kind of piece, "a pawn or two"; else "up to" the best), the FAQ's odds and averages too.
- **The reel** (Eric: "just an overlay in the center of the board like a shuffler, nothing super fancy, just clean"):
  a window across the board's middle (dark in both themes, gold edge, a gold line with a notch top and bottom), one row
  of prize cards: the cburnett pieces in his color, "×2" for two of a kind, the queen and rook on a gold jackpot card,
  blank cards for nothing. 20 cards a strip; it travels one full turn of the strip plus the way to its card, slowing
  (an ease-out cubic) to a stop at 3 s. Light: the cards are made once a spin; each frame moves the row with one CSS
  transform; a tick as each card passes the line (at most one every 45 ms), a stop sound.
- **Honest** (the sheet): the strip has each prize exactly as often as its odds for his count (largest remainders when
  the odds don't divide 20), spread out evenly (a smooth weighted round robin), the same strip whatever was rolled; the
  card it stops on is one of the rolled prize's, picked by the moment's key alone (so every screen shows the same spin),
  never by what's next to it: no rigged near-misses. No carrots: every card blank; four: every card two queens.
- **Sounds** (`characters/hopper-sounds.ts`, synthesized like the others', made ahead in the sound worker, through the
  mute switch, each under a move's peak and loudness, the attack's ten hits together too): chirp, thump, squeak, oof,
  flop, cheer, sigh, toss, bonk, hop, land; `thunk` (a carrot planted), `pop` (pulled), `tick` and `stop` (the reel).
  Cues: the art's names; `takeoff` the hop, `toss<n>` the toss, `plant<n>` the thunk. Their select sound: the chirp.
- **Lines** (`HOPPER_LINES`): all 60 of the draft's `CHC-*` lines as written (no flags from Eric yet), at most 42
  characters each; the three select lines in `SELECT_LINES`. The race's own keys, new `Beat`s: `carrotHis` and
  `carrotYours` on each pull, `spinBig` (3 or 4), `spinSmall` (1 or 2), `spinEmpty` (0) as the reel starts, `carrotsAll`
  on his fifth. `power` is Leapfrog's (as the hop begins), `ultimateWarn` and `ultimate` the cast's.
- **The FAQ:** their block (Leapfrog's rule; the Carrot Patch with its ladder as a table: each count's prizes and odds
  and the average in pawns, every number from `BOSS_POWERS`), the RAGE! line (their cast comes at the start of their turn,
  as Hollow's, Big Boy's and Alfil's) and the once-a-battle note.
- **The select screen:** eleven tiles, six to a row on a phone and a computer (a row of six and one of five; the gap
  4 px on a phone so a tile stays over 44 px at 320). Eleven in one row were 39.6 px wide in a computer's column, under
  the 44 px a tap needs. They're drawn full size on the stage (70 px tall).

## My calls

- **Retimed the beats to the art, not the art to the beats** (the brief's choice): the art is approved as is. Leapfrog:
  a banner first (every boss's passive opens with one), so his animation starts at 510 and its `takeoff` (210) is the
  lift at 720, its `land` (540) the landing at 1050; the moment stays 1.6 s (his animation ends at 1590). The cast and
  the spin grew (2.8 to 4.9 s; 4.4 to 5 s) for the banner, the art's 1.47 s cast, the 2.5 s ladder, the 1 s race beat and
  the 3 s reel: each once a battle. `POWER_FX` reads them, so the server waits for them.
- **Tier 2's beat:** `raceWon` when he pulled at least as many as you (his 2 against your 0, 1 or 2), else `raceLost`:
  the animations say who won the race, and with 2 he can have won it or lost it.
- **The reel stops on what he rolled** (`spin.rolled`). In the rare case the prize stepped down (the engines can't take
  it), a line under the reel says so ("No room for two pawns: a pawn") and the pieces that drop are the ones he got.
- **The planting's thunk is the cast's cue** (`plant<n>`): the board's planting is drawn `quiet`, so one sound plays,
  not two (the board's carrot keeps its `pop`).
- **Your pull plays on his thinking screen** (`yourPulls`: the pull in the state, from when this device first saw it, as
  Alfil's early landing), with his `carrotYours` line; his plays as your turn begins after his move (the rules' moment).
  His hop landing on a carrot pops it at the hop's landing.
- **The ladder's words:** "What their carrots win", then 0 to 5 with the pixel carrot ("they win" for five: they're a
  pair, as the dock's and the results' lines already say). The pixel font has no arrow, so no "→".
- **The warning says when:** "After your move: Carrot Patch" (was "Next turn: Carrot Patch"), as Alfil's Slam: the cast
  comes at the start of his turn.
- **The `wide` box after all** (the still lane thought it unneeded; the brief said check): measured on a phone's bar at
  320, 360 and 390 px, in the usual 48 px box his canvas started 2 px off the screen's left and, at rest, his scarf and
  wing tip came within 1 to 2 px of his name (74 px), over it in his entrance, move, hurt and victory (3 px wider). In the
  58 px box: drawn from 11 to 78 px at rest, the name at 84. As Sawyer's, Wrangler's and Alfil's. The e2e measures it.
- **Select lines are the draft's** (`CHC-select`), not lines from his kit as for the others: they had none before.
- **A test switch for a given count** (`?carrots=N`, solo, with `?power=carrotpatch`; `bossCarrotTest`,
  `carrotsWithinReach` in the rules): N carrots each a step from one of his pieces and out of your reach, the rest a step
  from yours and out of his, and his race brain takes a carrot whenever a move of his pulls one (`BossRace.eager`; with
  the normal brain he left some, weighing them against his chess). The fifth carrot comes in about 3% of real races,
  so without it neither the e2e nor the previews could reach his win (`?carrots=5`), an empty spin (`?carrots=0`) or a
  big one (`?carrots=3`) on demand. Test-only: the normal placement and brain are untouched.
- **Where the dock's count sits:** in the status box it squeezed the words to 45 px at 320 ("Your move." on two lines,
  the cast's line cut), so on a phone it sits at the left of the God King's line under the row, a box of its own laid
  over that line (no new row: a new row would shrink the board for the race, .claude/LESSONS.md, "A board that shrank
  as the boss fell"); a computer's status box has the room, so there it's at the box's left.

- **His fifth carrot that also mates: the pull and his win, then his attack, then the result** (the director's call
  after #275 merged). #275 plays the fifth's moments when the same move mates (`preparePowers`), and with them in
  `KING_ATTACKERS` a mate held the screen for the attack alone and dropped every moment. Now `bossTurnShowMs` holds
  his move, the moments (`mateMoments`: only when `carrotWin` is among the turn's events; any other mate keeps no
  moments, as before), then the attack's whole hold (`mateHoldMs`), and the boss screen ends the moments as that hold
  begins (`mateMomentsOf`), so the attack's start (`until - mateHoldMs + mateAt`) is the same formula as for every mate.
  The order reads as it happens: the carrot is pulled by the mating move, so it pops first; "FIVE CARROTS!" says why the
  battle is over; the attack is the finish; the result keeps the mate's line. One hold on the server and in solo (both
  read `bossTurnShowMs`): 4.9 s plus 3.88 s, then one results message. The other order (the attack, then the moments)
  would play a cheer over a king already gone, and need a second timer.
- **The spin's line as the reel starts** (was: as it stops). His pull just before the spin ("Pulled one!") was still up
  while the reel spun, and the spin's line waited behind it. The spin's line (`spinBig`, `spinSmall`, `spinEmpty`) now
  comes at `reelAt` and cuts in (`CRITICAL`). It reads his count, known already, never the prize, so it gives nothing
  away.

## Tests

Unit: `packages/app/test/hopper.test.ts` (rewritten: live, the kit, the 60 lines and their caps, the sounds' levels,
the select screen, the FAQ block, every beat against its cue, the moments and their lines (the spin's cutting in over the pull's as the reel starts), a mating fifth's moments before the attack, your pull, the board under the
moments, the carrots on the board), `carrot-race.test.ts` (new: the ladder's words, the reel's strip at its odds, blank
and two-queens strips, spread out, the stop on the rolled prize, no near-miss bias over 2,000 spins), `hopper-art.test.ts`
(the art lane's, kept), `king-attack.test.ts` (him in the list, his assault, his face toward the king, 64 squares),
`boss-kits.test.ts`, `boss-select.test.ts`, `packages/core/test/boss.test.ts`, `packages/chess/test/hopper.test.ts`
(live), `king-attack.test.ts` (a mating fifth's hold; no new turn's powers after a game-ending move), `carrots.test.ts` (a mating fifth's hold; a mate or stalemate on his 3rd or 4th carrot plays nothing), `bigboy.test.ts`, the lobby's `boss-powers-lobby.test.ts` (a mating fifth online: the moments, the attack, one results message). E2E: `e2e/hopper.spec.ts`
(rewritten: the hop's pawn frame by frame, the cast through planting with its ladder, the dock's count, pulls, the reel
stopping on the rolled prize and the prize on the board, the fifth carrot's path; his tile, stage and figure at 320 px
and 1280 px), the tile counts in `boss-select.spec.ts`, `formats.spec.ts`, `home-ranked.spec.ts`. Frame by frame:
`npm run frames:hopper`.
