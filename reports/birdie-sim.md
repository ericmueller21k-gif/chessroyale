# Birdie's calibration: the Train and the Fall (Nov 23, 2026)

Birdie (id `birdie`; docs/decisions/2026-11-23-birdie-rules.md, 2026-11-23-birdie-fall.md). **The Train:** warned for the crowd's 2nd
move, then every 3rd; a piece left on the warned line is smashed as his turn begins, the king left there ends the battle. **The Fall:**
once, when he's lost 9 points of material; Armored Birdie after it (no train).

## Run A (one run, as the brief asks)

`npx tsx packages/sim/scripts/boss-sim.ts raid birdie 8 <seed> 0 birdieA<seed>`, four processes side by side (seeds 11 to 14); a crowd of
bots, the boss at tier 1600 − 250 = 1350, as every boss's raid run. Rows: `reports/boss-sim/raid-birdieA*.jsonl` (their `lostAtFall` is
the stored meter, a turn stale: the script now logs it as his fall counts it, the capture that brought it included).

| Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves (median) | Warnings a battle | Rides a battle | Smashed | Spared | Train wins | Falls |
|---|---|---|---|---|---|---|---|---|---|
| 32 | 0 / 1 / 31 | **0.02** (± 0.02) | 19.5 | 6.0 | 3.5 | 97 (76 pawns, 9 knights, 6 bishops, 4 rooks, 2 queens) | 0 | 15 | 4 (after crowd moves 7, 10, 15, 31) |

Warned: pawns 101, king 35, knights 21, bishops 15, rooks 13, queens 6.

## What it says

- **His score sits with the pack's hard end:** the crowd's 0.02 is Chandy's shipped run D (0.02); Don Dough 0.05, the plain boss 0.10,
  Dash 0.15, Puddles 0.17 (reports/chandy-sim.md). The offset stays −250.
- **The train wins are mostly the bots, not the rule.** Replaying a battle (seed 14) with the judge's numbers printed at each warning:
  by his third warning the position was already lost to the engine (every move 0), so leaving the piece scored the same as saving it
  and the bots picked at random; the same with the king warned, which a player reading "Move your king!" moves. His first warning there
  hit a pawn whose only move hung it anyway (b3–b4 against the f8 bishop): the rule asks for a piece that can move, not a safe square.
  Battles are short (19.5 moves, Chandy's 43) for that reason: decided ones end on the train instead of the mate.
- **The fall comes late or not at all** against a crowd this weak (he loses little): 4 battles in 32. Eric's playtests are the real
  check; `fallLost`, `trainFrom`, `trainEvery` and his offset are in `BOSS_POWERS.birdie` and `BOSS_ROSTER`.
