# Don Dough's calibration: Rising Dough and Gold Plate (Nov 11, 2026)

Don Dough (id `zebra`; docs/decisions/2026-11-11-don-dough.md). From the game so far. **Rising Dough:** a few lumps of dough on his
half, each showing its piece and an oven timer (Eric's pawn 4, knight and bishop 7, rook 10, queen 15; a minute off per move, the
crowd's and his); at 00:00 his piece rises there, unless a crowd piece landed on it (squashed). **Gold Plate** (the rage meter):
after the warning, at the start of his turn, his queen (else his strongest piece) turns gold; the crowd's pawns can't take it.

The aim (the brief): about a pawn and a half to a knight of risen material a battle, a queen only now and then (Eric), and his win
rate with the roster's: his powers move the crowd's score about as much as the others' do against the plain boss.

**Shipped (runs K and L, 40 battles): offset −250, `doughDrops` 3 (first after crowd move 1 to 3, then every 3 to 5, none after
16), `doughLive` 2, placed reachably on his half's middle ranks (`doughReach` "any"), `doughOdds` p .5, n .2, b .2, r .06, q .04
rolled over all kinds and stepping down to one he can have, never past `doughLeadMax` 2 pawns ahead (a queen's excepted),
`rageSpeed` 1, `maxUltimates` 2: the crowd scores 0.05 (± 0.03) in 42 moves; 2.1 pawns risen a battle (a queen in 4 of 40),
1.6 Gold Plates.** The plain boss in the same sim scores 0.10 (± 0.04, runs Z, Zb, Zc, 56 battles): his powers take about 0.05.

## How: the raid sim

`npx tsx packages/sim/scripts/boss-sim.ts raid zebra <games> <seed> 0 <tag> '<patch>'`, three to five processes side by side; a
crowd of bots, the boss at tier 1600 − 250 = 1350 (Stockfish's floor, the most slips: an offset further down changes nothing
here, as in every boss's sims). The bots read the judge, which doesn't know about the dough, so a crowd that knows the rule is
modeled by `squash` (0.3): the whole crowd lands on a lump when the best such move costs at most 0.3 of its piece's value, in
pawns, against its best move. They never plan two moves ahead for it, as people would: real crowds should squash more. Each row
logs the drops, every rise and squash, the plans, the material risen and the Gold Plates (`reports/boss-sim/raid-zebra*.jsonl`).

| Run | Seed | What changed | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves | Drops a battle | Rises a battle (pieces) | Squashes | Pawns risen | Gold Plates |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Z | 1 | no powers (no dough, no Gold Plate): the plain boss | 16 | 1 / 1 / 14 | 0.09 (± 0.07) | 46 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Zb | 2 | no powers | 20 | 1 / 1 / 18 | 0.07 (± 0.05) | 47 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Zc | 4 | no powers | 20 | 1 / 4 / 15 | 0.15 (± 0.06) | 48 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| A | 1 | first build: no lead guard, out of reach of every crowd move, squash rule 0.3 | 30 | 0 / 1 / 29 | 0.02 (± 0.02) | 38 | 1.67 | 1.53 (p 20, n 12, b 12, r 1, q 1) | 0.13 | 3.53 | 1.47 |
| B | 1 | as A, the crowd never aims for the dough | 30 | 1 / 1 / 28 | 0.05 (± 0.04) | 36 | 2.10 | 2.00 (p 26, n 17, b 11, r 5, q 1) | 0.03 | 4.80 | 1.30 |
| C | 2 | as A, placed reachably (`doughReach` "any") | 24 | 0 / 3 / 21 | 0.06 (± 0.03) | 38 | 1.88 | 1.46 (p 12, n 13, b 8, r 1, q 1) | 0.42 | 3.71 | 1.21 |
| D | 2 | as C, `doughDrops` 2 | 24 | 0 / 0 / 24 | 0.00 (± 0.00) | 37 | 1.62 | 1.38 (p 13, n 8, b 9, r 3) | 0.25 | 3.29 | 1.38 |
| E | 2 | as C, `doughLeadMax` 1 | 24 | 0 / 4 / 20 | 0.08 (± 0.04) | 44 | 1.00 | 1.00 (p 24) | 0.00 | 1.00 | 1.75 |
| F | 3 | as C, `doughLeadMax` 3 | 24 | 0 / 1 / 23 | 0.02 (± 0.02) | 38 | 1.46 | 1.29 (p 22, n 6, b 3) | 0.17 | 2.04 | 1.29 |
| G | 3 | as C, `doughLeadMax` 2 | 24 | 0 / 0 / 24 | 0.00 (± 0.00) | 41 | 1.50 | 1.38 (p 32, b 1) | 0.12 | 1.46 | 1.62 |
| H | 2 | as G | 20 | 2 / 2 / 16 | 0.15 (± 0.07) | 45 | 1.10 | 0.90 (p 14, n 2, b 2) | 0.20 | 1.30 | 1.60 |
| I | 4 | as G, a queen's free of the guard (the kind rolled among the allowed ones) | 20 | 0 / 1 / 19 | 0.03 (± 0.02) | 38 | 1.25 | 1.20 (p 16, n 1, b 1, q 6) | 0.05 | 3.80 | 1.65 |
| J | 5 | as I | 20 | 0 / 2 / 18 | 0.05 (± 0.03) | 41 | 1.40 | 1.30 (p 20, b 1, q 5) | 0.10 | 3.40 | 1.60 |
| K | 4 | **shipped**: as G, the kind rolled over all the odds, stepping down; a queen's (4%) free of the guard | 20 | 0 / 0 / 20 | 0.00 (± 0.00) | 40 | 1.40 | 1.20 (p 21, n 1, b 1, q 1) | 0.20 | 1.80 | 1.60 |
| L | 5 | **shipped** | 20 | 1 / 2 / 17 | 0.10 (± 0.06) | 45 | 1.10 | 1.05 (p 17, b 1, q 3) | 0.05 | 2.35 | 1.65 |

## What it says

- **Free material decides these battles,** as with Timber: with no guard (A to D) he raised 3.3 to 4.8 pawns a battle, minor pieces
  half the time, and the crowd scored 0.00 to 0.06.
- **The lead guard does it:** a lump only while its piece leaves him at most 2 pawns ahead (G, H, K, L) brings it to 1.3 to 2.4
  pawns a battle, mostly pawns (he rebuilds what he lost), Eric's "a pawn and a half to maybe 1 knight".
- **A queen now and then:** freeing the queen's lump from the guard while rolling among the allowed kinds made it the usual pick
  when level (I, J: a queen in 11 of 40). Rolled over all the odds and stepping down instead (K, L), a queen comes at its own 4%:
  4 of 40 battles, Eric's "on occasion". The bots don't plan a squash; a crowd has 8 moves to reach a queen's lump.
- **Placed reachably** (C) the squash rule found five times as many squashes as out of reach (A): Eric's "you're not going to have
  too much trouble squashing his pieces". The bots still squash rarely (they only take a cheap one that's there now).
- **Gold Plate** came 1.6 times a battle at `rageSpeed` 1 (capped at 2). It takes little by itself here: the bots' engine search
  rarely wants to take his queen with a pawn; against people it should matter more.
