# Maia-3 as Ginger's brain: sanity runs (Oct 11, 2026)

Written by `npx tsx packages/sim/scripts/maia-sim.ts summary` from `reports/maia-sim/*.jsonl`. Boss alone as plain chess
(Ginger's powers and the God King left out): a bot player (boss-sim.ts's kind: a skill temperature and some random
moves) against Ginger at a tier (her offset, Normal), the boss on each brain (BOSS_BRAIN: Maia's draw at temperature
0.8, top-p 0.9). The same openings and colors for every brain; 60 player moves at most, then the
engine's verdict (75% or more: a win). Every boss move is scored as the judge scores a pick (its loss against the best,
in points, at engineNodes); the loss columns count only moves in a game still to be played (the boss's chances 15–85%
before it). (Stockfish judging Stockfish's own moves reads them kindly: compare the brains with each other.)
Small samples: a sanity check, not a calibration.

| Tier | Player | Brain | Ginger (strength) | Games | Player's score | Boss's mean loss | Boss moves over 10 / 25 points | Boss moves by Maia | Vetoed | Median boss move, ms | Player's mean loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1600 | expert | stockfish | 1500 | 8 | 1.5 / 8 | 1.7 | 5% / 1% | 0% | 0 | 1399 | 0.8 |
| 1600 | expert | maia-raw | 1500 (Maia 1190) | 8 | 5 / 8 | 10.8 | 27% / 21% | 100% | 0 | 761 | 0.7 |
| 1600 | expert | maia-light | 1500 (Maia 1190) | 8 | 5 / 8 | 2.9 | 11% / 3% | 97% | 239 | 558 | 0.6 |
| 1600 | expert | maia-full | 1500 (Maia 1190) | 8 | 1.5 / 8 | 1.0 | 1% / 1% | 97% | 187 | 618 | 0.8 |

## A few positions per brain

| Boss strength | Brain | Position | Move | What the brain did | ms (whole boss move) |
| --- | --- | --- | --- | --- | --- |
| 1500 | stockfish | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Stockfish | 1072 |
| 1500 | stockfish | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | c4d5 | Stockfish | 1507 |
| 1500 | stockfish | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | a8b8 | Stockfish | 2049 |
| 1500 | stockfish | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | f8e7 | Stockfish | 1481 |
| 1500 | maia-raw | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 1190 · no guard · Maia's #1 · 155 ms | 470 |
| 1500 | maia-raw | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | c4d5 | Maia 1190 · no guard · Maia's #1 · 126 ms | 464 |
| 1500 | maia-raw | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | c8g4 | Maia 1190 · no guard · Maia's #2 · 90 ms | 498 |
| 1500 | maia-raw | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | c8b7 | Maia 1190 · no guard · Maia's #2 · 91 ms | 507 |
| 1500 | maia-light | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 1190 · light guard · Maia's #1 · 87 ms | 463 |
| 1500 | maia-light | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | c4d5 | Maia 1190 · light guard · guard → Maia's #1 · 113 ms | 551 |
| 1500 | maia-light | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | f8e8 | Maia 1190 · light guard · Maia's #3 · 81 ms | 500 |
| 1500 | maia-light | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | b5b4 | Maia 1190 · light guard · guard → Maia's #3 · 83 ms | 440 |
| 1500 | maia-full | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 1190 · full guard · Maia's #1 · 88 ms | 516 |
| 1500 | maia-full | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | f1e2 | Maia 1190 · full guard · Maia's #3 · 108 ms | 575 |
| 1500 | maia-full | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | e7e5 | Maia 1190 · full guard · Maia's #1 · 90 ms | 543 |
| 1500 | maia-full | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | b5b4 | Maia 1190 · full guard · guard → Maia's #3 · 84 ms | 532 |
| 2300 | stockfish | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Stockfish | 995 |
| 2300 | stockfish | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | a1c1 | Stockfish | 1509 |
| 2300 | stockfish | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | f6d7 | Stockfish | 1499 |
| 2300 | stockfish | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | c8b7 | Stockfish | 1996 |
| 2300 | maia-raw | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4b3 | Maia 1910 · no guard · Maia's #1 · 81 ms | 483 |
| 2300 | maia-raw | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | f1e2 | Maia 1910 · no guard · Maia's #2 · 82 ms | 437 |
| 2300 | maia-raw | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | e7e5 | Maia 1910 · no guard · Maia's #1 · 85 ms | 436 |
| 2300 | maia-raw | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | c8b7 | Maia 1910 · no guard · Maia's #1 · 115 ms | 454 |
| 2300 | maia-light | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 1910 · light guard · guard → Maia's #2 · 70 ms | 488 |
| 2300 | maia-light | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | f1e2 | Maia 1910 · light guard · Maia's #2 · 84 ms | 448 |
| 2300 | maia-light | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | f8e8 | Maia 1910 · light guard · Maia's #3 · 81 ms | 473 |
| 2300 | maia-light | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | a7a6 | Maia 1910 · light guard · Maia's #2 · 79 ms | 483 |
| 2300 | maia-full | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 1910 · full guard · guard → Maia's #2 · 135 ms | 475 |
| 2300 | maia-full | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | c4d5 | Maia 1910 · full guard · Maia's #1 · 94 ms | 442 |
| 2300 | maia-full | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | f8e8 | Maia 1910 · full guard · Maia's #3 · 84 ms | 457 |
| 2300 | maia-full | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | a7a6 | Maia 1910 · full guard · guard → Maia's #2 · 104 ms | 452 |
| 2600 | stockfish | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4b3 | Stockfish | 2037 |
| 2600 | stockfish | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | f1e2 | Stockfish | 1434 |
| 2600 | stockfish | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | a7a5 | Stockfish | 1487 |
| 2600 | stockfish | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | a7a6 | Stockfish | 939 |
| 2600 | maia-raw | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4b3 | Maia 3000 · no guard · Maia's #1 · 107 ms | 499 |
| 2600 | maia-raw | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | d1c2 | Maia 3000 · no guard · Maia's #2 · 84 ms | 425 |
| 2600 | maia-raw | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | e7e5 | Maia 3000 · no guard · Maia's #1 · 88 ms | 490 |
| 2600 | maia-raw | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | c8b7 | Maia 3000 · no guard · Maia's #1 · 80 ms | 490 |
| 2600 | maia-light | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 3000 · light guard · guard → Maia's #2 · 90 ms | 489 |
| 2600 | maia-light | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | d1c2 | Maia 3000 · light guard · Maia's #2 · 79 ms | 447 |
| 2600 | maia-light | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | e7e5 | Maia 3000 · light guard · Maia's #1 · 94 ms | 455 |
| 2600 | maia-light | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | b5b4 | Maia 3000 · light guard · guard → Maia's #3 · 100 ms | 507 |
| 2600 | maia-full | `rnbqkb1r/5ppp/p3pn2/1pp5/2BP4/4PN2/PP2QPPP/RNB2RK1 w` | c4d3 | Maia 3000 · full guard · guard → Maia's #2 · 81 ms | 478 |
| 2600 | maia-full | `rnbq1rk1/pp3ppp/4pn2/2bp4/2P2B2/2N1PN2/PP3PPP/R2QKB1R w` | a2a3 | Maia 3000 · full guard · Maia's #1 · 110 ms | 420 |
| 2600 | maia-full | `r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b` | e7e5 | Maia 3000 · full guard · guard → Maia's #1 · 79 ms | 498 |
| 2600 | maia-full | `r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b` | b5b4 | Maia 3000 · full guard · guard → Maia's #3 · 85 ms | 442 |

