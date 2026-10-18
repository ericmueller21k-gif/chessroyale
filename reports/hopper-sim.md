# Chub & Chirp's calibration: Leapfrog (Oct 18, 2026)

Chub & Chirp (id `hopper`), a rabbit riding a grasshopper. Their passive, Leapfrog (docs/decisions/2026-10-18-hopper-leapfrog.md):
at the start of his turn, a pawn of his standing nose to nose with one of the crowd's hops over it to the empty square
beyond (never the back rank, never a pinned pawn, never giving check). Eric left one thing to the sim (Oct 18): "He
still makes his move, unless it's too strong. Let the sim figure it out. Likely could be 3 hops in total if it uses a
turn." So two variants:

- **A:** the hop comes at the start of his turn, then he plays his normal move. At most 2 hops a battle.
- **B:** the hop **is** his move that turn (as Alfil's fusion, V1). At most 3 hops a battle.

The rule set for the choice: take A if he lands in the pack (a crowd score of about 0.08 to 0.55, battles of about 33 to
57 crowd moves), else B; neither, back to the director.

**The result: A, at an offset of −250.** The crowd scores **0.31** (± 0.08, 26 battles) in **40** crowd moves: in the
pack, near its middle. B is far too weak for him: the crowd scores 0.77.

## How it was run

The raid sim, as for Alfil: a Solo raid of 50 bots against him through the match runner, one battle per seed, seeds 1
to 13 (`a`) and 31 to 43 (`b`), no strikes, **the meter off** (his ultimate isn't decided: it never comes and his meter
shows nothing, so every row has 0 ultimates). `packages/sim/scripts/boss-sim.ts raid hopper 1 <seed> 0 <tag> [patch]`;
the rows are in `reports/boss-sim/raid-<tag>.jsonl`. Score: the crowd's result per battle (a win 1, a draw ½); ± is one
standard error. Both variants ran on the same code (commit eb678d7, B through `{"powers": {"hopIsMove": true, "hopMax":
3}}`); B's switch was taken out once the sim turned it down, and A plays exactly as it did in these runs.

**His strength:** the bots' tier is 1600. At −250 he plays at Stockfish's UCI_Elo 1350, at −100 at 1500, slipping to a
random legal move 25% of the time at both (every boss this far under its tier does). **Not repeatable seed for seed**
(Stockfish draws its limited-strength moves from the clock: reports/engine-reader.md), so runs compare by their totals.

## The table

| Run | Variant | Offset (his Elo) | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Crowd moves: mean (range), median | Hops a battle | Battles with 0 / 1 / 2 / 3 hops | Hops with a choice of pawns |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **hopAa, hopAb** | **A: the hop, then his move; at most 2 (adopted)** | **−250 (1350)** | 26 | 6 | 4 | 16 | **0.31** (± 0.08) | 0.23 / 0.38 | **40** (8-60), 37 | 1.54 | 2 / 8 / 16 / 0 | 1 of 40 |
| hopA100a, hopA100b | A | −100 (1500) | 26 | 4 | 4 | 18 | 0.23 (± 0.07) | 0.19 / 0.27 | 37 (12-60), 34 | 1.54 | 3 / 6 / 17 / 0 | 5 of 40 |
| hopBa, hopBb | B: the hop is his move; at most 3 | −250 (1350) | 26 | 18 | 4 | 4 | 0.77 (± 0.07) | 0.65 / 0.88 | 49 (22-60), 53.5 | 2.19 | 2 / 3 / 9 / 12 | 6 of 57 |

The pack, the same sim (reports/alfil-sim.md): 0.04 (Jefferson) to 0.79 (Hollow) on Oct 15, battles of 33 to 57 crowd
moves; on today's code Big Boy 0.35, Sawyer 0.15, Alfil 0.23 (0.15 after his review round and landing guard).

## The hops that didn't come, and why

Each turn of his, every pawn of his nose to nose with one of the crowd's that couldn't hop, by why (`hopOptions`'s
reasons; `cap`: his hops were spent). A pawn that stays nose to nose counts again each turn, so these are pawn-turns,
not battles.

| Run | His turns with a pawn nose to nose | Of them, a hop | No hop | Square beyond taken | Back rank | Hops spent (cap) | He was in check | It would give check | It would give him a mate in one | Pinned | No move after it |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A, −250 | 215 | 40 | 175 | 53 | 94 | 35 | 6 | 4 | 3 | 0 | 0 |
| A, −100 | 151 | 40 | 111 | 44 | 10 | 53 | 8 | 10 | 2 | 0 | 0 |
| B, −250 | 248 | 57 | 191 | 101 | 6 | 140 | 13 | 25 | (no such rule in B) | 0 | 0 |

- **The back rank** is mostly a pawn that already hopped: on his 3rd rank (your 3rd) it stands nose to nose with your
  pawn on its 2nd, and the square beyond is your back rank, turn after turn (Eric's "no instant queen").
- **The cap** in B counts high because a B hop changed nothing he wanted: the crowd kept the pawns nose to nose.
- **The mate-in-one guard** (A only: the crowd never sees the hop before his move) stopped 5 hops in 52 battles.

## What it says

- **A lands in the pack** at both offsets: 0.31 at −250 and 0.23 at −100, in 40 and 37 crowd moves. The two are within
  one standard error of each other: at this tier both slip 25% of the time, and an offset moves him only from UCI_Elo
  1350 to 1500, so the sim can't tell them apart well.
- **−250, chosen:** its score is nearest the middle of the pack's band (0.08 to 0.55) and its battles nearest the
  middle of 33 to 57 moves; and it's where the bosses whose powers gain them something outside their moves sit (Big
  Boy, Sawyer, Wrangler, Alfil).
- **B is out of the pack, too weak for him:** 18 of 26 battles the crowd's, in 49 moves. A hop as his move spends his
  whole turn on a pawn move nobody chose for its merit: it's forced whenever a pawn can hop (a due hop can't be skipped,
  as Alfil's fusion), so a threat the crowd made goes unanswered for a turn, up to three times a battle.
- **How often:** he hops in 24 of 26 battles (A, −250), 1.54 hops a battle, the first at a median of the crowd's 3rd
  or 4th move (nose-to-nose pawns come early: 1.e4 e5 is one). Almost always only one pawn can (1 hop in 40 had a choice),
  so the engine's pick rarely has anything to choose.

## The fuzz (never an illegal position)

As #267's review fuzzed Alfil: 120 battles through the match runner on a stand-in engine (a hash for scores, a hashed
legal move for his), the crowd's moves at random (pawn moves first 60% of the time, so pawns meet), the test switch's
start in two battles of three, the crowd White and Black in turn, and the God King's strike called now and then. After
every crowd move, hop and move of his: a position the engine plays (`stockfishRefuses`), the side not to move never in
check, the replay from the bases equal to the board, no pawn on the first or eighth rank, no en passant square on a
piece, a move for the side to move or a real ending. After every hop: him still to move, his king not attacked, the en
passant square cleared, the fifty-move count at zero, castling and the move number unchanged, no move added, never the
back rank, never a second hop that turn, the strike left for his move; never more than two a battle. **238 hops, no
problem.** (The refusals there: the square beyond taken 833 pawn-turns, he was in check 276, it would give check 244,
the back rank 141, pinned 45, a mate in one 20; out of hops 2,412. A one-off script, as Alfil's probes; the unit test
`hopper.test.ts` runs a smaller version of it on every check.)
