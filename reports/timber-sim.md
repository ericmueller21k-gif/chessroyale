# Timber's calibration: Scraps and Gnaw (Nov 1, 2026)

Timber (id `timber`; docs/decisions/2026-11-01-timber.md). From the game so far. **Scraps:** a workshop of five pieces (pawn 2,
knight 4, bishop 4, rook 6, queen 12 scraps) fed by a scrap every `scrapEverySec` of real time and 2 for each capture of his; a
finished piece drops onto his half at the end of his turn, one a turn, `workshopDropMax` a battle. **Gnaw** (the rage meter):
after the warning, after his move, one of your pawns eaten, 8 scraps.

The aim (the brief): his win rate with the roster's. The pack in these sims at the usual −250: Babur 0.12, Puddles 0.17, Moo 0.21,
Folio (at +150) 0.28 to 0.33.

**Shipped (run timberM, 36 battles): offset −250, a scrap every 15 s (Eric's), `workshopDropMax` 2, `workshopLeadMax` 1 (a piece
drops only while it leaves him at most a pawn ahead of you on material), his two back ranks first, `rageSpeed` 0.7: the crowd
scores 0.18 (± 0.05) in 46 crowd moves**, in the pack (Puddles' 0.17). 1.44 drops a battle (nearly all pawns: the lead guard
lets him rebuild, not run away), 1.61 Gnaws.

## How: the raid sim

`npx tsx packages/sim/scripts/boss-sim.ts raid timber <games> <seed> 0 <tag> [patch]`, three processes of 12 to 20 battles each
(`{"skip":N}`), the rows joined; a crowd of bots, its pick 10 s, the sim's clock for his scraps (the pick, the reveal, his turn
and the moments: about 16 s a crowd move, so about one timed scrap a move). The boss at tier 1600 − 250 = 1350, at Stockfish's
floor with the most slips (every boss's sims are there: an offset further down changes nothing at this tier, so his strength by
level is the usual −250 and his powers carry the tuning). Each row logs his drops, Gnaws and scraps (`reports/boss-sim/raid-timber*.jsonl`).

(Each run is run A's settings with what its row names; runs B to F drop anywhere on his half, G on his back two ranks first.)

| Run | Seed | What changed | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves | Drops a battle (pieces) | Gnaws a battle | Scraps a battle |
|---|---|---|---|---|---|---|---|---|---|
| timberA | 1 | -250, 15 s, cap 4, `rageSpeed` 1.2, the most valuable finished piece, anywhere on his half | 60 | 0 / 0 / 60 | 0.00 (± 0.00) | 31 | 3.33 (b 48, n 52, p 38, q 31, r 31) | 1.20 | 46 |
| timberB | 1 | cap 2, the first finished piece | 40 | 0 / 1 / 39 | 0.01 (± 0.01) | 36 | 1.98 (b 19, n 22, p 36, q 2) | 1.68 | 23 |
| timberC | 1 | cap 1 | 20 | 0 / 1 / 19 | 0.03 (± 0.02) | 39 | 1.00 (b 6, n 2, p 12) | 1.95 | 11 |
| timberZ | 1 | no powers (cap 0, no Gnaw): the plain boss | 6 | 0 / 5 / 1 | 0.42 (± 0.08) | 47 | 0.00 () | 0.00 | 0 |
| timberD | 1 | Gnaw only (no drops) | 12 | 0 / 3 / 9 | 0.12 (± 0.07) | 42 | 0.00 () | 2.67 | 0 |
| timberE | 1 | drops only (cap 2, no Gnaw) | 12 | 1 / 0 / 11 | 0.08 (± 0.08) | 38 | 1.92 (b 7, n 3, p 12, q 1) | 0.00 | 20 |
| timberF | 1 | cap 2, `rageSpeed` 0.7 | 12 | 2 / 0 / 10 | 0.17 (± 0.11) | 33 | 1.92 (b 4, n 8, p 11) | 1.00 | 18 |
| timberG | 1 | cap 2, `rageSpeed` 0.8, his back two ranks first | 12 | 0 / 1 / 11 | 0.04 (± 0.04) | 44 | 2.00 (b 4, n 6, p 14) | 1.50 | 21 |
| timberH | 1 | cap 1, `rageSpeed` 0.8, back ranks first | 12 | 1 / 0 / 11 | 0.08 (± 0.08) | 42 | 1.00 (b 4, p 8) | 1.50 | 11 |
| timberI | 1 | drops only, cap 2, back ranks first | 12 | 0 / 0 / 12 | 0.00 (± 0.00) | 37 | 2.00 (b 5, n 9, p 10) | 0.00 | 19 |
| timberJ | 2 | cap 2, `rageSpeed` 0.7, back ranks first | 48 | 0 / 1 / 47 | 0.01 (± 0.01) | 36 | 1.96 (b 27, n 19, p 42, q 1, r 5) | 0.77 | 19 |
| timberK | 3 | cap 1, `rageSpeed` 0.7, back ranks first | 24 | 4 / 0 / 20 | 0.17 (± 0.08) | 42 | 1.00 (b 2, n 6, p 16) | 1.46 | 9 |
| timberL | 3 | cap 1, 30 s, `rageSpeed` 0.7, back ranks first | 24 | 2 / 5 / 17 | 0.19 (± 0.07) | 46 | 1.00 (b 2, n 6, p 16) | 1.62 | 8 |
| timberM | 4 | **cap 2, 15 s, `rageSpeed` 0.7, back ranks first, at most a pawn ahead (`workshopLeadMax` 1): shipped** | 36 | 3 / 7 / 26 | 0.18 (± 0.05) | 46 | 1.44 (n 1, p 51) | 1.61 | 47 |
| timberN | 5 | cap 1, 30 s, `rageSpeed` 0.7, back ranks first, at most a pawn ahead | 36 | 3 / 7 / 26 | 0.18 (± 0.05) | 45 | 0.75 (b 1, p 26) | 1.61 | 20 |

## What it says

- **Free material decides these battles.** With no powers the crowd scores 0.42 (6 battles, mostly draws); the Gnaw alone (about
  2.5 pawns a battle) brings it to 0.12; two drops with no Gnaw to 0.00 to 0.11. Any drop that put him ahead turned a draw into his
  win.
- **The most valuable piece first gave him a queen in half his battles** (run A: 31 queens in 60, 0.00). Dropping the first
  finished one (Eric's wording) made it mostly pawns and minor pieces, still 0.01 to 0.04 at cap 2 (runs B, J).
- **Placing it on his back ranks** (G, I) changed little: a free piece is a free piece.
- **The lead guard did it:** a piece drops only while it leaves him at most a pawn ahead (`workshopLeadMax` 1), so the workshop
  rebuilds what he lost (a pawn here, a knight after a trade) rather than piling on. With it and cap 2 at Eric's 15 s (M) the crowd
  scores 0.18; cap 1 at 30 s (N) also 0.18, and cap 1 without the guard 0.17 to 0.19 (K, L). M keeps Eric's rate and two drops.
- The Gnaw at `rageSpeed` 0.7 comes about 1.6 times a battle (at 1.2: about 2.5).
