# The God King's Last Stand sits out on a board a boss has changed

Oct 24, 2026. Lane: god-king (targeted: the Last Stand's rule, in the runner).

## Why

Eric (Oct 24): "disable the king save during any time a boss board has [anything] on it, example I had a queen and his
pawn in the fire circle and it undid my capture thinking his pawn could capture it next turn but the rules wouldn't let
it. We want players to enjoy the mini things we add not get punished for using them. But I love the god king blunder
save so we just need to avoid it triggering when the board is all funky."

The Last Stand judges the crowd's move by the judge's numbers, and the numbers after the move are plain chess's: the
engine searching the position after it doesn't know the boss's rules (a hoop's walls, a toy block, a frozen piece, a
dark square). Inside Babur's hoop it feared his pawn's recapture, which the walls forbid, and took a good capture back.

## What

- **Where the save lives:** `MatchRunner.lastStandFor` in `packages/chess/src/runner.ts` (called from `resolveBoard`,
  the same for solo and online: the lobby server calls the same runner), on the bar in `packages/core/src/boss.ts`
  (`lastStandBar`, `lastStandDue`). The screens only play what the runner decided (`LastStand.tsx`, the dock).
- **The gate:** `boardAltered(boss, fen)` in `packages/chess/src/boss-powers.ts`, one rule for every boss, no list. The
  board counts as changed when, on the crowd's turn:
  1. a power touches the turn (`BossRules.powerTurn`: fair play's own test, which every boss with a board power keeps);
  2. something stops his moves (`bossStops` isn't null);
  3. something stops any of the crowd's legal moves (`crowdFilter` takes one away); or
  4. something else of his is on the board (`altersBoard`, a new optional hook, for what the three don't show).
  A future boss whose powers limit moves through `crowdFilter` or `bossStops`, or who marks his power turns for fair play
  (the ground rule), is caught with no edit.
- **When it's off, it's simply off:** `lastStandFor` returns nothing, so the move stands, no charge or fall is spent,
  nothing is said. Checked only once the move is over the bar (no cost on other moves). Once the board is plain again he
  saves as before.
- **The FAQ** ("His save: the Last Stand") says so in one line.

## The audit, boss by boss

What counts as changed (and the check that sees it), and what doesn't:

| Boss | Counts | Doesn't count |
| --- | --- | --- |
| Ginger | a frozen piece, the blizzard's ice (powerTurn, crowdFilter) | |
| Boingo | a pie (bossStops, crowdFilter, powerTurn); the funhouse's turned board (powerTurn) | |
| Jefferson | a tile ablaze (powerTurn); the Roman candle's shadows (altersBoard) | |
| Hollow | a square in the dark (altersBoard: hidden pieces) | Lights out (at the start of his turn; the turn after it is a plain board) |
| Big Boy | a toy block (bossStops, crowdFilter, powerTurn) | his snack (a pawn gone before move 1), the Big Bounce (it lands at his turn; the board after it is plain) |
| Wrangler | the showdown's duel turn (crowdFilter, powerTurn); the turn after a lasso drag (powerTurn) | his long pull (one special move of his) |
| Sawyer | the board saw, a saw cut (bossStops, crowdFilter, powerTurn); his first move due, a pawn's (bossStops) | his split pawn's halves (ordinary pawns) |
| Alfil | two pawns marked for the fusion (powerTurn: his next turn is the fusion, not a reply); pieces in the air after the Slam (powerTurn) | his elephants (bishops in every way) |
| Chub & Chirp | the carrots while the race is on (altersBoard); the turn after a hop or his spin (powerTurn) | Leapfrog's hop to come (it only adds to his options) |
| Smudgy | his rook hiding as a pawn (powerTurn, bossStops, crowdFilter); the turn after a Repaint (powerTurn) | his forced first moves (nothing on the board; a hang there is rare from the starting position) |
| Moo & Moon | a stunned piece (powerTurn, crowdFilter) | the Full Moon (he plays stronger; the board's rules are the same) |
| Puddles | a plant (bossStops, crowdFilter, powerTurn); the turn after a watering (powerTurn) | his seed count (not on the board) |
| Babur | the burning hoops (bossStops, crowdFilter, powerTurn); the turn a balloon landed (powerTurn) | a balloon on the pump (not on the board) |
| The Hidden Boss | n/a: his passive blocks the God King's help, the Last Stand never comes | |

`packages/chess/test/king-save-altered.test.ts` keeps this table as `AUDIT`, keyed by the roster: a new boss with
powers fails "every boss is audited" until it's added.

## Judgment calls

- **`powerTurn` is part of the gate.** It's the code's one existing answer to "a power touches this turn", kept per boss
  for fair play. Reusing it means one rule for both, and future bosses are covered by a hook they already need. It also
  covers a few turns where the board has just been changed under the crowd (the turn after a drag, a hop, a landing, a
  Repaint or a watering, and the funhouse's turned board): the save sits out those turns too. That costs little and fits
  "when the board is all funky".
- **A new optional hook, `altersBoard`,** for the three effects the generic checks miss: Hollow's dark (hidden pieces:
  his dark isn't a fair-play power turn, and changing that is the fair-play lane's call), the Roman candle's shadows (a
  piece there burns when the wave lands) and the carrots (the race changes what moves are worth).
- **Powers still to come don't count**: an ultimate warned for the start of his turn (the Big Bounce, Lights out,
  Babur's hoops cast, Puddles' watering), Leapfrog's hop, Smudgy's forced moves. Nothing is on the board yet; the save
  judges the move against the board as it stands, and a warned cast can still wait (the pass guard). Easy to add to
  `boardAltered` if a playtest shows a wrong save there.
- **The test switch `?laststand=1` still calls him on any board** (the gate is for real saves). It exists to show his
  Last Stand and a boss's attack on him on demand, and the king-attack specs use it on boards with a boss's power on
  (Sawyer's first move is due on their first move).
- **The e2e makes every move one he'd save** by setting the bar to nothing in the runner's settings once the hoops are
  up (no new test switch for a number only a test wants), so it proves the gate on Stockfish's own board without
  depending on a blunder turning up inside a ring. It plays a capture within a ring when one is open.
