# The Hidden Boss's phase 2 moves come from the engine server alone (Nov 13, 2026)

Eric, Nov 13: "we can't have him breaking ... if the engine doesn't load properly ... I almost feel like we need to pause the game.
Or I guess it falls back to the server ... I will be providing some funds for our server when the game goes, so we can always
utilize that." Until now (#677), online, a move of his the engine server couldn't answer went to the host's device (`phase2Ask`),
then to the server's quick move: one player's device could compute its own opponent's moves, and a lag gave a weak move.

## What changed

- **His phase 2 moves come from the engine server alone** (`packages/server/src/bosses/recluse.ts`): never a player's device,
  never a quick move. `phase2Ask` is a bot's only now (a bot plays for its own team).
- **No answer yet:** an empty answer is tried again after `RECLUSE_ONLINE.retryMs` (1 s), doubling up to `retryMaxMs` (8 s); a
  search lost on the way (no answer at all in 20 s) is tried again then. Any try's answer plays (it's the same position).
- **Late (`pauseMs`, 3 s after his move was asked):** every board's clock pauses and every board shows "He's thinking…" (the view's
  `paused`). Once his move is in, every running clock goes on from where it stood.
- **Never in (`serverWaitMs`, 60 s):** the fight ends: "No result: the Hidden Boss couldn't connect." Nothing counts for or against
  anyone: no XP, no rank, no win/loss rows, no Welcome Crate or token, no fair-play moves from phase 2.
- **His own share of the engine server's day** (`RECLUSE_ONLINE.dailySearches`, 3000; the D1 row `<day>:recluse`), apart from the
  judges' re-checks and solo's, so they can't starve him. Spent: his searches take from the day's budget, as a match's.
- **A mate in one, always** (the delta review of #677): the engine server never sends `mate`, so `pick()`'s mate rule never fired
  online. The server marks every mate in one by the rules (`withMates`: `gameEnd(fen, [move]) === "checkmate"`); he and a bot take it.

## Calls made

1. **The pause waits `pauseMs` (3 s), not his first millisecond.** His answer normally takes about a second (five groups of 120,000
   nodes at about 0.8 million a second, an estimate from the engine page's "2M nodes: about 2.5 s"); pausing all four boards at
   every move of his would stop the game constantly. A setting, to tune from the server's logs (each pause is logged with its
   length).
2. **A pause freezes the whole fight.** Nobody's move is taken (refused, and the app doesn't send it), the bots' and his moves wait,
   nothing flags or times out, the admins' ultimate trigger waits. Otherwise someone on another board would think on a stopped
   clock. When it ends, each turn's start (and each bot's thinking) moves on by the pause's length (`hold`), so every bank, his
   ultimate's few seconds and the slow-move count (time on your turn) are as they stood. The app stops counting look-aways during
   a pause too (your clock isn't running then); those before it are kept for the move.
3. **No result is the whole match's, for everyone in it**, a Crowd final's watchers too: the match's outcome is the boss final's,
   which nobody saw end. The results screen says it ("No result: the Hidden Boss couldn't connect. Nothing counts for or against
   anyone."), his and your figures standing as a draw's (no attack, no bow), and nothing is written but fair play (below).
4. **Fair play keeps phase 1's moves.** The brief's "no fair-play cases from phase 2": phase 2's are dropped (each player's count
   before it is kept, `fairFrom`); phase 1's moves were really played and judged, and no player can make the engine server fail, so
   a no-result can't be used to hide them. So each result is still queued, marked `noResult`, and `writeResult` writes its fair play
   and stops. Someone who left before it (resigned, or away too long) had their loss written as they left: it stands.
5. **His share is 3000 a day; the bots' and fair play's searches stay on the match's budget.** Those have their own fallbacks (a
   device, or no numbers), his don't. A long fight is about 150 of his (four boards of about 40 moves) plus retries. Cost: each of
   his searches is about a third of a re-check's nodes; the engine page puts 3000 re-checks a day "well under $1", so his full
   share is under about $0.30 a day (under $9 a month), and only fights spend it. Eric's "I will be providing some funds" covers it;
   the number is his to change.
6. **No engine server set up at all** (local runs, the e2e suite, staging: no `phase2Search`, `ENGINE_OFF` or no container): his
   move is the server's quick move at once, and phase 2's result is unvouched (it pays as a solo game, not ranked), as the quick move
   did before. Production always has the engine server; this keeps the e2e suite able to play phase 2, and a production
   misconfigured that way can't pay out as a real win. Never a device, even then.
7. **Phase 1's boss moves are left as they are** (the brief: say what they do). In his fights online (his adult form; the child
   form, once wired online), his moves come from players' devices, as every boss's: the host's (his fixed brain, Maia; Stockfish's
   seeded move where its Maia isn't loaded), checked by a second device given the same seed (BOSS_CHECK); two different answers go
   to the engine server, which keeps the better for him (a throw gets a strike); with no second device the host's stands alone and
   the match pays as a solo game (`unvouched`). No answer in 15 s (`BOSS_TIMEOUT_MS`): another device is asked; none at all: a
   random legal move (`bossTimeout`). His thinking takes no time from the crowd's clock, so a lag costs nobody time; only a total
   failure plays a weak (random) move. Moving phase 1 to the server too would need Maia on the engine server (it runs Stockfish
   only) or Stockfish for his adult form online: a design call for Eric and the director, not made here.

## Checks changed (old → new)

- `packages/server/test/recluse-online.test.ts`:
  - "no engine server: the host's device plays his moves and the bots' (…); none from it in time, the server's quick move" → "no
    engine server set up (local runs, the e2e suite): a bot's move from the host's device (…); his, the server's quick move at once
    (phase 2's result unvouched), never a device's".
  - "every board won …": its "a board lost on time" half now has an engine server that answers as time goes on (`auto`) and a 2 s
    bank (was: no answers and the 2:00 bank; with his moves in, the bots' slow moves bring his ultimate first, where no flag falls).
  - "a disconnect …": an engine server that answers (`auto`; was: one that never answered, which now ends the fight first).
  - M1, "a host that never answers: his move is the server's quick move …": removed (no device plays his moves; the new tests below
    cover what happens instead). "The host drops with his move asked of it" and "an honest host's reload": the same checks on a
    bot's move asked of the host.
  - M2, "his move on the host's device: phase 2's result unvouched …" → "his quick move with no engine server set up: phase 2's
    result unvouched …" (the same checks).
  - New: "his moves from the engine server only" (retries, never a device, a bot's still on a device; a slow answer pauses and
    resumes the clocks; no answer ends with no result, nothing written but phase 1's fair play) and "a mate in one".
- `packages/server/test/engine-server.test.ts`: new, his own share of the day.
- `packages/app/test/recluse-online.test.ts`: new, the pause (no move, clocks held, look-aways held) and no result.
- `e2e/hidden-boss-room.spec.ts`: its comment only (his moves there are the server's quick moves: no engine server in the suite).

## Not done

- Phase 1 stays on devices (call 7).
- The health view (`engineHealth`) shows the day's budget, not his row (`<day>:recluse`): read it in D1 if needed.
