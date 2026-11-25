# Alfil sees his Mammoth Slam's pieces coming down (Oct 17, 2026)

Eric, after playing him: "Everything about him is awesome. Only one thing … can we make the engine think, the turn
before the pieces land, that they're there? Because he put his queen right where the pawn dropped next turn, and I
captured it for free and instantly won after being behind. I'm not sure if that would break the engine if it thinks
there are pieces there and they're not actually there, so it tries to do a capture …"

How it works now: [docs/areas/engine.md](../areas/engine.md) ("The landing guard") and his row on
[docs/areas/bosses.md](../areas/bosses.md). His rules: [2026-10-17-alfil-rules.md](2026-10-17-alfil-rules.md).

## What was wrong

His moves come from the engine (Stockfish at his strength or Maia, with the guards: `bossMoveFrom`), which sees only the
board as it is. The Slam's pieces aren't on it while they're up, so on his move just before they land he could put a
piece where they take it as they come down: Eric's queen, on a square his pawn attacked once it was back.

## What changed: the landing guard

- **His moves still come from the board as it is.** Legality never changes, so he can never try to take a piece that's
  still in the air (Eric's worry): every move weighed is one of his legal moves on this board. Only the *judging* of his
  move looks ahead.
- **When:** his move just before the pieces land (`landsAfterHisMove`: the crowd turn that begins after it is the one
  they're due), and his fusion when the fusion is his move that turn. Never on any other move.
- **How** (`landingGuard`, from `bossMoveFrom`'s new `ahead`): his pick, whatever picked it (Stockfish at his strength,
  a slip, the King's strike, Maia; not "best", Wrangler's scored reply), and the 4 highest scored moves
  (`slamGuardLooks`) of the top-8 search he already runs on this board are each played, then the pieces are put down
  exactly as the rules will (`landing`: each on its own square, or, when his move took it, the fallback square the rules
  pick for that position), and the position is searched at 30,000 nodes (`slamGuardNodes`), the crowd to move. If his
  pick gives away more than the blunder guard allows against the best of them (`bossMaxLoss` 10 points,
  `bossMaxLogitLoss` 1, the same measure, `withinGuard`), the best is played instead. Otherwise his pick stands, so Maia
  still plays like Maia unless its move walks into the landing. A move that ends the game is scored by its ending
  (nothing lands then).
- **His fusion** on that turn: its two squares are weighed with the pieces down too (`fuseFrom`'s `ahead`,
  `alfilBattle.fusionAhead`).
- **Never an illegal pick:** the last checks from #266 follow the guard unchanged (`bossMoveFrom` checks the move it
  returns against his allowed moves; the runner's `applyBossMove` checks whatever a host sends). A look ahead that fails
  for any reason leaves his pick as it was.
- **Online** (the host's device plays his move): the boss request carries the pieces (`land`, optional, with his move
  and his fusion only, never his cast or the Slam's pick), and the host judges with them. An app from before this
  ignores it and plays as before. The server is unchanged otherwise: it lands the pieces as ever.
- **The admins' line** on a Maia battle says "landing guard → Stockfish" when it played.

## Its cost

- **Nodes:** at most (`slamGuardLooks` + 1) × `slamGuardNodes` = 5 × 30,000 = **150,000**, on his one move just before
  each landing (4.1 positions on average in the sim: his pick is usually among his best four); **none** on any other
  move, and none with nothing up (tested: the same engine calls as before). His move's own searches are 250,000 for its
  top moves and 250,000 for Stockfish's pick at his strength, so the guard is under a third of that one move.
- **Time, measured here** (the lite single-thread WebAssembly build the browser loads, in Node, on this machine: about
  480,000 nodes a second in Chromium, `reports/deep-timing.md`): on 16 positions from the opening book with a Slam's
  lift taken off, the guard took **357 ms** (median; 424 ms at most), about 386,000 nodes a second with each search's
  start; his whole move went from 1.74 s to 2.21 s (median). In the sim's 41 looks (two sims at once on four cores): 358
  ms median, 574 ms at most.
- **On a phone:** at the speeds `reports/many-judges.md` models (a phone 350,000 nodes a second, an old phone 90,000),
  about **0.45 s** on a phone and **1.7 s** on an old one, at most, once a Slam. That's inside the move's own budget:
  the boss's thinking is already the engine's whole move (about 1.5 to 2 s on a phone at that speed), the online host
  has 15 s (`BOSS_TIMEOUT_MS`) before the server asks someone else, and Maia's 1.5 s limit is untouched (the guard runs
  after its answer).

## The sim (the raid sim, V1's seeds)

The raid sim (`boss-sim.ts raid alfil 1 <seed> 0 <tag> '{"counter":1}'`), 26 battles a run on V1's seeds (1 to 13 and 31
to 43), 50 bots at the Solo raid's tier; he plays at 1350 on Stockfish (the sim has no Maia). "Before" is today's main
(the review round's rules, not re-simulated since V1), "after" this branch:

| Run | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Moves (range) | Landings judged | Picks swapped |
|---|---|---|---|---|---|---|---|---|---|
| V1 (Oct 17, `v1a`/`v1b`, the rules before the review round) | 26 | 6 | 0 | 20 | 0.23 (± 0.08) | 0.31 / 0.15 | 32 (12-60) | | |
| Before: main (`l0a`/`l0b`) | 26 | 4 | 1 | 21 | **0.17** (± 0.07) | 0.12 / 0.23 | 33 (16-60) | | |
| After: the landing guard (`l1a`/`l1b`) | 26 | 3 | 2 | 21 | **0.15** (± 0.07) | 0.31 / 0.00 | 35 (16-60) | 41 | 10 |

- **He stays in the pack:** 0.15 against 0.17, the same within one standard error (the sim isn't repeatable seed for
  seed: Stockfish's moves at a set strength come from the clock, so the halves swing, 0.31 and 0.00 here). Above the
  0.08 the director gave as the line for leaving the pack.
- **The guard judged 41 moves** (one for each of the 42 lifts but one, lifted at move 57 of a battle that ended before
  they were due) **and swapped 10** (24%). The rows don't keep the positions, so how many of those the landing alone
  made bad, rather than a pick already near the guard's 10 points that the pieces' return pushed past it, isn't measured
  (the timing bench's 16 positions: 2 swapped). No fusion fell on a landing turn in these runs.
- Rows: `reports/boss-sim/raid-l0a.jsonl`, `raid-l0b.jsonl`, `raid-l1a.jsonl`, `raid-l1b.jsonl` (each look's pick, move,
  positions searched and time in `alfil.landing`). Report: [reports/alfil-sim.md](../../reports/alfil-sim.md), "The
  landing guard".

## My calls

- **Only his move just before the landing, not every move while they're up.** On the earlier moves he moves again before
  they land, so the move that matters is judged anyway; and judging those as if the pieces were already down would throw
  away what the Slam gives him, since the crowd really is without them for those turns (he'd defend against pieces that
  can't move yet, and stop pressing where they're missing). So the look ahead is exact (the landing really comes right
  after that move) and costs one move a Slam.
- **Maia's pick is judged too**, on that one move, though Maia below a level of 2400 plays with no guard (Eric). The
  brief's rule is about his pick, whichever brain made it, and Eric's queen was the brain's pick. Telling a Maia mistake
  the landing makes from one it would have made anyway would need another search of the board as it is; on one move a
  Slam it isn't worth the code. Every other move of Maia's is untouched.
- **The King's strike keeps its own wider guard** (15 points, 1.5 log-odds) on that move: its step back is the crowd's
  reward and isn't taken away for being one; only a strike's move that the landing makes far worse gives way.
- **The best of the moves weighed takes its place**, as the brief has it (not a slip). His own search's lines are
  already in hand, so the guard adds no top-8 search, only the 5 positions after the landing.
- **The margin is the blunder guard's**, not a new number: the same "boss mode, not idiot mode" rule, applied with the
  pieces down. Only the guard's reach (`slamGuardLooks`) and depth (`slamGuardNodes`) are new settings.
- **The judge is unchanged:** it still scores the crowd's moves on the board as it is ("The engine doesn't know they're
  coming back" stays true of the judge, as the FAQ says). The Slam's cap (`slamFrom`) already plays the turns out and
  puts the pieces down.
- **Not covered:** his cast (not his move: his move follows it and is judged on its own), and the early landing (they
  come down before his move then, so he sees them).
