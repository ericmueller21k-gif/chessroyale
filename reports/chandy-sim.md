# Chandy's calibration: the locks, the rifle and Dodge (Nov 16, 2026)

Chandy (id `chandy`; docs/decisions/2026-11-16-chandy-rules.md; Eric's design: `DESIGN.md` on branch `stills/boss-chandy`). From
the game so far. **Lock-on:** crosshairs on your most capturable pieces, his engine steered to take them; each one taken is an
upgrade (5), each unlocking a move his meter fires every 6 crowd moves. **Dodge** (once a battle; his rage full 3 crowd moves after
the fifth upgrade, or at once when the crowd can mate him): a warning volley, then 3 rounds of a 3 s vote while clones teleport; the
second hit ends the battle (one hit until run D).

The aims (the brief, L1, L4, L5): his crowd score inside the pack; 5 upgrades in at least 9 battles in 10, the fifth by about move
35; if fewer, raise L3's steering margins before changing the rule. Run C's (Nov 16): Dodge in at least 85% of battles.

**Run D (Nov 16, round 2, docs/decisions/2026-11-16-chandy-first-lock.md): his first capture locked and upgrade 1; a new unlock fires
at once; Dodge's warning volley and two hits: 5 upgrades in 29 battles of 32, the fifth at move 26; Dodge in 25 of 32; the crowd
scores 0.02 (± 0.02).** Before it, **shipped (run C, 32 battles; Nov 16, Eric's Dodge change, docs/decisions/2026-11-16-chandy-dodge-once.md): Dodge once a battle,
his rage full `dodgeAfterMoves` 3 of your moves after the fifth upgrade, the last chance; offset −250, `takeMargin` 2, `chaseMargin`
0.75, `lockLines` 5, the lock numbers as designed, `meterEvery` 6: Dodge in 25 battles of 32 (78%; the aim was 85%), the crowd
scores 0.09 (± 0.05) in 44 moves; 5 upgrades in 28 battles of 32 (88%), the fifth at move 31 (median).** In the pack: Don Dough
0.05, Dash 0.15, Puddles 0.17, the plain boss 0.10. (Run B shipped first: the rage meter filling as every boss's, twice at most.)

**Run E (Nov 18, his move mix; docs/decisions/2026-11-18-chandy-move-mix.md):** Eric, after a real game: "he literally had all 5 but
kept spamming the scatter shot ... he randomly skipped one entirely". The same sim, 5 battles each on seeds 11 and 12, and 5 each on
13 and 14 with all five moves from the start (`'{"test":"dodge"}'`), before (main at af1fc97) and after (`meterOrder`): the rows
`raid-mixBefore*` and `raid-mixAfter*`, each pick and landing traced by a hook in chandy.ts kept out of the code:

| Run E | His moves a battle | One move half or more of a battle's moves | Top move's share (median) | Queen lock landed | Twice in a row while another could come |
|---|---|---|---|---|---|
| Normal, before | 7.4 | 3 battles of 10 | 0.40 | 1 battle of 10 (picked 3 times, 2 waited) | 0 (4 with one move to fire) |
| Normal, after | 7.8 | **0 of 10** | **0.29** | **4 of 10** (picked 7, 2 waited) | 0 (8 with one move to fire) |
| All five, before | 6.4 | 0 of 9 | 0.40 | 4 of 10 | 1 (3 picks couldn't land) |
| All five, after | 5.0 | 0 of 8 | 0.25 | 6 of 10 | 0 (2 couldn't land) |

The queen lock could come on 41% of the crowd's turns from the first upgrade (74% of those with a queen; the bots had her on 55%):
it was rare because it was one random pick among four or five every sixth move, not by its own rule. The crowd's results didn't move
(normal: 1 win before, 2 draws after; all five: the boss won all 20; the all-five battles ran 27 crowd moves (median) after, 41
before: 10 battles each, within noise). A stand-in engine's 80 battles (both sides, before) had 66 picks of 834 that couldn't land,
19 of 30 repeats breaking the rule: the fallback was a random other move, his last one included.

## How: the raid sim

`npx tsx packages/sim/scripts/boss-sim.ts raid chandy 8 <seed> 0 <tag>`, four processes side by side (seeds 11 to 14); a crowd of
bots, the boss at tier 1600 − 250 = 1350. His queen lock is played as the game does (`playQueenLock`: the pass guard may have it
wait); Dodge's rounds take the bots' votes (`finishDodgeRound`). Each row logs every lock, upgrade, fired move, queen lock (aimed or
waiting) and its shot, and each Dodge, `last` marking a last chance's (`reports/boss-sim/raid-chandy*.jsonl`).

| Run | Margins (take / chase) | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves | 5 upgrades | Fifth at (median) | First upgrade (median) | Locks a battle | Moves fired a battle | Queen locks (waits) | Dodges (hits) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 1.5 / 0.5 (the design) | 32 | 0 / 6 / 26 | 0.09 (± 0.03) | 45 | 28 (88%) | 30 | 7 | 21.0 | 5.4 | 9 (12) | 11 (0) |
| B | 2 / 0.75 | 32 | 2 / 4 / 26 | 0.12 (± 0.05) | 47 | 30 (94%) | 30.5 | 7 | 21.6 | 5.8 | 11 (39) | 14 (0) |
| C (Dodge once, 3 moves after the fifth; the pass guard's M1) | 2 / 0.75 | 32 | 2 / 2 / 28 | 0.09 (± 0.05) | 44 | 28 (88%) | 31 | 7 | 20.8 | 5.5 | 7 (7) | 25 (0) |
| **D** (Nov 16, round 2: his first capture is his first lock; a new unlock fires at once; Dodge's two hits) | **2 / 0.75** | 32 | 0 / 1 / 31 | **0.02** (± 0.02) | 43 | **29 (91%)** | **26** | 7 | 18.5 | **7.7** | 19 (14) | **25 (0)** |

## What it says

- **Run D (Nov 16, Eric's round 2; `reports/boss-sim/raid-chandyD.jsonl`, seeds 11 to 14 as before):** every battle's first lock was
  his first capture (32 of 32, at crowd move 7, median), and each was upgrade 1. **5 upgrades: 29 battles of 32 (91%, was 88%), the
  fifth sooner (move 26, was 31).** A new unlock firing at once adds about two moves a battle (7.7, was 5.5), the queen lock most
  (19 aimed, was 7). **Dodge: 25 battles of 32 (78%, unchanged)**, 4 crowd moves after the fifth upgrade as before. The crowd's score
  fell to 0.02 (± 0.02; 0 wins, 1 draw), now under the pack's lowest (Don Dough 0.05): within two standard errors of run C's 0.09,
  but the extra moves point the same way. Worth watching in real play; `fireOnUnlock` false turns it off.
- **Dodge's two hits:** a crowd of bots still never gets hit (the plurality of 60% voters is the safe square), so the sim can't
  measure it. Alone, finding the safe square 60% of the time (the bots' rate), one hit lost 78% of Dodges (1 − 0.6³); two hits
  lose 35% (3 × 0.4² × 0.6 + 0.4³). At 80% a round: 49% before, 10% now. Dodge lasts about 28 s survived (was 20 s), 31.6 s at
  most when the second hit comes in the last round.

- **Run C (Dodge once, 3 moves after the fifth upgrade):** Dodge in 25 battles of 32 (78%), always 4 crowd moves after the fifth
  upgrade (3 to fill, the warning's turn), at crowd move 35 (median; run B's came at 48, in 13 battles). Every battle whose rifle
  came whole and that lasted 4 more moves had it (25 of 28). The 7 without: 4 never had the rifle whole (the boss won by crowd move
  20, 28, 37 and 47), 3 ended within 3 moves of the fifth upgrade (the boss won). From the same rows, `dodgeAfterMoves` 1 or 2 would
  have given 26 (81%), 0 (the warning as the fifth upgrade shows) 28 (88%); the rest need the rifle whole sooner. The sim's crowd
  of bots loses 28 battles of 32, so it ends battles sooner than people do. No last-chance Dodge came (the bots never had a mate in
  one first). The pass guard's waits fell from 39 to 7 (M1: after a wait the meter picks another move).

- **The rifle comes whole.** With B's margins, 30 battles of 32 reach 5 upgrades; of battles lasting 35 moves or more, 26 of 27.
  The two that didn't ended early (27 and 37 crowd moves, both with 4). Run A missed the 9-in-10 line by two battles; at 32
  battles the difference is within noise, but B's direction is L5's and it costs his strength little.
- **His strength.** The steering costs him a little: the crowd's score moves from 0.09 to 0.12 with the wider margins, and stays
  inside the pack. An offset further down changes nothing (1350 is Stockfish's floor here, as in every boss's sims).
- **Dodge** (run B: its meter as every boss's) comes in 13 battles of 32 (once in each but one), around crowd move 48. **The bots never get hit:** each finds the safe
  square 60% of the time, so a crowd of bots always votes it in. Real crowds will be hit sometimes; the sim can't say how often.
- **The queen lock** aims 11 times; the bots never block (the judge doesn't know the rule), so the shot takes the queen 7 times.
  People will block it. In run B the pass guard had it wait 39 times in 9 battles, his meter held meanwhile; since run C a wait has
  the meter pick another move (the design's own rule), and it waited 7 times.
