# Chandy's calibration: the locks, the rifle and Dodge (Nov 16, 2026)

Chandy (id `chandy`; docs/decisions/2026-11-16-chandy-rules.md; Eric's design: `DESIGN.md` on branch `stills/boss-chandy`). From
the game so far. **Lock-on:** crosshairs on your most capturable pieces, his engine steered to take them; each one taken is an
upgrade (5), each unlocking a move his meter fires every 6 crowd moves. **Dodge** (once a battle; his rage full 3 crowd moves after
the fifth upgrade, or at once when the crowd can mate him): a warning volley, then 3 rounds of a 3 s vote while clones teleport; the
second hit ends the battle (one hit until run D).

**Run H (Nov 24): the hunt after his taught upgrades and the Lock-on Shot's victim: the calibration's crowd scores 0.03 before and
after; a player like Eric reaches 4 or more upgrades by crowd move 30 in 19 battles of 20 (was 14), scoring 0.17 both (below).**

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

**Run F (Nov 18, Eric's two changes; docs/decisions/2026-11-18-chandy-move-mix.md):** his first two captures each locked and an
upgrade (`teachCaptures` 2), and the queen lock his first unlock while you have a queen (`queenLockFirst`). 5 battles each on seeds
11 to 14, no switches; before: run E's after rows (seeds 11, 12) and `raid-teachBeforeN13/14`; after: `raid-teachAfterN11-14`.

| Run F (20 battles each) | Upgrade 1 / 2 / 3 / 5 (median crowd move) | 5 upgrades | Queen lock first unlock | Queen lock aimed | Pass guard waits | Crowd: draws / boss wins |
|---|---|---|---|---|---|---|
| Before | 6.5 / 15.5 / 21.5 / 25.5 | 18 | 3 | 6 times, in 5 battles (0.3 a battle) | 4 | 2 / 18 |
| After | 8 / **11** / **18.5** / 27 | 18 | **20** | **18 times, in 14 battles (0.9 a battle)** | 12 | 2 / 18 |

**Run G (Nov 18, the review of #797's follow-up; docs/decisions/2026-11-18-chandy-queen-lock-first.md):** battles where his first
unlock (the queen lock) never fired before upgrade 2. Before: run F's after rows (`raid-teachAfterN11-14`). G1: the queen lock first
only when it could come then (`queenLockAim` on the board after his capture; `raid-okOnlyN11-14`). G2: that, and a queen lock the pass
guard refuses, with nothing else unlocked, due again on his next turn (it emptied the meter; `raid-firstAfterN11-14`). 5 battles each
on seeds 11 to 14, no switches.

| Run G (20 battles each) | Never fired before upgrade 2 (upgrade 2 the very next turn) | Why | Queen lock first unlock | Aimed (battles) | Pass guard waits | Upgrade 1 / 2 / 3 / 5 (median crowd move); 1 to 2 | Crowd: draws / boss wins |
|---|---|---|---|---|---|---|---|
| Before | 10 (4) | the guard refused it, then the meter emptied: all 10 | 20 | 18 (14) | 12 | 8 / 11 / 18.5 / 27; 3.5 | 2 / 18 |
| G1 | 10 (4) | the guard: 8; it couldn't come: 2 | 20 | 17 (15) | 13 | 7.5 / 10.5 / 19 / 28; 2.5 | 2 / 18 |
| **G2** | **5 (4)** | upgrade 2 the next turn (the guard kept his capture): 4; the guard four turns running: 1 | 20 | 20 (15) | 10 | 9 / 14 / 19 / 26.5; **5** | 0 / 20 |

G1's check never changed an unlock here (the bots' queen always had a save at his first capture); it covers the review's case (a
queen with nothing to shield her), which the unit test pins. Without upgrade 2 the very next turn: 6 battles of 16 before, 6 of 15
with G1, **1 of 16 with G2**. The trade: the aim is his whole turn, so upgrade 2 comes later (1 to 2: 5 of your moves, median, was
3.5); upgrades 3 and 5 didn't move. The crowd's results are within noise (20 battles; the sims vary run to run: upgrade 1, which
neither change touches, moved from 8 to 9).

**Run H (Nov 24, the hunt, the Lock-on Shot's victim; docs/decisions/2026-11-24-chandy-upgrades.md).** Eric, a deep endgame with
his rifle at 2 upgrades: "the only 2 we got were the ones that we force him to get ... he ended up just doing the queen shot 3 times."
Measured first, on main (`raid-chandyHb0-2`, `raid-chandyEb`; the sim now logs each hunting move, each crowd move against a lock he
could win, and how each lock ended), then after (`raid-chandyHa0`, `Ha2`, `Ea`). 5 battles each on seeds 11 to 14, `"pickSec":5`
(Eric's pace; it changes nothing for Chandy). Four crowds: **the bots** (the calibration's); **bots that heed** the crosshairs as a
person sees them (`"heed":1`: with a locked piece he can win, the whole crowd plays its best move that saves it within a pawn; with
the shot aimed, its best block); **stronger bots that heed** (`"botLevel":1800`); and **a player like Eric** (`"alone":true,
"best":true,"tier":2400`: Boss alone, one player who plays the engine's best move, heeds the crosshairs and finds Dodge's safe
square, against the boss at 2150: games run to the sim's 60 moves, as Eric's did).

Why his locks rarely became upgrades (before; hunting moves: his moves with a lock he hunts; "a trade outside them": a capture of a
locked piece outside his top 5 lines, netting him at least −1 pawn, within 2 pawns of his best by the engine):

| Crowd (before) | Battles | Hunting moves | No capture of a locked piece | A capture in his top 5 lines, within 2 pawns | A trade outside them | His takes | Crowd moves vs a lock he could win: moved away / guarded / left | Locks ended: taken / escaped / too old / shot | Shots that hit a piece |
|---|---|---|---|---|---|---|---|---|---|
| Bots | 20 | 429 | 174 (41%) | 137 | 44 | 114 | 33 / 28 / 77 | 114 / 125 / 5 / 2 | 33 of 33 |
| Bots that heed | 20 | 507 | 253 (50%) | 131 | 25 | 107 | 57 / 63 / 38 | 107 / 164 / 7 / 2 | 31 of 31 |
| Stronger bots that heed | 20 | 660 | 361 (55%) | 125 | 34 | 94 | 72 / 85 / 36 | 94 / 225 / 16 / 9 | 31 of 31 |
| A player like Eric | 20 | 861 | 519 (60%) | 112 | 20 | 105 | 107 / 136 / 40 | 105 / 315 / 16 / 7 | 24 of 25 |

The more the crowd sees the crosshairs, the more locks escape (Eric-like: 315 escaped for 105 taken) and the more of his hunting
moves have nothing to take (60%). His steering only took a trade inside his top 5 lines; an escaped lock sat on its safe piece for up
to 3 of his turns; and the queen lock's shot hit a piece nearly every time it fired, never an upgrade. Against the bots none of this
showed: they lose pieces anyway (5 upgrades in 19 battles of 20 before any change). Lock ends from the sim's view (`ended`), by why
each lock went; "steering found nothing in lockLines" is the "no capture" column plus the captures outside his top lines.

Before and after (the crowd's score: wins plus half the draws; upgrades by crowd move 25 and 30: the median, and the battles with 4 or
more of those that lasted so long; shatters: locks the shot shattered, each an upgrade after):

| Run H | Battles | Crowd wins / draws / boss wins | Crowd score | Crowd moves (median) | Upgrades by move 25 | By move 30 | Upgrade 3 / 5 (median crowd move) | 5 upgrades | His takes a battle | Shatters of a lock |
|---|---|---|---|---|---|---|---|---|---|---|
| Bots, before | 20 | 0 / 1 / 19 | 0.03 (± 0.02) | 37.5 | 4 (13 of 20) | 5 (15 of 19) | 20 / 27 | 19 | 5.7 | 2 |
| **Bots, after** | 20 | 0 / 1 / 19 | **0.03 (± 0.02)** | 37.5 | 5 (18 of 20) | 5 (19 of 19) | 12 / 21 | 20 | 7.8 | 13 |
| Stronger, heeding, before | 20 | 0 / 2 / 18 | 0.05 (± 0.03) | 47 | 3 (6 of 20) | 4 (11 of 18) | 20.5 / 32.5 | 18 | 4.7 | 9 |
| **Stronger, heeding, after** | 20 | 0 / 1 / 19 | 0.03 (± 0.02) | 42.5 | **5 (16 of 20)** | 5 (17 of 18) | 15 / 24 | 19 | 6.5 | 19 |
| Like Eric, before | 20 | 1 / 5 / 14 | 0.17 (± 0.06) | 60 | 3.5 (10 of 20) | 4.5 (14 of 20) | 17 / 30 | 19 | 5.2 | 7 |
| **Like Eric, after** | 20 | 2 / 3 / 15 | **0.17 (± 0.07)** | 60 | 4 (13 of 20) | **5 (19 of 20)** | 13.5 / 27 | 19 | 6.0 | 14 |

- **The target** (the director's: typically 4 to 5 upgrades by the late middlegame, his strength in his band): by crowd move 30, 4 or
  more in 19 battles of 20 for the player like Eric (was 14) and 17 of 18 for the heeding crowd (was 11); his third upgrade comes 3.5
  to 8 crowd moves sooner in every crowd.
- **His strength:** the calibration's crowd (the bots) scores 0.03 before and after, the same wins, draws and losses (run D's 0.02,
  the pack's 0.05 to 0.17); the Eric-like player 0.17 both; the heeding crowd 0.05 to 0.03 (one draw fewer in 20, within noise). The
  hunt's trades cost him little by the engine (within 2 pawns, never into a mate), and the upgrades they buy pay it back.
- **Where the upgrades come from:** more takes a battle (bots 5.7 to 7.8, Eric-like 5.2 to 6.0, the first two taught captures
  included) and the shot's shatters of its locked piece (Eric-like 7 to 14 in 20 battles; the bots 2 to 13).
- The sim's player like Eric still loses more pieces than Eric did (19 battles of 20 reach 5 upgrades before too): it stands in for
  a player who doesn't blunder and saves what's marked, not for Eric's own game. Real play will say more; `huntLoss` and
  `takeMargin` are the knobs (settings.ts).

`npx tsx packages/sim/scripts/boss-sim.ts raid chandy 5 <seed> 0 <tag> '<patch>'`, seeds 11 to 14, patches: `{"pickSec":5}`;
`{"pickSec":5,"heed":1}`; `{"pickSec":5,"heed":1,"botLevel":1800}`; `{"pickSec":5,"heed":1,"alone":true,"best":true,"tier":2400}`.
The before rows ran on main at f7e9936 (the sim's logging only) in a worktree.

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
