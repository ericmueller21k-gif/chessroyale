# Crowd 50 v 50: an engine-best player against the bots (Nov 1, 2026)

Written by `npx tsx packages/sim/scripts/crowd-bots-sim.ts summary` from `reports/crowd-bots/*.jsonl`. Eric (Nov 1): a
player making the engine's best moves should finish 1st or 2nd. 99 bots and one player who always picks the judge's
best move (its top line at 100k nodes), Crowd's settings (50 v 50, its cuts, the team final), the real runner. The
"first try" rows are this branch's first version (bots on Maia's rating scale with Maia's moves, and their
Stockfish-style twin), kept for the comparison; the Maia wiring is gone (docs/decisions/2026-11-01-bot-lobby.md).

After: each bot's rating from its name (mean 1150, sd 250, 600 to 2200), each rating's temperature giving away a Maia player's points a move at that rating (BOT_LOBBY.skillAt).

| Bots | Matches | Engine player 1st or 2nd | Its places | Mean place | Bots rated 1500+ in the final | Bots under 1000 in the final | Bots out in the first cut | A 1800+ bot above a 900- one | Bots' scoreboard rating (median, 10th to 90th) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Before** (today's bots: temperatures 0.25 to 32) | 20 | 9 of 20 (45%) | 1, 1, 2, 1, 5, 4, 45, 1, 5, 22, 5, 5, 1, 5, 3, 1, 1, 1, 20, 17 | 7.3 | 8% of 1740 | 0% of 0 | 15% | - | 2306 (1785 to 2825) |
| First try: Maia at Maia ratings around 1150 | 10 | 7 of 10 (70%) | 5, 1, 1, 1, 5, 1, 3, 1, 1, 1 | 2.0 | 17% of 93 | 1% of 251 | 14% | 87% | - |
| First try: Stockfish-style at the temperatures matching those Maia ratings | 10 | 7 of 10 (70%) | 1, 1, 1, 1, 1, 3, 1, 1, 5, 5 | 2.0 | 18% of 93 | 3% of 251 | 14% | 84% | - |
| **After** (BOT_LOBBY: ratings around 1150, Stockfish-style) | 20 | 19 of 20 (95%) | 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1 | 1.2 | 19% of 181 | 3% of 495 | 14% | 78% | 1912 (1560 to 2383) |

**The probe** (6 matches, bots at temperatures 4 to 1024): points given away a move by temperature, all bots' moves.

| Temperature | Bots | Moves | Points a move |
| --- | --- | --- | --- |
| 4 to 8 | 78 | 1528 | 2.63 |
| 8 to 16 | 72 | 1254 | 3.36 |
| 16 to 32 | 72 | 1090 | 5.06 |
| 32 to 64 | 72 | 987 | 6.25 |
| 64 to 128 | 78 | 1031 | 7.25 |
| 128 to 256 | 72 | 923 | 7.09 |
| 256 to 1024 | 144 | 1845 | 7.33 |

**Why the engine-best player isn't always 1st.** Its only losses come from the judge changing its mind: a bot's pick
outside the top line, searched on its own, or a close call re-checked deeper (700k nodes), can score above the top line
the player took, and then that line counts as a loss (traced in the first try's 3rd and 5th places: one to four such moves). The finalists are ranked
on points given away a move over the whole match, and the luckiest of 50 bots on a team often give away under one.

**Maia for the bots' moves (measured Nov 1, this machine, Node, the Maia box on one thread):** 73 ms an ask (median;
90th percentile 81 ms); one team turn of 50 bots needs one ask per rating among them (10 for 50 of the bot names), so
0.74 s a turn (most 0.86 s). In the first try's full matches, with the judge's Stockfish busy beside it: 197 ms an
ask on average, the slowest 1.4 s, and 2.2% of picks fell back to Stockfish-style within its 2.5 s budget. A phone
(the CPU slowed 4x, as for the bosses' Maia): about 0.3 s an ask, 3 s a team turn, past that budget. Stockfish-style
picks cost nothing extra: they choose from the judge's top moves, already searched.
