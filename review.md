# Review: the Hidden Boss's phase 1 server move (#686, `claude/recluse-phase1-pause`)

An independent, read-only review in the full lane, at effort xhigh. It covers head `9fe13c1d`, with main merged in at `6bdc804e`.
Brief: `notes/briefs/review-phase1-pause.md`.

**Verdict: no blockers and no majors. One minor and two nits.**

- I found no path on which his phase 1 move is random.
- The BOSS_CHECK flow for the other bosses is unchanged.
- The no result reaches exactly the people in the battle.
- #683's three minors are done the way that review suggested.

The one real gap is the server's pick in a won position. From the engine server's numbers he never plays a mate in one, but the
decision note says he always does (m1).

## What I ran

- **Typecheck** (`npm run typecheck`): clean.
- **Unit tests** (`npx vitest run packages/server packages/core packages/app packages/chess`): 355 files passed and 1 skipped;
  5,246 tests passed and 2 skipped. That's the count in the PR body.
- **CI:** `check` passed. The `full-e2e` run was still going when I finished: shard 9 of 15 had passed, the rest were running. I
  didn't wait for it.
- **Probes of my own (not pushed), all passing:**
  - (a) The host reloads while his move is out to the engine server.
  - (b) The host changes both ways while it's out.
  - (c) Nobody is connected at his turn.
  - (d) The record mid-wait, and the retry of a lost try.
  - One more ran real Stockfish for m1.

## Blockers

None.

## Majors

None.

## Minor

### m1. From the engine server's numbers he never plays a mate in one in a won position (the decision note says he always does)

**Where:**
- `bossMoveFromScores` (packages/chess/src/runner-tools.ts:573) ranks the moves by `expected` alone and keeps the first 8.
- The engine server sends only `{ move, expected }`, with `expected` from Stockfish's win/draw/loss (engine/server.mjs:70). It
  never sends `mate`. That's why phase 2 marks mates itself (`withMates`, packages/server/src/bosses/recluse.ts:618) and plays one
  first (`pick`, recluse.ts:719).
- Phase 1's `hisSearched` (packages/server/src/lobby.ts:2687) does neither.

**Case:** in a won position, Stockfish's win/draw/loss tops out, so many moves score exactly 1.0. The sort is then a tie, and the
"top 8" are simply the first 8 legal moves in the order they're generated. They aren't Stockfish's best 8, and a mate may not be
among them.

I measured this with real Stockfish (the repo's Node build). Every legal move was scored in groups of 8 at 120,000 nodes, as the
engine server scores them:
1. The position: `r5k1/5ppp/8/3q4/8/8/5PPP/6K1 b - - 0 1`. Black is him, to move; Ra1# and Qd1# both mate.
2. Every move scored 1.0000. The first 8 after the sort are rook moves along the 8th rank and down the a-file (a8b8, a8a5, a8a7,
   …). a8a1 is 9th.
3. I ran `bossMoveFromScores(scores, "elo", elo, mulberry32(seed), kingStrikeLoss, bossGuardFrom(DEFAULT_SETTINGS))` for seeds 1
   to 300. **He didn't mate in any of the 300 draws**, at each strength tried: 2367 (the child's lowest, `levelForMaia(1800)`), 2650
   (the child's top) and 2400.
4. A device in the same spot takes its top 8 in Stockfish's MultiPV order, mates first. The same draw over 8 tied moves mates about
   2 times in 8.

"stumble" and "stagger" tie the same way. With every loss at 0, `pickByLoss` finds nothing in its range and returns `top[0]`, the
first legal move in generation order.

**What it costs:**
- It happens only on a move no device answered, and only in a won position, so it rarely changes his result. He doesn't mate, and
  the crowd gets another move.
- In his room's fight, if the one person's device never answers, every move of his is the server's. In a won ending he can then
  shuffle among the same first few moves toward the move cap or a repetition, instead of mating.

The decision note's call 4 (docs/decisions/2026-11-13-recluse-phase1-pause.md:42-43) says: "A mate in one: the server scores it 1
(Stockfish's win/draw/loss), so no other move is within the guard and he plays it." That's true only when the mate is his one
winning move.

**Fix (small):**
- Mark the mates as phase 2 does: `withMates(a.fen, ok)` in `hisSearched`.
- Play the quickest mate when there is one, before `bossMoveFromScores`, or inside it.

That makes him a little stronger than a device here (which mates about 1 in 4), which is the right side to err on for "never
compromise the game". Then:
- Correct call 4.
- Add a test: the position above with every move at 1.0, and a mate outside the first 8, so he plays it.

The other ties (a won position's first 8 moves in generation order) can stay: every one of them keeps the win at that search.

## Nits

- **n1. Untested: a reload, a host change during the wait, and no host at all.** The brief names all three, and the code is right:
  `resendHostWork`'s guard at lobby.ts:1500, and the `bossMove` guard at lobby.ts:1605. Probes (a) to (c) pass. Still, nothing in
  the PR tests the line that keeps a reload from asking the device again. Probe (a), a reload mid-wait, is about 20 lines on the
  `roomFight` harness and would cover it.
- **n2. With nobody connected, his turn still waits the host's full window (15 s) before the engine server is asked.**
  - Where: `requestBoss` (lobby.ts:1906-1909) asks no one when `hostNow()` is null, but still arms the whole `bossTimeoutMs`.
  - Case: in his room's fight, the one person's phone drops as his turn begins. Nothing happens for 15 s, then the server's move
    plays (probe (c)).
  - Suggestion: with no host and `hisOwnMove()`, ask the engine server at once. Not urgent.

## For the director (calls, not defects)

- **Call 2 replaces more than the random move.** Before, a silent host meant another device was asked, and the random move came only
  when none was left. Now the engine server is asked straight away. So if the engine server is also down for 60 s, the fight ends
  with no result where another device could have played on.
  - The note gives good reasons: two silent devices took turns forever, and each one cost everyone 15 s.
  - Phase 2 already depends entirely on the server.
  - It's worth one line to Eric, since his words were "replace the random-move fallback".
- **Other bosses can still take turns forever between two connected but silent devices.** `pickHost` skips only the current host,
  so each window hands the move to the other one. This is older than this PR and the decision note names it. It's a follow-up
  candidate if Eric wants the same for every boss.

## Checked, no finding

**His phase 1 move is never random, on every path:**
- **A silent host:** `bossTimeout` asks the engine server (`askHis`, lobby.ts:2598). The next device only hosts his later moves.
- **No host:** probe (c).
- **A reload:** `resendHostWork` skips the turn whose move is out (lobby.ts:1500); probe (a).
- **A host change:** `disconnect` goes through the same guard; probe (b).
- **A late device answer:** dropped at lobby.ts:1605, before `bossAnswer`, so a checker's late answer is dropped too.
- **An earlier try's answer:** matched by the prefix `p1-<key>.`. The dot keeps `b-1` from matching `b-10`.
- **An answer after the no result:** dropped (`a.none`, and the phase check).
- **The other `bossTimeout` branches:** the host asked again for a move's extras, the judges' server comparing two moves, and one
  answer in. Each plays a device's move, as before.
- **No engine server set up:** the quick move, and the match unvouched (tested).
- **The engine server gone mid-fight:** `searchHis` falls back to the quick move.

**`bossMoveFromScores` against a device's seeded pick:**
- With distinct scores, it gives the same move as `pickBossMove` from the same seed, for every kind at 1400, 2000 and 2600. That's
  the PR's test, and I read the two side by side: `eloDraw`, the guard and its slip, the slip itself, the strike's wider guard, and
  the best.
- The differences:
  - It has no head-to-head second look (`confirm`). That's documented; a device is a touch stronger for it.
  - `allowed` is applied before the top 8 rather than after. That only matters under a power that limits his moves, and he has none.
  - Ties: m1.
- **His strength:** `a.elo` is `runner.bossEloNow()` at the ask, the same number the `bossRequest` carries. For the child that's
  `levelForMaia(childRatingNow)`, and the test checks it rises. For the man it's his fixed level.
- The guard and the strike's loss come from the lobby's settings, as the app's `hostBoss` takes them (net.ts:1042).
- The pick draws from the lobby's random source, not the check's seed. That's fine: only the draw's spread matters.

**The BOSS_CHECK flow for other bosses is unchanged:**
- Every new branch is gated, either by `hisOwnMove()` (the boss is `HIDDEN_ROOM.boss` and the turn is his own move) or by
  `recluse1?.key === bossKey`, which is never set for anyone else.
- `playBoss` clearing `recluse1` does nothing for them.
- `p1-` ids can't collide with phase 2's (`w…`, `f…`). The judges' `boss:…` searches go by another path (`serverScore`).

**No result in phase 1:**
- `recluse1.none` is `runner.alive()` at that moment: those in the battle. Bots are in it too, harmlessly.
- **The results:** `board` for them (not ranked, nothing counts) and `watched` for everyone else. `humanResults` marks
  `noResult` and `ranked: false` for them alone, and `teamWon` is null for all.
- **The stored rows:** `writeResult` (lobby-do.ts:784) writes their fair play and stops: no XP, rank, result row, Welcome Crate or
  token. Watchers get their rows, XP and rank as usual.
- **Fair play** keeps phase 1's moves; each was judged before his turn.
- **Someone who leaves mid-wait** keeps the loss written as they left, as in phase 2. The away sweep (`LEAVING.awayMs`, 120 s) can't
  catch someone who dropped as his turn began, because the worst case is 15 s + 60 s.
- A lobby's record is never reused after its results, so `none` can't leak into a later match.
- The results screen's line is generic: "No result: the Hidden Boss couldn't connect."

**The pause:**
- Nobody's clock runs on his turn.
- Banks are spent only from each pick's think time on the crowd's turn (core `match.ts:399`), so the bullet clock waits.
- The app has no stall watchdog, and `thinking` stays the last boss message.

**Retries and budget:**
- The first try is counted on `<day>:recluse` and never refused: `takeBudget`'s branch for him returns true, even on an error.
- Later tries carry `again`, so they aren't counted.
- **The timings:**
  - A lost try goes again at `searchMs` + 5 s.
  - An empty answer goes again after `retryDelay`, doubling each time.
  - No result comes at 60 s from the first ask.
  
  The PR's test covers each one.
- **A Durable Object restart:** `recluse1` and the timer are in the stored record, so a try lost with the old instance is sent
  again at `SERVER_LOST_MS` (probe (d)). The search queue is drained by `persist` after every alarm and every answer.

**#683's minors:**
- **m1:** the count starts beside the groups and is handed to `waitUntil`, so a hung D1 no longer holds his search (new test). A
  match's search still waits on its budget, and `takeBudget` never throws.
- **m2:** `engineHealth` reads yesterday's row. The digest says "yesterday N, today so far M", the ops page shows both, and
  `ops-report` shows today's, as the docs say. A no-result between 00:00 UTC and the digest's 14:05 UTC is named twice: first as
  "today so far", then as "yesterday". Both are labeled by UTC day, so that's honest.
- **m3:** written down in the decision note, `recluse.ts`, `settings.ts` and `protocol.ts`.

**Docs:** `bosses.md`, `engine.md`, `ops.md` and the decision note match the code, except call 4 (m1).
