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
  its board players: no XP, no rank, no win/loss rows, no Welcome Crate or token, no fair-play moves from phase 2. Everyone else's
  result stands (the review round, M3: call 3).
- **His searches are never refused for the day's budget** (the review round, M2): bounded by the fights, each position counted once
  on his own D1 row (`<day>:recluse`), never the day's, so the judges can't starve him nor he them.
- **A mate in one, always** (the delta review of #677): the engine server never sends `mate`, so `pick()`'s mate rule never fired
  online. The server marks every mate in one by the rules (`withMates`: `matingMoves`, `matingMoves960`); he and a bot take it.

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
3. **No result is phase 2's board players' alone** (the review round, M3, the director's call; it was the whole match's, a Crowd
   final's watchers too). Only those who played one of its boards (`recluse2.names`, as `phase2Unvouched`) get no result: their
   results say "No result: the Hidden Boss couldn't connect. Nothing counts for or against you.", and nothing is written but fair
   play (below). Everyone else (a Crowd final's 96 watchers, whose places and 50 v 50 were settled before phase 2) keeps their
   result at their placement, the boss's part none (`teamWon` null, as when he's decided and they didn't reach him); their results
   say "No result: the Hidden Boss couldn't connect. Your place stands." His and your figures stand as a draw's (no attack, no bow)
   for everyone.
4. **Fair play keeps phase 1's moves.** The brief's "no fair-play cases from phase 2": phase 2's are dropped (each player's count
   before it is kept, `fairFrom`); phase 1's moves were really played and judged, and no player can make the engine server fail, so
   a no-result can't be used to hide them. So each result is still queued, marked `noResult`, and `writeResult` writes its fair play
   and stops. Someone who left before it (resigned, or away too long) had their loss written as they left: it stands.
5. **His searches are never refused; the bots' and fair play's stay on the match's budget** (the review round, M2: was a share of
   3000 a day, then the day's budget, so a busy day could end every later phase 2 with no result). Those have their own fallbacks
   (a device, or no numbers), his don't. A long fight is about 150 of his (four boards of about 40 moves), each position counted
   once whatever its tries. Cost: each is about a third of a re-check's nodes; the engine page puts 3000 re-checks a day "well under
   $1", so a long fight is about 1.5 cents, and only fights spend it. Eric's "I will be providing some funds" covers it.
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

## Review round (the review of #683, Nov 13; the director's calls: smooth play first, no weak moves)

- **M1, his searches never wait behind others.** The engine server is one Stockfish with a serial queue (`engine-1`). Phase 2's
  fair-play searches now go to fair play's instance (`fairplay-1`, up to 60 s: not urgent), and the bots' moves to the host's
  device first (a bot plays for its own team), the engine server only where no device answers in `askMs` or there's no host, the
  quick move where neither does. So within a fight, the match engine's queue holds his moves. A try at his move takes at most
  `RECLUSE_ONLINE.searchMs` (15 s, all its groups' waits included; the group running then is left to the container, nothing more
  is sent: it was 6 s a group, abandoned and re-sent, the review's feedback loop), and is tried again only once answered empty, or
  once lost, past `searchMs` plus 5 s (`SERVER_LOST_MS`, still 20 s): never while it could still be running. `pauseMs` stays
  3000; each pause's length was already logged, and now each of his searches is too ("engine server for the Hidden Boss: … in N
  ms"), so production's answer times can be measured from an admin's room fight. Other lobbies' judges still share `engine-1`;
  a third instance for him is Eric's spend (`max_instances` 2 → 3), not asked for until the logs say so.
- **M2, his searches are never refused for the day's budget** (call 5). The health view (`/admin/ops`, `/api/admin/health`)
  shows his positions today and the fights that ended with no result (`<day>:recluse-none`); the daily digest names any
  no-result, and `npm run ops:report` lists it under "Needs attention".
- **M3, no result covers phase 2's board players only** (call 3).
- **m1:** a board handed to a bot during a pause (a resign, the away sweep): its thinking starts at the pause's start, so `hold`
  moves it to the pause's end plus its while; the pause is never charged to its clock, nor counted a slow move.
- **m2:** each position of his is counted once on his row: a try again (`again`) isn't.
- **m3:** the engine server gone mid-fight (a deploy without it): his next try is the quick move and phase 2 unvouched (call 6),
  never a throw in the alarm.
- **Nits:** a mate in one found with the position read once (`matingMoves`, `matingMoves960`: 0.3 to 3.5 ms where a replay per
  move took 4.5 to 19.5 ms, measured), outside `gameEnd`'s shared cache; `resend` re-asks a bot's moves only; the no-result test
  checks that phase 1's move is the one written to fair play.

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

The review round's (old → new):
- `packages/server/test/recluse-online.test.ts`:
  - "a person's move: … a bot's within botLoss, after its thinking" → "… a bot's from the host's device, after its thinking. The
    match engine's queue holds his moves alone": the bots' moves answered as the host's device's (was: the engine server's), and
    "nothing asked of a device" → every bot's move asked of the device at a bot's strength, the searches only his (`boss`) and
    fair play's (`fair`).
  - "every board won …": the host's device answers the bots' asks too.
  - "a resign …": its move asked of the host's device (was: a search of its position).
  - "a disconnect …": the people's banks 10 minutes (was 2:00, which is `LEAVING.awayMs` itself: the sweep came first only when the
    bots' slow moves happened to bring his ultimate first; the new order draws differently), and phase 2 not over at the sweep.
  - "an empty answer is tried again …": counted once (`again` on a later try); its "a bot's empty answer: the host's device" half
    moved to the new "a bot's move: the host's device first; … the engine server's; … the quick move".
  - "no answer in serverWaitMs …": the board players' results `noResult: "board"` (was `true`), `teamWon` null, counted for the
    health view, and the write check asserts phase 1's move is what fair play writes (was: only that its first query ran).
  - New: "a try still unanswered is never sent again while it could still be running", "a bot's move: the host's device first …",
    "m1", "m3", "nit: a host's reload re-asks a bot's moves only", "in a Chess960 position too".
- `packages/server/test/crowd-hidden-boss.test.ts`: new, "no result in phase 2: its board players' results none; a watcher's stands"
  (the harness can make a person pick the worst move, cut early, and take an engine server).
- `packages/server/test/engine-server.test.ts`: "the Hidden Boss's own share …" → "never refused for the day's budget, counted on
  his own row" (his row at 99,999 and the day's spent, he searches; a try again uncounted; D1 down, he searches; the health view's
  row and no-result count); new, "a try takes at most `withinMs`" and "fair-play numbers go to fair play's own instance".
- `packages/server/test/health.test.ts`: the engine's health has `recluse` (his row, the no-results).
- `packages/app/test/recluse-online.test.ts`: the "no result" test also checks the results' two kinds reach the screen.
- `e2e/hidden-boss-room.spec.ts`: its comment only (his moves there are the server's quick moves: no engine server in the suite).

## Not done

- Phase 1 stays on devices (call 7).
- His own container instance (Eric's spend): only if production's logged answer times show other lobbies' searches delaying him.
