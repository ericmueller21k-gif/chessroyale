# Chandy's calibration: the locks, the rifle and Dodge (Nov 16, 2026)

Chandy (id `chandy`; docs/decisions/2026-11-16-chandy-rules.md; Eric's design: `DESIGN.md` on branch `stills/boss-chandy`). From
the game so far. **Lock-on:** crosshairs on your most capturable pieces, his engine steered to take them; each one taken is an
upgrade (5), each unlocking a move his meter fires every 6 crowd moves. **Dodge** (the rage meter, from 5 upgrades): 3 rounds of a
3 s vote while clones teleport; one hit ends the battle.

The aims (the brief, L1, L4, L5): his crowd score inside the pack; 5 upgrades in at least 9 battles in 10, the fifth by about move
35; if fewer, raise L3's steering margins before changing the rule.

**Shipped (run B, 32 battles): offset −250, `takeMargin` 2, `chaseMargin` 0.75 (raised from the design's 1.5 and 0.5 by L5),
`lockLines` 5, the lock numbers as designed (first from his 3rd move, hunt 3, live 5, 2 at once, the second 2 turns after),
`meterEvery` 6, `rageSpeed` 1, `maxUltimates` 2: the crowd scores 0.12 (± 0.05) in 47 moves; 5 upgrades in 30 battles of 32
(94%), the fifth at move 30.5 (median).** In the pack: Don Dough 0.05, Dash 0.15, Puddles 0.17, the plain boss 0.10.

## How: the raid sim

`npx tsx packages/sim/scripts/boss-sim.ts raid chandy 8 <seed> 0 <tag>`, four processes side by side (seeds 11 to 14); a crowd of
bots, the boss at tier 1600 − 250 = 1350. His queen lock is played as the game does (`playQueenLock`: the pass guard may have it
wait); Dodge's rounds take the bots' votes (`finishDodgeRound`). Each row logs every lock, upgrade, fired move, queen lock (aimed or
waiting) and its shot, and each Dodge (`reports/boss-sim/raid-chandy*.jsonl`).

| Run | Margins (take / chase) | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves | 5 upgrades | Fifth at (median) | First upgrade (median) | Locks a battle | Moves fired a battle | Queen locks (waits) | Dodges (hits) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 1.5 / 0.5 (the design) | 32 | 0 / 6 / 26 | 0.09 (± 0.03) | 45 | 28 (88%) | 30 | 7 | 21.0 | 5.4 | 9 (12) | 11 (0) |
| **B** | **2 / 0.75** | 32 | 2 / 4 / 26 | **0.12** (± 0.05) | 47 | **30 (94%)** | 30.5 | 7 | 21.6 | 5.8 | 11 (39) | 14 (0) |

## What it says

- **The rifle comes whole.** With B's margins, 30 battles of 32 reach 5 upgrades; of battles lasting 35 moves or more, 26 of 27.
  The two that didn't ended early (27 and 37 crowd moves, both with 4). Run A missed the 9-in-10 line by two battles; at 32
  battles the difference is within noise, but B's direction is L5's and it costs his strength little.
- **His strength.** The steering costs him a little: the crowd's score moves from 0.09 to 0.12 with the wider margins, and stays
  inside the pack. An offset further down changes nothing (1350 is Stockfish's floor here, as in every boss's sims).
- **Dodge** comes in 13 battles of 32 (once in each but one), around crowd move 48. **The bots never get hit:** each finds the safe
  square 60% of the time, so a crowd of bots always votes it in. Real crowds will be hit sometimes; the sim can't say how often.
- **The queen lock** aims 11 times; the bots never block (the judge doesn't know the rule), so the shot takes the queen 7 times.
  People will block it. The pass guard has it wait 39 times in 9 battles; while it waits, his meter holds (no other move fires).
  Worth watching in playtests: if it stalls his meter too long, the meter could pick again after a wait (not done here: it
  changes the design's meter, Eric's call).
