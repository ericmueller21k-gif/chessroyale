# The Stranger's calibration: Frostfire (Nov 27, 2026)

The Stranger (id `stranger`; docs/decisions/2026-11-27-stranger-rules.md). **Frostfire:** with his reply to your 2nd move, then every 4th
turn, your most valuable piece but the king frozen a turn, a turn to move it off, then its square burns whatever is on it.

## Run A (one run, as the brief asks)

`npx tsx packages/sim/scripts/boss-sim.ts raid stranger 4 <seed> 0 strangerA<seed>`, four processes side by side (seeds 11 to 14); a crowd
of bots, the boss at tier 1600 − 250 = 1350, as every boss's raid run. Rows: `reports/boss-sim/raid-strangerA*.jsonl` (`stranger`: each
strike and burn).

| Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves (median) | Strikes a battle | Burns | Fled (burnt empty) | Crowd pieces burnt | His burnt | Spared |
|---|---|---|---|---|---|---|---|---|---|
| 16 | 0 / 0 / 16 | **0.00** | 28 | 6.6 | 105 | 66 | 36 (18 rooks, 8 queens, 5 pawns, 3 bishops, 2 knights) | 3 | 0 |

Struck: queens 65, rooks 25, pawns 8, knights 4, bishops 4.

## What it says

- **The pack's hard end, as Birdie (0.02) and Chandy (0.02) at the same setting** (reports/birdie-sim.md); battles a little longer than
  Birdie's (28 moves to his 19.5). The offset stays −250 for now; Eric's playtests and his ultimate (next PR) are the real check.
- **The bots flee most strikes** (66 of 105); a piece left behind is mostly from a position already lost, where every move scores the same
  to the judge (as Birdie's train). `strikeFrom`, `strikeEvery`, `freezeTurns`, `fleeTurns` are in `BOSS_POWERS.stranger`.
