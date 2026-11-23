# The engine reader: before and after (Oct 14, 2026)

How reading Stockfish's MultiPV output by slot alone went wrong, and what changes with `searchLines`
(DECISIONS.md, "The engine reader: a slot's last exact line may name another move"). Base: main at 0ac7835. Fix: this
branch. All runs local, single-threaded, fixed node budgets.

## How often a search came out wrong (before)

Positions: the opening library plus a few random plies; castling legal in every restricted search, and one of the
moves asked for.

| Search | Build / nodes | Searches | One move twice, another missing |
|---|---|---|---|
| Judge's top 8 (every board, every round, on devices) | lite / 250k | 800 | about 19% |
| Device re-check, 3 moves | lite / 700k | 150 | 6.7% |
| Engine server, 4 moves (8 boards) | native 17.1 / 400k | 500 | 5.2% |
| Engine server, 4 moves (one board) | native 17.1 / 2M | 150 | 6% |
| 2 moves | lite / 20k | 1,000 | 2.2% |

## Only those searches change

The raw output of 1,000 saved searches, read both ways: every search with no move twice reads identically (each move,
number and order), and every search with a move twice reads with each move once and none of the asked-for moves missing.

| Saved searches | Searches | With a move twice (before) | Identical otherwise | Move twice or missing (after) |
|---|---|---|---|---|
| Lite top 8, 250k | 400 | 76 | 324 of 324 | 0 |
| Lite single line, 250k | 300 | 0 | 300 of 300 | 0 |
| Lite re-check (3 moves), 700k | 150 | 10 | 140 of 140 | 0 |
| Native re-check (4 moves), 2M | 150 | 9 | 141 of 141 | 0 |

## The judge's accuracy (`judge-accuracy.ts`)

`judge-accuracy.ts run 20 11` and `run 20 12` on the base (39 positions, 468 picks, referee at 3M nodes), then the same
scorers re-run with the fix's code on the same positions and picks (the base's code re-run gives its numbers exactly:
144 of 144). Columns as `reports/judge-accuracy.md`.

| Scorer | Code | Good move marked a mistake | ... a blunder | Bad move let off | Median error | 90th pct | Mean error | Same best as referee |
|---|---|---|---|---|---|---|---|---|
| Lite 250k (today) | base | 1.4% (3/221) | 0.0% | 3.7% (7/191) | 0.7 | 10.2 | 2.95 | 76.9% |
| Lite 250k (today) | fix | 1.4% (3/221) | 0.0% | 3.1% (6/191) | 0.7 | 10.2 | 2.92 | 76.9% |
| Lite 1M | base | 0.9% (2/221) | 0.0% | 5.8% (11/191) | 0.5 | 6.8 | 2.25 | 82.1% |
| Lite 1M | fix | 0.9% (2/221) | 0.0% | 5.8% (11/191) | 0.5 | 7.2 | 2.26 | 82.1% |
| Full 250k | base | 0.9% (2/221) | 0.5% | 1.6% (3/191) | 0.5 | 7.4 | 2.25 | 84.6% |
| Full 250k | fix | 0.9% (2/221) | 0.5% | 1.6% (3/191) | 0.6 | 7.5 | 2.30 | 82.1% |

Paired, pick by pick (fix minus base, the error against the referee): today's scorer −0.035 ± 0.022 points (31 of 468
picks changed, in 6 of 39 positions); lite 1M +0.007 ± 0.021; full 250k +0.044 ± 0.035. No change beyond noise.

## The boss's own moves (`bossMoveFrom`)

300 boss-to-move positions (an opening, then up to 30 plies of the lite engine's top 3), the boss's Stockfish move with
the base's and the fix's code in one process, same seeds. Stockfish's UCI_Elo move is random (its skill draw is seeded
by the clock), so it is drawn once and handed to both; the top-8 search and the confirm search run on each code's own
engine. Changed moves refereed by the full network at 3M nodes.

| Boss move | Moves | Changed | Fix minus base loss per move |
|---|---|---|---|
| Stumble (slip from the top 8) | 300 | 3 | +0.05 points |
| UCI_Elo 2000 | 300 | 1 | +0.03 |
| UCI_Elo 2500 | 300 | 2 | +0.03 |
| UCI_Elo 3000 | 300 | 1 | +0.03 |
| All | 1,200 | 7 (0.6%) | +0.033 ± 0.014 (SE; 4 of the 7 are one position at every setting) |

## The bosses in raids (`boss-sim.ts raid`)

`boss-sim.ts raid all 1 <seed> 0` for seeds 1 to 13 and 31 to 43 on each code (one game per boss per seed, so the games
are paired by seed; they still part ways within a few moves; the last seed's games stopped partway, so some bosses have
24). 50 bots against each boss at its raid strength, with every power,
the boss on Stockfish (no Maia in Node). Crowd score: a win 1, a draw 0.5.

| Boss | Paired games | Base crowd/draw/boss | Fix crowd/draw/boss | Base crowd score | Fix crowd score | Fix minus base (SE) |
|---|---|---|---|---|---|---|
| gingerbread | 25 | 2/0/23 | 0/4/21 | 0.08 | 0.08 | +0.00 ± 0.07 |
| clown | 24 | 6/14/4 | 10/10/4 | 0.54 | 0.63 | +0.08 ± 0.09 |
| grex | 24 | 1/2/21 | 0/2/22 | 0.08 | 0.04 | −0.04 ± 0.06 |
| hollow | 24 | 12/12/0 | 16/6/2 | 0.75 | 0.79 | +0.04 ± 0.09 |
| bigboy | 24 | 3/5/16 | 5/3/16 | 0.23 | 0.27 | +0.04 ± 0.08 |
| sawyer | 24 | 7/3/14 | 10/4/10 | 0.35 | 0.50 | +0.15 ± 0.12 |
| pig | 24 | 6/6/12 | 6/12/6 | 0.38 | 0.50 | +0.13 ± 0.11 |
| recluse | 24 | 11/4/9 | 10/6/8 | 0.54 | 0.54 | +0.00 ± 0.12 |
| All | 193 | 48/46/99 | 57/47/89 | 0.37 | 0.42 | +0.05 ± 0.03 |

Rows: `reports/boss-sim/raid-rb1.jsonl`, `raid-rb2.jsonl` (base) and `raid-rf1.jsonl`, `raid-rf2.jsonl` (fix).

No boss moves beyond noise (each within 1.3 standard errors; at 24 games a boss would need to move about 0.2 to show).
All bosses together lean slightly toward the crowd (+0.05 ± 0.03, under 2 standard errors). The boss's own moves
barely change (above), so if that lean is real it comes from the bots' picks, which read the same top 8.
