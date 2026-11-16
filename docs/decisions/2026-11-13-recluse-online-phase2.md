# The Hidden Boss's phase 2 online: his phase change and the four boards (Nov 13, 2026)

Eric, Nov 13: "it should be... it plays through to the four boards... It plays through till the end." Until now, online, beating his
adult form ended the fight as a win; his phase change and the four boards were solo only.

## What changed

- **Online, beating his adult form** (his room's fight from the town, and the Crowd's boss final) brings his fall (`toPhase2`, 1.8 s:
  `RECLUSE_PHASE2.change.fallMs`), the cutscene's hold (`RECLUSE_CUTSCENE.holdMs`, 0 for now; the event `recluseCutscene` with its
  start and end), then his phase change for everyone from one start (`phase2`'s `at`), the boards counting down, and the four boards
  played to the real result. The server runs it all: `packages/server/src/bosses/recluse.ts`, on the same pure rules as solo
  (`packages/chess/src/bosses/recluse-phase2.ts`). The app shows it with solo's screens (`recluse-online.ts`, through `NetMatch`).
- **His forms are a list** (`RECLUSE_FORMS` in settings.ts, `recluseNextForm`): `["adult", "four"]`; the child form goes first
  (`["child", "adult", "four"]`) with no change to the online code.

## Calls made

1. **His moves on the engine server, every legal move scored.** Its container answers one kind of search only (at most 8 moves; its
   image is pinned by digest, so a new endpoint would need a Docker rebuild: DEPLOY.md). So a position's moves go in groups of at most
   8 (`moveGroups`, as fair play's 1 v 1 check does), `RECLUSE_ONLINE.groupNodes` (120,000) a group, and he plays the best. That's
   full-strength Stockfish at a modest depth, not UCI_Elo 2750: probably a little stronger than solo's; `groupNodes` is the number to
   tune. A bot plays one within `botLoss` (0.06 expected) of the best, at random.
2. **The budget: one search a position**, whatever its groups (together fewer nodes than one judge's re-check): his moves, the bots'
   and each person's (fair play, below). A long fight might take 300 of the day's 3000; nothing is raised. A share of its own, like
   solo's, is Eric's call if these fights become common.
3. **Where the engine server can't answer** (none, as in local runs and the e2e suite; its budget spent; no answer): the host's device
   plays the move (`phase2Ask`, its engine at solo's strengths), and the match pays as a solo game (`unvouched`, as any boss move on one
   device's word). Since the review round: his moves only, and phase 2's result only (below). No answer from it in `askMs` (6 s): the server's own quick move (the most valuable capture, else the first legal
   move), so a board never stalls.
4. **Fair play:** each person's move is scored on the engine server (when it answers) and kept as a `FairMove` with no crowd (fair
   play's model has a branch for that), in his room's fight too. Phase 1's party rule (no signals: teammates' picks show live) doesn't
   apply on a board that's yours alone. (Since the review round, a device in phase 2 no longer drops fair-play cases: below.)
5. **"Win this form" in the four boards: the phase as a whole.** The admin's 🏆 (his room's fight, server-checked) makes the team's next
   move (a person's or a bot's, on any board) win every board still on. Pressed during his fall or phase change, it waits for the boards.
6. **The admins' ultimate trigger** brings his phase 2 ultimate ("5 SECONDS!") online too, once the clocks run (as solo's).
7. **Leaving** (resign, or gone longer than `LEAVING.awayMs`): their board goes to a bot, which plays it on (the brief: "a seat gone,
   its bot plays it"); for them it's a loss. A disconnect's clock runs meanwhile. Everyone gone: the match ends, his.
8. **The 50 v 50 final** reaches him online on the same path: those who fought him (the top 4) take the boards, fresh bots any board
   still empty; everyone else watches the four boards (none is theirs).
9. **The phase change's length** is the server's number (`RECLUSE_ONLINE.changeMs`, 34.3 s): the screens' own timeline
   (`PHASE_CHANGE.total`) must stay within 300 ms of it (`packages/app/test/recluse-online.test.ts`). A change to his phase change's
   beats updates the setting with it.

## Checks changed (old → new)

- `packages/server/test/crowd-hidden-boss.test.ts`, "beaten online: … then the results, the crowd's victory: no phase 2 online" →
  "… his fall (`toPhase2`), then his phase 2 for the top 4; its boards decide it".
- `e2e/hidden-boss-room.spec.ts`, the room's fight: "the 🏆 wins it, then the results" → "the 🏆 beats his adult form, then his phase
  change, the four boards, the 🏆 again and a move, then the results ("4 of 4")".

## Not done

- XP's move count online is phase 1's picks only.
- A reload in the middle of his room's fight doesn't know it's the room's (no 🏆 after it): as before this change.

## Review round (Nov 13; the review of #677, the director's calls)

- **M1:** his move from the server's quick move unvouches too (call 3, scoped as in M2). Device work follows the host: a disconnect or a
  leave re-points it to the host now, and a host back from a reload (`resendTo`) is asked again; each with a fresh `askMs`
  (`recluse.ts` `resend`). No cap on fresh times: a reload loop only delays his reply, and his moves cost nobody's clock.
- **M2 (options 1 and 2):** the engine server is woken as phase 2 begins (`warmEngine` through `LobbyIO.warmEngine`); a position's first
  group is tried twice before the device path. A bot's move from a device or the quick move never unvouches. His does, but only
  phase 2's result (`recluse2.unvouched`): the players of its boards (`names`, leavers included) aren't ranked and are paid as a solo
  game, and their results say so; the match's `unvouched`, phase 1's fair play and the Crowd final's watchers are untouched. Small and
  clear (one helper, `phase2Unvouched`, read in `rankedFor`, the results message and `lobbyXpGame`), so call 3's match-wide flag is
  replaced. People's phase 2 fair-play moves stay: their numbers are the engine server's, never a device's.
- **m1:** the phase 2 message to everyone is lean; `last` (a reconnect's) carries the battle and the standings, one shared copy.
- **m2:** `phase2Move` carries `ply`; a mismatch is refused (`refused: true`, not remembered). The app keeps your move shown over the
  server's word until its history has it, the board is decided, or it's refused, and sends it again on a reconnect.
- **m3:** the fall's message names who takes the boards (`phase2Boards`); `NetMatch.exit` is "resign" for them from the fall on.
- **m4:** no fair-play search in a test fight (`overrides.tested`). The tested boss token in `writeResult` is older: left, listed.
- **m5:** a seat handed to a bot asks no search when nobody else is here (the match ends that event). Through the away sweep, a
  handed-over board has always run out of time already (the bank equals `awayMs`): the waste was the last person's resign.
- **m6:** `NetPhase2.cutAt`; `OnlinePhase2.cutscene` is set from the view too (a reload during the hold). The event stays.
- **Nit:** a mate scored is played, the quickest, his or a bot's. The player list nit: left.
- **Checks changed:** `server/test/recluse-online.test.ts`, "no engine server: … (one device's word: the match pays as a solo game)" →
  "… (a bot's: nothing unvouched); his quick move unvouches phase 2's result only"; its first board test now clears `tested` (a test
  fight keeps no fair-play moves); `phase2Move` sends gain `ply`. `app/test/recluse-online.test.ts`: the move sent gains `ply: 0`.
