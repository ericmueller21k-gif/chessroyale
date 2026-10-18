# Chub & Chirp's calibration: Leapfrog (Oct 18, 2026)

Chub & Chirp (id `hopper`), a rabbit riding a grasshopper. Their passive, Leapfrog (docs/decisions/2026-10-18-hopper-leapfrog.md):
at the start of his turn, a pawn of his standing nose to nose with one of the crowd's hops over it to the empty square
beyond (never the crowd's last two ranks, never one that frees a pinned pawn of his to promote, never a pinned pawn,
never giving check). Eric left one thing to the sim (Oct 18): "He still makes his move, unless it's too strong. Let the
sim figure it out. Likely could be 3 hops in total if it uses a turn." So two variants:

- **A:** the hop comes at the start of his turn, then he plays his normal move. At most 2 hops a battle.
- **B:** the hop **is** his move that turn (as Alfil's fusion, V1). At most 3 hops a battle.

The rule set for the choice: take A if he lands in the pack (a crowd score of about 0.08 to 0.55, battles of about 33 to
57 crowd moves), else B; neither, back to the director.

**The result: A, at an offset of −250.** With the review's fix (below), the crowd scores **0.31** (± 0.08, 26 battles)
in **40** crowd moves: in the pack, at its middle. B is far too weak for him: the crowd scores 0.77.

## The review's fix, and the re-run

The first A runs let a hop land on the crowd's 2nd rank. Under A his move comes straight after the hop, with no crowd
turn between, so from there his pawn could queen at once: the "instant queen" Eric ruled out (the review's line:
1.e3 e5 2.a3 e4 3.a4, a hop to e2, then exd1=Q, taking the queen as it queens). 8 of those runs' 80 hops landed there,
in 7 battles, all his wins (the rows don't log his next move, so how many queened isn't known); in the review's
position fuzz, 1 allowed hop in 7 let the hopped pawn promote on his very next move, 1 in 50 by taking the queen. Now a
hop never lands on the crowd's last two ranks (`lastRank`, `nextToLast`), and never frees a pinned pawn of his to
promote (`promote`: the hop's landing square blocking the pin). A re-ran on the same seeds at both offsets (tags
`hopN*`). The first A rows stay in the tables below, marked "before the fix", for comparison. B's rows stand as they
were: B was turned down before the fix, and under B the crowd moved between a hop and his next move.

## How it was run

The raid sim, as for Alfil: a Solo raid of 50 bots against him through the match runner, one battle per seed, seeds 1
to 13 (`a`) and 31 to 43 (`b`), no strikes, **the meter off** (his ultimate isn't decided: it never comes and his meter
shows nothing, so every row has 0 ultimates). `packages/sim/scripts/boss-sim.ts raid hopper 1 <seed> 0 <tag> [patch]`
(−100: the patch `{"offset": {"hopper": -100}}`); the rows are in `reports/boss-sim/raid-<tag>.jsonl`. Score: the
crowd's result per battle (a win 1, a draw ½); ± is one standard error. The first runs of both variants ran on one
commit (eb678d7, B through `{"powers": {"hopIsMove": true, "hopMax": 3}}`, a switch that exists at that commit only);
B's switch was taken out once the sim turned it down. The `hopN*` runs ran on the code as it is now: A with the fix.

**His strength:** the bots' tier is 1600. At −250 he plays at Stockfish's UCI_Elo 1350, at −100 at 1500, slipping to a
random legal move 25% of the time at both (every boss this far under its tier does). **Not repeatable seed for seed**
(Stockfish draws its limited-strength moves from the clock: reports/engine-reader.md), so runs compare by their totals.

## The table

| Run | Variant | Offset (his Elo) | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Crowd moves: mean (range), median | Hops a battle | Battles with 0 / 1 / 2 / 3 hops | Hops with a choice of pawns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **hopNa, hopNb** | **A: the hop, then his move; at most 2 (adopted, with the fix)** | **−250 (1350)** | 26 | 5 | 6 | 15 | **0.31** (± 0.08) | 0.38 / 0.23 | **40** (10-60), 38.5 | 1.50 | 0 / 13 / 13 / 0 | 1 of 39 |
| hopN100a, hopN100b | A, with the fix | −100 (1500) | 26 | 6 | 7 | 13 | 0.37 (± 0.08) | 0.27 / 0.46 | 41 (15-60), 36 | 1.42 | 4 / 7 / 15 / 0 | 2 of 37 |
| hopAa, hopAb | A, before the fix | −250 (1350) | 26 | 6 | 4 | 16 | 0.31 (± 0.08) | 0.23 / 0.38 | 40 (8-60), 37 | 1.54 | 2 / 8 / 16 / 0 | 1 of 40 |
| hopA100a, hopA100b | A, before the fix | −100 (1500) | 26 | 4 | 4 | 18 | 0.23 (± 0.07) | 0.19 / 0.27 | 37 (12-60), 34 | 1.54 | 3 / 6 / 17 / 0 | 5 of 40 |
| hopBa, hopBb | B: the hop is his move; at most 3 | −250 (1350) | 26 | 18 | 4 | 4 | 0.77 (± 0.07) | 0.65 / 0.88 | 49 (22-60), 53.5 | 2.19 | 2 / 3 / 9 / 12 | 6 of 57 |

The pack, the same sim (reports/alfil-sim.md): 0.04 (Jefferson) to 0.79 (Hollow) on Oct 15, battles of 33 to 57 crowd
moves; on today's code Big Boy 0.35, Sawyer 0.15, Alfil 0.23 (0.15 after his review round and landing guard).

## The hops that didn't come, and why

Each turn of his, every pawn of his nose to nose with one of the crowd's that couldn't hop, by why (`hopOptions`'s
reasons; `cap`: his hops were spent). A pawn that stays nose to nose counts again each turn, so these are pawn-turns,
not battles. "—": no such rule in that run.

| Run | His turns with a pawn nose to nose | Of them, a hop | No hop | Square beyond taken | Back rank | The rank before it | Hops spent (cap) | He was in check | It would give check | It would free a pawn to promote | It would give him a mate in one | Pinned | No move after it |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A with the fix, −250** | 257 | 39 | 218 | 53 | 14 | 53 | 103 | 15 | 3 | 0 | 0 | 0 | 0 |
| A with the fix, −100 | 248 | 37 | 211 | 58 | 29 | 136 | 39 | 14 | 3 | 0 | 3 | 0 | 0 |
| A before the fix, −250 | 215 | 40 | 175 | 53 | 94 | — | 35 | 6 | 4 | — | 3 | 0 | 0 |
| A before the fix, −100 | 151 | 40 | 111 | 44 | 10 | — | 53 | 8 | 10 | — | 2 | 0 | 0 |
| B, −250 | 248 | 57 | 191 | 101 | 6 | — | 140 | 13 | 25 | — | — | 0 | 0 |

- **The last two ranks** are a pawn of his left nose to nose with one of yours deep in your half, counted turn after
  turn: on your 3rd rank with yours on your 2nd (the back rank beyond), or on your 4th with yours on your 3rd (the rank
  before it).
- **Where the hops landed (A with the fix):** your 3rd, 4th or 5th rank, never your 2nd (before the fix: 8 of 80 on your
  2nd).
- **Freeing a pinned pawn** never came up in the sim; it's there because it can (a unit test builds one).
- **The cap** in B counts high because a B hop changed nothing he wanted: the crowd kept the pawns nose to nose.

## What it says

- **A lands in the pack with the fix**, at both offsets: 0.31 at −250 and 0.37 at −100, in 40 and 41 crowd moves.
- **The fix cost him little:** at −250 the crowd's score is where it was (0.31), and he still hops 1.50 times a battle
  (1.54 before).
- **The sim can't tell −250 from −100:** they're within one standard error, and their order flipped between the two
  rounds (0.31 and 0.23 before the fix, 0.31 and 0.37 after). At this tier both slip 25% of the time and differ only by
  UCI_Elo 1350 against 1500.
- **−250, kept:** its score is the middle of the pack's band (0.31; the band 0.08 to 0.55 has its middle at 0.315), and
  the fix didn't move it; its battles (40 moves) are inside 33 to 57, no different from −100's 41; and it's where the
  bosses whose powers gain them something outside their moves sit (Big Boy, Sawyer, Wrangler, Alfil).
- **B is out of the pack, too weak for him:** 18 of 26 battles the crowd's, in 49 moves. A hop as his move spends his
  whole turn on a pawn move nobody chose for its merit: it's forced whenever a pawn can hop (a due hop can't be skipped,
  as Alfil's fusion), so a threat the crowd made goes unanswered for a turn, up to three times a battle.
- **How often:** he hops in all 26 battles (A with the fix, −250), 1.50 hops a battle, the first at a median of the
  crowd's 3rd move (nose-to-nose pawns come early: 1.e4 e5 is one). Almost always only one pawn can (1 hop in 39 had a
  choice), so the engine's pick rarely has anything to choose.

## The fuzz (never an illegal position)

As #267's review fuzzed Alfil: 120 battles through the match runner on a stand-in engine (a hash for scores, a hashed
legal move for his), the crowd's moves at random (pawn moves first 60% of the time, so pawns meet), the test switch's
start in two battles of three, the crowd White and Black in turn, and the God King's strike called now and then. After
every crowd move, hop and move of his: a position the engine plays (`stockfishRefuses`), the side not to move never in
check, the replay from the bases equal to the board, no pawn on the first or eighth rank, no en passant square on a
piece, a move for the side to move or a real ending. After every hop: him still to move, his king not attacked, the en
passant square cleared, the fifty-move count at zero, castling and the move number unchanged, no move added, never the
back rank, never a second hop that turn, the strike left for his move; never more than two a battle. **238 hops, no
problem** (before the fix). (The refusals there: the square beyond taken 833 pawn-turns, he was in check 276, it would
give check 244, the back rank 141, pinned 45, a mate in one 20; out of hops 2,412. A one-off script, as Alfil's probes;
the unit test `hopper.test.ts` runs a smaller version of it on every check, now also checking the last two ranks and
that every promotion his move has after a hop, he had before it.)

**After the fix,** the review's position fuzz again (random pawn-heavy games; every position with a pawn of his nose to
nose with one of yours, each hop allowed checked), with two checks added: never the crowd's last two ranks, and no
promotion his move has after a hop that it didn't have before it, by any pawn. Two runs of 300 games: 33,093 positions
with a pawn of his nose to nose, 35,249 hops allowed, **no problem**: none on the last two ranks, none leaving his move a
promotion it didn't have (the review's run before the fix: 1 allowed hop in 7 did). The rank before the back rank
refused 9,470 pawn-turns; freeing a pinned pawn never came up at random.
