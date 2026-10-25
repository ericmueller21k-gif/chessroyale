# Raids score with 50 v 50's math: the cap widening by crowd move, streaks on live moves, the strike still on the worst (Oct 25, 2026)

Eric (Oct 25, on a raid screenshot): "Raids should use the 50 v 50 math: the dampers and the early forgiveness, keeping
the raid's own rule that the boss strikes the worst player every few turns."

How it works now: [crowd.md](../areas/crowd.md), "A raid's scoring", and [bosses.md](../areas/bosses.md), "The strike".
The sim: [reports/raid-scoring.md](../../reports/raid-scoring.md). 50 v 50's scoring itself:
[2026-10-24-crowd-scoring.md](2026-10-24-crowd-scoring.md).

## What changed (every number in `RAID_SCORING`, settings.ts)

- **Raids score with `RAID_SCORING`** (`RAID_SETTINGS.crowdScoring`): online raids and a Solo raid (Raid with bots).
  It is `CROWD_SCORING` (the shared-blunder relief, the soft cap on the ratio curve, a piece hung uncapped, streaks and
  the fire, rare brilliant shoutouts, a miss at 2 caps, 2 decimals), the whole crowd as one team, with three changes:
  1. **The cap widens by the crowd's move** (`capFromMove` [1, 11, 15, 19] for the caps ±2 / ±3.5 / ±5 / ±8). A raid has
     no cuts (`knockoutsPerStage: []`), so by stage the cap would sit at ±2 all game. The numbers are 50 v 50's own on
     each player's picks: 10 picks at ±2 before the first cut, then the cuts 1, 5 and 9 come on picks 11, 15 and 19. The
     runner's `scoreContext` passes the boss battle's crowd move (1 up) and `capFor` reads it when the scoring has
     `capFromMove` (50 v 50's has none, so its boss final still goes by stage). A Last Stand's re-pick has the same
     move number as the move taken back.
  2. **Streaks count only on live moves** (`streakMinAverage` 1): a move counts for a streak only when the crowd gave
     away 1 point or more on average by raw loss; below it the move plays itself and a streak neither grows nor ends.
  3. **No bubble** (`cutGrace` 0): nothing is cut.
- **Boss alone keeps the old scoring** (`BOSS_ALONE_SCORING`, put over the settings by `SoloMatch` when a raid has no
  bots): with nobody to compare with, every round score is 0 but a miss, and its scoreboard is going away.
- **The strike is unchanged**: it still goes by counted points given away since its last strike (`strikeVictim`), never
  by the capped round points. The tie-break, now written down in the FAQ and bosses.md: (1) more counted points given
  away since the boss's last strike, (2) the worse match (`matchLoss`: average counted loss per move, a miss counting
  `finalMissLoss`), (3) still tied: nobody is struck and the strike is due again after the next crowd move. Never a coin.
- **The screens** already followed `settings.crowdScoring` (Oct 24), so a raid's scoreboard now shows 2 decimals and the
  fire, the reveal its "+0.50 streak bonus" and "not capped · gave up a piece" notes, the dock's line 2 decimals, and
  only a rare find gets a brilliant line (the shoutout). No screen file changed.
- **The FAQ** reads the raid numbers from `RAID_SCORING` (`raidScoringWords`), with a new "Scoring in a boss raid".

## The sim (the deciding evidence)

`raid-scoring-trace.ts` recorded **39 raids of 50 Maia players** (ratings evenly 1100 to 1900, as the 50 v 50 sim; each
pick sampled from Maia's probabilities among the moves the boss allows) against **Ginger, Boingo and Sawyer** (13 each),
each played through the game's own `MatchRunner` with `RAID_SETTINGS` (the boss's brain and powers, the Last Stand;
judge and boss at 120k nodes). Raids lasted 46.9 crowd moves on average; the boss won 37 of 39. Recording never
strikes, so all 50 pick every move and every variant scores the same games; `raid-scoring-sim.ts` re-scores them
through core (`scoreGroup`, `crowdBrilliant`, `applyRound`) and re-plays the strikes by each rule (`strikeVictim` /
`bossKill` for today's). Mean ± its standard error over the raids:

| Scoring | in ±10 after 10 moves | strikes / raid | strike's victim played that move fine | victim not among the window's 5 worst | strikes that waited on a tie / raid | ties at the scoreboard's bottom at a strike | piece-hanger's place after 10 (0 top, 1 bottom) | hangers struck by move 20 | streak share of the top 8's points | shoutouts / raid | rating vs lasting (rank corr) | struck players' mean rating |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today (no cap, 1 decimal) | 53 ± 5% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.02 ± 0.01 | 0.88 ± 0.02 | 56% | — | — | 0.20 ± 0.02 | 1424 ± 11 |
| 50 v 50's math as it is, cap by crowd move 1/11/15/19 | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.01 ± 0.01 | 0.95 ± 0.01 | 56% | 69% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |
| streaks on moves the crowd gave away 0.5+ | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.03 ± 0.01 | 0.95 ± 0.01 | 56% | 6% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |
| **streaks on 1+ (RAID_SCORING, chosen)** | **98 ± 1%** | **13.1 ± 0.8** | **75%** | **0%** | **6.6 ± 1.9** | **0.03 ± 0.01** | **0.95 ± 0.01** | **56%** | **5%** | **0.05 ± 0.04** | **0.20 ± 0.02** | **1424 ± 11** |
| streaks on 2+ | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.03 ± 0.01 | 0.95 ± 0.01 | 56% | 2% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |
| streaks on 4+ | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.03 ± 0.01 | 0.95 ± 0.01 | 56% | 1% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |
| RAID_SCORING, strike by points since the last strike | 98 ± 1% | 12.9 ± 0.9 | 76% | 3% | 7.2 ± 2.2 | 0.02 ± 0.01 | 0.95 ± 0.01 | 64% | 5% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1413 ± 15 |
| RAID_SCORING, cap by crowd move 1/11/21/31 (slower) | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.03 ± 0.01 | 0.95 ± 0.01 | 56% | 5% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |
| RAID_SCORING without streaks | 98 ± 1% | 13.1 ± 0.8 | 75% | 0% | 6.6 ± 1.9 | 0.03 ± 0.01 | 0.95 ± 0.01 | 56% | 0% | 0.05 ± 0.04 | 0.20 ± 0.02 | 1424 ± 11 |

The columns are defined in the report. "Played that move fine": the victim's pick on the move the strike came after gave
away 1 point or less, or more than 10% of the picks gave away more.

## The calls made here, and why

- **The clock is the crowd's move, not the strike count.** A strike waits a move on a tie (6.6 times a raid), so strikes
  come at uneven times; the move number is what the top bar shows and is the same for everyone. The 50 v 50 schedule on
  picks (1/11/15/19) and a slower one (1/11/21/31) score identically on every measure here (both are ±2 through move 10,
  and nothing the strike reads depends on the cap), so the 50 v 50 numbers stand: "the same feel as 50 v 50". The cap
  squeezes as in 50 v 50: 98% of players are within ±10 after 10 crowd moves (53% today; 50 v 50's sim 92%).
- **Hung pieces still punished in full.** Piece-hangers sit at 0.95 of the scoreboard after 10 moves (0.88 today).
- **Streaks: on, but only on live moves.** 50 v 50's streaks as they are break in a raid: 67% of a raid's crowd moves
  have every pick within 2 points of the best (70% have the crowd averaging under 1 point), because the boss usually
  gets a winning game and then every move scores about the same. Every such move was "strong" for everyone, so the whole
  crowd rode +1-a-move streaks: 69% of the top 8's points, and the fire on every row. Counting only moves where the crowd
  gave away 1 point or more on average brings it to 5% (0.5: 6%; 2: 2%; 4: 1%). That's under 50 v 50's 10-20% target,
  and lowering the bar doesn't reach it (a raid has fewer live moves); 1 is the plain number ("a move that plays
  itself"), and sweeping further was out of the budget. A dead move neither builds nor breaks a streak, so a player's
  run survives the boss's quiet stretch. 50 v 50 leaves `streakMinAverage` unset (its decided games restarted in the 50
  v 50 sim, so it was never measured there).
- **The strike: as today, by points given away.** Eric asked to keep the raid's rule, and the numbers agree: by counted
  points given away, every strike lands on one of the window's 5 worst (by construction: it is the worst); striking by
  the window's capped points would put 3% of strikes outside them (a run of small slips costing more capped points than
  one big one), wait more often (7.2 against 6.6), and only strike hangers a little sooner (64% against 56% by move 20).
  The capped scores make no new ties at the strike: the strike never reads them, and the scoreboard's bottom ties at
  a strike stay near zero (0.03 a strike). 75% of victims played the move just before the strike fine under every rule:
  the strike weighs every move since the last one (3, or more after a wait), so the victim is usually someone whose
  slip came a move or two earlier. That's the rule working as written, not a random tie.
- **The bubble is off** (`cutGrace` 0), as nothing is cut.
- **Rare brilliant shoutouts: on**, as in 50 v 50 (0.05 a raid here: the gap rule is strict and a crowd of Maias rarely
  splits that far). The old "Brilliant move: … · only N of M found it" line gives way to it in raids too.
- **Boss alone is off**, as the brief asks. With one player the scoring has nothing to compare, and its scoreboard is
  going away; `BOSS_ALONE_SCORING` makes it explicit in settings, applied by `SoloMatch` (not `App.tsx`, which another
  helper is editing). A private online raid that starts with one person scores as a raid (all zeros but misses).
- **A cost to know:** with a crowd scoring on, the runner runs the exchange check (`materialSlips`) on the distinct
  picks every move, not just in the opening (`allowanceFor`). The gardener's whole-battle fuzz test took 23.5 s against
  22.0 s on main, alone.

## Tests

Unit `packages/core/test/raid-scoring.test.ts` (raids on with 50 v 50's numbers, Boss alone off; the cap by crowd
move, the stage playing no part, 50 v 50's unchanged; a move scored under its move's cap, a piece hung whole, a miss
at 2 caps; a dead move holding a streak; the strike by points given away though another is lower on the scoreboard,
the tie to the worse match, the wait on a full tie), `packages/app/test/faq.test.ts` (the raid words from
`RAID_SCORING`). e2e `e2e/boss-dock.spec.ts`: its Solo raid's dock line now shows 2 decimals, so its expected format
(`toFixed(2)`, `\d\d`) and the widest content ("(-45.30)", a piece hung) changed with it; `e2e/hollow.spec.ts` (Boss
alone's points, unchanged) still passes.
