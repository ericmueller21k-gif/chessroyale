# Babur's balloons: no long runs of landings (Oct 25, 2026)

Eric, Oct 25, after a Boss-alone game against Babur, playing as fast as he could with the admins' Engine move: "none of
his pieces are popping. He played two knights on me and a pawn… Ideally one of those knights should have bursted… He got,
like, a bishop right away… they're not popping as much as I think we had planned."

His rules: [2026-10-23-tiger-rules.md](2026-10-23-tiger-rules.md); the pace and the pops: [2026-10-24-babur-faster-balloons.md](2026-10-24-babur-faster-balloons.md);
how he works now: [bosses.md](../areas/bosses.md) (his row).

## What was measured

A new sim, `packages/sim/scripts/tiger-pops.ts`: Boss alone (the runner with one player, Boss alone's settings and
scoring, his real rules and engines in Node, 120,000 nodes), every move of yours the Engine move's (the runner's
`topMovesFor`, its best), the battle's clock (the page's time) passing your pick, then his turn: his thinking (at least
`bossThinkMs`, or the engine's real time), his move on screen alone (`bossTurnShowMs`) and its moments. "Fast" is a 1.5 s
pick (the Engine move's search and a tap); "5 s" is the pace the floor was set at. Seed 25. Rows:
`reports/boss-sim/alone-<tag>.jsonl`; the table: `npx tsx packages/sim/scripts/tiger-pops.ts summary <tags>`.

Every balloon is checked as it goes on (its `dud` against `rollBalloon` from the battle's secret) and as it ends (a dud
that landed, or a real one that popped, stops the run with an error), and every pop's moment (`pop` in his events) is
counted against the pops.

| Run | Battles | Moves | Battle clock (s) | Placed / ready / popped (`nine`) / landed a battle | Pop rate by kind (pawn, knight, bishop, rook, fake queen, queen; ended) | Pop rate | Longest landing streak (mean / max) | Battles with 3+ landings in a row | Landed material a battle (± 1 s.e.) | Pops by the new rule | Pop moments / pops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Before, fast | 40 | 55 | 205 | 4.35 / 3.42 / 2.23 (0.07) / 1.18 | 59% (82), 64% (14), 86% (14), 73% (11), 100% (12), 0% (3) | 65% of 136 | 1.00 / 3 | 2 | 2.42 (± 0.52) | 0 | 89 / 89 |
| Before, fast, games 0-19 | 20 | 53 | 196 | 4.10 / 3.25 / 1.95 (0) / 1.25 | 50% (38), 71% (7), 100% (5), 78% (9), 100% (3), 0% (2) | 61% of 64 | 1.10 / 3 | 2 | 2.65 (± 0.80) | 0 | 39 / 39 |
| **After, fast**, games 0-19 | 20 | 54 | 201 | 4.15 / 3.25 / 2.10 (0.15) / 1.10 | 56% (34), 89% (9), 83% (6), 78% (9), 100% (3), 0% (3) | 66% of 64 | 0.95 / **2** | **0** | 2.90 (± 0.85) | 1 | 42 / 42 |
| Before, 5 s, games 0-19 | 20 | 52 | 388 | 6.80 / 6.00 / 3.55 (0.50) / 2.40 | 57% (68), 67% (15), 75% (12), 67% (12), 100% (5), 0% (7) | 60% of 119 | 1.85 / 4 | 5 | 6.80 (± 1.30) | 0 | 71 / 71 |
| **After, 5 s**, games 0-19 | 20 | 54 | 392 | 6.75 / 6.15 / 3.95 (0.35) / 1.95 | 62% (66), 92% (13), 75% (12), 71% (14), 100% (7), 0% (6) | 67% of 118 | 1.45 / **2** | **0** | **5.55** (± 1.19) | 2 | 79 / 79 |

Landed material: pawn 1, knight, bishop 3, rook 5, queen 9. The odds: pops 50 (pawn), 65 (knight, bishop, rook), 100
(fake queen), 0 (queen); about 58% overall, a little more in play from `nine` (a shape he can't have).

## What was found: no bug, a run of bad luck

- **The pops follow the odds** on every path measured: by kind they are within the sampling error of 50 / 65 / 65 / 65 /
  100 / 0 (65% of 136 balloons popped at Eric's pace, 60% at 5 s, `nine` included).
- **No dud ever landed and no real balloon popped** (checked on all 437 balloons that ended), and **every pop had its
  moment** (`pop`, then his `wince`, as your turn begins): 281 of 281.
- **The secret is random per battle.** In Boss alone and a Solo raid it's drawn from `Math.random` (solo's `rng`) as the
  battle starts (`opening.setUp`); online, from the server's. A fresh draw over 200,000 battles keeps the odds (pawn 49.9%,
  knight 64.9%, bishop 65.1%, rook 65.0%, fake queen 100%, queen 0%) and consecutive rolls of one battle are independent
  (the same side 49.96% of the time). The fallback for a battle without one (from the seed) is never taken: `setUp` always
  draws it.
- **The other paths** read the same: the Engine move is your move through the normal path (`submit`); a hoops turn
  decides the landing after the cast, a dud and a real one the same until the last step; a balloon that waited (not ready,
  or no square) keeps its `dud`; online the secret is in the match state the snapshot keeps (a reload or a restart of the
  room keeps it), and in no view.
- **The pace.** At Eric's pace, as fast as the Engine move allows, a 55-move battle lasts about 205 s on the battle's
  clock, so about 3.4 balloons are ready a battle and 1.2 land. Four landings and no pop in one game is about 2% at these
  odds (0.4 to the 4th); a run of three landings came in 2 of the 40 fast battles. So Eric's game was unlucky, and the
  rules let such runs happen.
- **Unsure (not changed here):** a pop shows only on the pump (its 400 ms `pop`) and in his wince (780 ms), while a
  landing flies onto the board and stays. At Eric's pace a pop is easy to miss. Whether it needs more on screen is for the
  director and Eric.

## The fix: no long runs of landings (the director's suggestion)

**After `balloonLandsInRow` (2) of his balloons land in a row, the next one pops, whatever its roll, unless it's a real
queen** (which never pops). Any pop (a dud's or `nine`) starts the count again. `BalloonState.inRow` counts them (it ends
with each balloon: `endOfTurn`), and `rollBalloon` takes it as the balloon goes on: the guard is decided at the roll, like
every `dud`, so a balloon that waits keeps it, the host is asked the same, and the board, the view and every moment are
those of any dud until it pops. The test switch's balloons (`?balloon=`) are exempt: they do what they say.

- **The floor holds.** At the floor's pace (a 5 s pick) his landed material goes from 6.80 to 5.55 a battle (the same 20
  battles; each ± about 1.2), above 4 (Eric's "a bishop and a pawn"), so `balloonPops` stays. At Eric's own fast pace it was
  2.4 to 2.9 before and after (the clock is short, not the pops), under the floor as before; the floor is the 5 s pick's.
- **The longest run is 2** (3 or 4 before), in every battle, before and after alike otherwise. The rule turned 3 balloons
  into pops in 40 battles.
- **What players can tell:** after two landings in a row, everyone can work out that the next balloon pops unless it's a
  queen (the counts are public). That's the rule as the FAQ now says it; the secret still decides every other pop.

Player-visible text: the FAQ's Balloons, "In all, about 58% of his balloons pop." → "In all, about 58% of his balloons
pop, and he never lands more than 2 in a row: after 2 landings, the next one pops, unless it's a real queen."

## Tests

- `packages/chess/test/tiger.test.ts`: the roll (2 landings and the plain roll's dud everywhere but a real queen; fewer,
  the plain roll; shape and color unchanged; the test switch exempt); in a battle, the same balloon lands after 0 or 1
  landings and pops after 2 (its moments a pop's and his wince; its view and ask the plain balloon's); a `nine` pop and a
  dud's pop each start the count again.
- `packages/app/test/faq.test.ts`: the FAQ's new sentence from the setting.
