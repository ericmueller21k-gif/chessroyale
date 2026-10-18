# A power that spends his whole turn waits when passing would lose material (Oct 18, 2026)

Eric, after a playtest: "I played vs the elephant and he left his queen hanging and next turn fused his pawns so I
captured his queen and won outright."

How it works now: [docs/areas/bosses.md](../areas/bosses.md) (Alfil's row and Chub & Chirp's Carrot Patch) and
[docs/areas/engine.md](../areas/engine.md) ("The pass guard"). Alfil's rules:
[2026-10-17-alfil-rules.md](2026-10-17-alfil-rules.md); the Carrot Patch: [2026-10-18-carrot-patch.md](2026-10-18-carrot-patch.md).

## What was wrong

Since V1 the fusion is Alfil's whole turn: the pawns fuse and the turn passes to the crowd with no move of his. Nothing
asked whether passing cost him anything. A check already held the fusion back (no fusion answers a check), and the
landing guard judged only the Slam's landing, so a queen left hanging when the fusion came due was simply lost: the
fusion came, the crowd took the queen. The sims had it too: of 153 fusions in the runs before this (V1's and the
landing guard's), 25 left him 2 pawns or more worse than before them by the engine's own measure (most of them 4 to 8
pawns: a piece or the queen left to be taken), and one 1.76.

The same flaw could hit any power that spends his turn. Chub & Chirp's Carrot Patch cast (#275) is the other one: the
cast passes the turn too.

## What changed: one rule for every power that spends his turn

- **The rule** (`passLoses`, `passScores`, `passAnswer`, `PASS_WAIT` in `packages/chess/src/bosses/base.ts`): when such
  a power is due and passing would lose real material, it waits a turn and he plays his normal turn instead. It's
  checked again on his next turn.
- **"Real material":** the engine's evaluation after the power (the crowd to move) is at least `passGuardPawns` (2)
  below his evaluation before it (him to move: so his best move's), in pawns of log-odds (`bouncePawnLogit`, the
  measure the bounce, the Slam and the drag already use).
- **On the host's engine** (solo: this device's; the sims: theirs). The server never searches: it asks the host with
  the boss request's new `pass` field and takes the answer `PASS_WAIT` ("wait") for that step only. With no engine
  anywhere, or no answer, the power comes as before.
- **Alfil's fusion:** no new search when it has two squares: the guard reads the searches its square's pick already
  makes (`fuseFrom`: the position before and each square's, `tusksNodes`); the best square's gain is the measure. With
  one square the host is now asked too (before, one square needed no engine). When the Slam's pieces land right after
  the fusion, the position before is weighed with them down as well as the squares (`landingAhead`, fuseFrom's
  `ahead`), so both sides of the comparison see the same board; before, only the squares were. A wait leaves the marks
  as they are (`passWait`, as a check does), and he plays his move; the counter (taking a marked pawn) works as ever.
- **The Carrot Patch's cast:** it had no search, so the host now searches the position before and after the pass at
  `passGuardNodes` (30,000) each (`castAnswer`; the carrots don't change the engine's evaluation). A wait keeps the
  warning and the admins' trigger as they are, the same way a check already did, so the "ultimate next turn" the screens
  show stays true; that turn he plays as usual (a Leapfrog hop if one is due, then his move).
- **Protocol:** `pass?: true` on the boss request (Alfil's fusion, with `fuse`; the cast, alone). An app from before
  this ignores it: the fusion's square as before, and for the cast a move of his, which isn't "wait", so the cast comes.

## Its cost

- **Alfil's fusion with two squares:** nothing more (its searches were already made). With one square: the host is asked
  where it wasn't, 2 searches at 30,000 nodes.
- **The Carrot Patch's cast:** 2 searches at 30,000 nodes, once a battle (more only if it waits).
- At the speeds `reports/many-judges.md` models (a phone 350,000 nodes a second, an old phone 90,000), 60,000 nodes is
  about 0.17 s on a phone and 0.7 s on an old one, inside the boss's thinking time that both steps already show, and far
  inside the host's 15 s (`BOSS_TIMEOUT_MS`).

## The sim (one run, Alfil)

The raid sim as before (`boss-sim.ts raid alfil 1 <seed> 0 <tag> '{"counter":1}'`), 26 battles on V1's seeds (1 to 13
and 31 to 43), 50 bots at the Solo raid's tier (1600); he plays at 1350 on Stockfish. One run, as the brief asked.

| Run | Battles | Crowd wins | Draws | Boss wins | Crowd score (± 1 s.e.) | Seeds 1-13 / 31-43 | Moves (range) | Fusions | Waits |
|---|---|---|---|---|---|---|---|---|---|
| The landing guard (Oct 17, `l1a`/`l1b`) | 26 | 3 | 2 | 21 | 0.15 (± 0.07) | 0.31 / 0.00 | 35 (16-60) | | |
| The pass guard (`pg1a`/`pg1b`) | 26 | 0 | 0 | 26 | **0.00** | 0.00 / 0.00 | 26.5 (17-40) | 51 (12 countered, 4 nowhere) | 9 |

- **He leaves the pack: 0.00, below the 0.08 line.** As the brief says, no sweep: this is reported for the director's
  call.
- **Why:** the guard waited 9 times in 7 battles. Eight of those passes would have cost him 6 pawns or more (his queen),
  one 2.6. Every one of those fusions came later (all 7 battles made both elephants); the longest wait was two turns in a
  row. In the six earlier runs (V1, the review round, the landing guard: 78 battles), 10 of the crowd's 13 wins came in a
  battle with a fusion that lost 2 pawns or more, nearly all of them a free queen; only 3 came without one. So the sim's
  crowd was winning mostly on this bug, and with it gone he wins at this tier. The threshold isn't what moved it: with 6
  pawns instead of 2, 8 of the 9 waits would have come all the same.
- **Not repeatable seed for seed** (about ± 0.07 at 26 battles), but 0 of 26 against 3 wins and 2 draws is in line with
  the cause above.
- **Levers, not tried** (one run, no sweep): his offset is no lever at this tier (he's already at Stockfish's floor,
  reports/alfil-sim.md). The earlier tuning's variants (one elephant a battle, `tusksMax` 1; his first cast later; the
  elephant on the less advanced square) were all measured before this guard, and `tusksMax` 2 is Eric's number.
- Rows: `reports/boss-sim/raid-pg1a.jsonl`, `raid-pg1b.jsonl` (each wait's crowd move and gain in `alfil.waits`).
  Report: [reports/alfil-sim.md](../../reports/alfil-sim.md), "The pass guard".

## My calls

- **2 pawns.** The fusion itself gains him about a pawn (two pawns become a bishop) and a pass costs a tempo, so a pawn
  left hanging nets out near zero and shouldn't stop it, while a minor piece left hanging nets about −2 and the queen far
  more. In the earlier sims the fusions' gains split cleanly there: 25 at −2.04 or below, one at −1.76, the rest at 0 or
  above. One number in `settings.ts`, so a playtest can move it.
- **Measured against his evaluation before, not against a particular move.** The root search's evaluation is his best
  move's, so "after the pass, at least 2 pawns below before" is "at least 2 pawns worse than his best move". That also
  holds the power back when he has a tactic winning 2 pawns or more on the board (passing would throw that away too);
  that is losing real material by passing, by the brief's own measure, and it only delays the power.
- **No cap.** A cap would bring the bug back: after so many waits he'd fuse with his queen hanging. Nothing breaks
  without one: the counter stays open the whole time (each wait is another crowd turn to take a marked pawn), he plays
  real moves meanwhile, and a power that waits for good is a power that would have cost him. While his pawns stay marked
  no new cast comes (one at a time, as ever) and those crowd turns don't count for fair play (`powerTurn` while marked),
  as with the check wait; the sim's waits were short (two turns at most, above). A dishonest host could answer "wait"
  every time, but the host already plays his moves (any legal move), so that is no new power.
- **The God King's strike** on a fusion turn: the guard judges the engine's square, as the pick does. If the fusion
  waits, the strike isn't spent and hits his move instead, as a strike does.
- **Not covered:** his cast (his move follows it, judged on its own), the Slam (his move follows it), the hop (his move
  follows it). Only powers that end his turn need this.
- **Player-visible:** Alfil's FAQ says the fusion waits the same way when it would cost him 2 pawns' worth or more.
  Chub & Chirp have no FAQ words yet (their wiring PR adds them): those should say the cast waits too. No new line on
  screen: as with the check wait, the marks keep glowing (and the warning stays up) and he moves.

## Alfil's tuning after the guard (director, Oct 18)

With the guard, the sim's crowd won 0 of 26 (its wins had mostly been free queens). His offset is already at Stockfish's floor at the sim's tier, so the lever was his powers: a fusion every 8 of his turns instead of 5 gave 0.12 (in the pack); his Slam meter at ×0.8 gave 0.04. `tusksEvery` is now 8. Eric's two-elephant cap and the fusion as his whole turn are unchanged. Rows: `reports/boss-sim/raid-pgT8*.jsonl`, `raid-pgR8*.jsonl`.
