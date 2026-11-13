# Review: PR #677, the Hidden Boss online: his phase change and the four boards

Independent, read-only review (full lane: server, protocol, the online match, fair play). Branch `claude/recluse-online-phase2` at
`5eefa1f3`, against `origin/main` (`1bb9b73b`). Brief: `notes/briefs/review-recluse-online-phase2.md`.

**Checks run on the PR branch:** `npm run typecheck`: green. `npx vitest run packages/server packages/core packages/app`: 291 files,
3972/3972 passed. No e2e runs (per the brief). The failing cases below were reproduced with throwaway tests built on the PR's own
`roomFight` and `crowdFinal` harnesses (not pushed; the code is quoted where it matters).

**Verdict:** no blockers. Two majors, both about what happens when the engine server can't answer. One is a fairness hole (the quick
move). The other is how far `unvouched` reaches in a Crowd final. Six minors. Everything else the brief lists checked out (see the end).

---

## Major

### M1. The server's quick move plays his moves without unvouching the match, and a phase 2 ask is never re-sent to a new or reloaded host

- `packages/server/src/bosses/recluse.ts:195`: a device that hasn't answered in `askMs` gets `w.move = quickMove(w.fen)`, and nothing
  calls `lobby.unvouched`. Only `answer()` does (`:372`). `toDevice` with no host does the same at `:286`.
- `recluse.ts:289` ties the ask to one device (`w.device = host`), and `answer()` only takes it from that device (`:369`). When the
  host drops (`lobby.ts:1078`), leaves (`lobby.ts:1375`) or reloads, `resendHostWork` (`lobby.ts:1453`) knows nothing about phase 2
  work. The new host is never asked, the old host's reload doesn't get the ask again, and the board waits out `askMs` and then gets the
  quick move.
- `quickMove` (the most valuable capture, else the first legal move) is close to random. When it plays *his* move, the boards are
  easy wins.

**Failing case 1 (a host that stays quiet).** The engine server misses (its daily budget spent, a cold container, a group over 6 s).
The host's app ignores `phase2Ask`, whether modified, old (no `phase2Ask` handler), or with a broken engine. Every move of his comes
from `quickMove`. The team wins 4 of 4, the record keeps `unvouched` unset, and XP pays at the full cap, not solo's. The fair-play
case is built, and a Crowd final stays ranked. Reproduced: phase 1 left vouched, every search answered `null`, the host never
answers; after `askMs` his move is on the board and `core.record.unvouched` is `undefined`:

```ts
F.beatAdult(); F.toBoards(); delete F.core.record.unvouched;          // phase 1 vouched, as with judges in production
for (const s of F.searches.splice(0)) F.core.phase2Searched(s.id, null);
F.core.message("p2", { t: "phase2Move", key, board: mine.id, move: legalMoves(mine.board.fen)[0]! });
for (const s of F.searches.splice(0)) F.core.phase2Searched(s.id, null);   // his search fails too: asked of p1, who never answers
F.advance(RECLUSE_ONLINE.askMs + 100);
// his reply is on p2's board (history 1 -> 2), and F.core.record.unvouched === undefined
```

**Failing case 2 (an honest host's reload).** The same setup, and the host (p1) disconnects with his move asked of it. The new host
(p2) gets 0 `phase2Ask`. p2's answer to the old id is refused (`x.device === playerId`), and after `askMs` the quick move plays. A
host that reloads and reconnects gets 0 asks re-sent (2 before the reload, 2 after). With four boards, one reload can hand him up to
four near-random moves.

**Fix (small):** unvouch whenever the quick move plays *his* move (`who === "boss"`), at `:195` and `:286`. On a host change or
reconnect, re-send the open device work: re-point `w.device` to `hostNow()` and send the ask again with a fresh `w.at`. That mirrors
`resendHostWork`'s boss re-ask. Add a unit test for each.

### M2. In a Crowd final, one engine server miss in phase 2 unvouches the whole 100-player match (unranked, solo-capped XP, no fair-play cases)

- Any accepted `phase2Answer`, for his move *or a bot's*, calls `lobby.unvouch` (`recluse.ts:372` → `lobby.ts:3006`). That flag is
  match-wide: `ranked()` turns false for everyone (`lobby.ts:4077`), `lobbyXpGame` caps everyone at solo's (`lobby-do.ts:714`), and
  `writeResult` drops every player's fair-play moves, phase 1's 50 v 50 included (`lobby-do.ts:752`).
- The device path runs whenever `serverAllMovesAt` returns null (`engine.ts:159`): the shared "match" budget (3000 a day, also spent
  by the judges' re-checks) is gone, any group takes over `ALL_MOVES_GROUP_MS` = 6 s (`engine.ts:151`), or a search is lost
  (`SERVER_LOST_MS`). The container sleeps after 3 idle minutes and `warmEngine` allows 20 s to boot (`engine.ts:181`). Yet nothing
  wakes it at phase 2's start: `warmEngine` runs only on `hello` (`lobby-do.ts:572`). A cold container therefore fails the first
  group, and the match goes unvouched.
- Phase 1's boss moves in a Crowd final only unvouch when no checker device exists (BOSS_CHECK), which with 100 players is
  practically never. Phase 2 has no checker, so this is a new, likely trigger.

**Failing case.** A ranked Crowd match ends in the boss final. The crowd beats his adult form after the day's budget is spent, or with
the container asleep. His first phase 2 search returns null, the host's device answers, and `unvouched = "phase2-device"`. The 96
players already out, whose 50 v 50 had nothing to do with phase 2, lose ranked and full XP, and every fair-play case from the match is
dropped. This is the brief's "any change to existing Crowd results". The decision note's call 3 covers the room fight, but it doesn't
discuss this reach in a Crowd final.

**Fix (pick one; the first two are small):**
1. Call `warmEngine` in `begin()`. The fall plus the 34 s phase change is time to boot. Give a search's first group a longer timeout,
   or retry once before the device path.
2. Scope phase 2's device fallback to phase 2: mark its result (the top 4's `teamWon` and XP) as unvouched, not the whole match's
   ranked flag and fair-play records. Or don't unvouch for a *bot's* move, since a bot only plays for its own team.
3. Check his device-played moves the way BOSS_CHECK checks phase 1's (another device).

This is the director's or Eric's call. Option 1 alone makes it rare. Option 2 keeps the 96 watchers' results whole.

---

## Minor

### m1. Every phase 2 message carries the full standings and the battle: 25 KB each in a Crowd final, to every person, on every move

`lobby.ts:784-785` add `phase2Extras()` (`:800`: `runner.bossView()` and `standings()`) to every `phase2` message, broadcasts and
refusals alike. Measured in `crowdFinal()` (100 players): **25,202 bytes** per message. Of that, 22,673 are the standings (unchanged
for all of phase 2), 1,118 the boss view, and **1,376 the phase 2 view itself**. Each move on any of the four boards, his, a bot's or
a person's, sends that to every person in the match. That's about 2.5 MB out of the object per move with 100 people. Each phone parses
25 KB and re-sets `boss` and `standingsList` (`net.ts:868` on), so it re-renders on every move. "Less lag over all else" (Eric,
Oct 14).

**Fix:** broadcast the lean message, and keep the copy with extras only in `r.last` (what a reconnect gets: `connect`, `resendTo`).
Or add the extras only to the first message of a key and on resend.

### m2. Your shown move can snap back, and a second move made on the stale position is played (no ply in `phase2Move`)

- App: `OnlinePhase2.onMessage` (`recluse-online.ts:59-65`) replaces `this.p` with the server's word. A broadcast the server sent
  *before* it got your move (any of the other three boards moved) arrives after the move is shown, so your piece jumps back for about
  one round trip, then forward. With four boards moving, this is frequent.
- Server: `phase2Move` carries only the phase's `key` (`protocol.ts:667`), constant for the whole phase. `move()`
  (`recluse.ts:320-340`) can't tell a move made on an old position. In the snap-back window your board shows your turn again, and a
  second drag is sent. If he has already replied (the engine server answers in well under a second) and the move is still legal, it's
  played as your next move before you saw his reply. Reproduced: `a1b3` played, his reply `a7a6` answered, then a second move
  `b1c3`, chosen on the start position, is accepted: history `[a1b3, a7a6, b1c3]`.

**Fix:** send `ply` (the board's history length) with `phase2Move` and refuse a mismatch. On the app, keep your pending move and
re-apply it over incoming server states until the server's history has it or refuses it.

### m3. Crowd final: during his fall, the leave confirm says "your result stands", but the server records a loss and gives your board to a bot

From `begin()` on, `recluseLobby.onBoard` is true for the top 4, so leaving (a resign, or gone past `awayMs`) is a loss with a bot
(`lobby.ts:1348`). The app learns it's on a board only from the first `phase2` message, at `cutAt`. Until then, `exitFor`
(`net.ts:353`) has `phase2.onBoard` false and `hiddenRoom` false (always so in a Crowd final, and in the room fight after a reload).
Everyone's standings row is `out` after the battle's finish, so the confirm is "leave": "You're already out, so your result stands.
You'll go home." The window is `fallMs` (1.8 s) plus `RECLUSE_CUTSCENE.holdMs` (0 now, longer once the cutscene lands).

**Fix:** have the fall's `boss` message (`toPhase2`) say who takes the boards, or send the first `phase2` view with the fall, and base
`exitFor` on that.

### m4. A test fight still writes phase 2 fair-play moves

`move()` scores and keeps a `FairMove` for every person's move (`recluse.ts:332`) whether or not the fight is a test
(`overrides.tested`, set by the 🏆 and the ultimate trigger). Reproduced: after the admin's 🏆 beat his adult form, a person's phase 2
move is kept (`fair.p2.length === 1`, `tested === true`), so the admin's test fights write fair-play rows. Its numbers also spend
engine budget. (Not this PR's: a tested battle's boss token in `writeResult` isn't gated on `tested` either. It's pre-existing, for
the director's list.)

**Fix:** skip the fair-play search when `r.overrides?.tested`.

### m5. Searches wasted on a match that ends at once

When everyone is gone, `wrapUpIfEmpty` (`lobby.ts:1426`) runs `leaveMatch` → `handOver` for each person on a board. That queues a
bot's search (`recluse.ts:403`) and charges the day's budget in `serverAllMovesAt`. Then `phase2Result` clears the work in the same
event, so each answer is thrown away: up to 4 searches. The same goes for a fair-play search whose answer lands after the results.
Small. **Fix:** don't `queue` in `handOver` when called from the wrap-up (or call `phase2Result` before the leaves).

### m6. Latent: a reload during the cutscene's hold misses it

`recluseCutscene` is broadcast once (`recluse.ts:183`) and isn't part of the remembered `phase2` view (`NetPhase2` has no `cutAt`). A
device back during the hold never sets `OnlinePhase2.cutscene` and shows whatever its reconnect produced until `at`. Harmless while
`holdMs` is 0. Worth fixing with the cutscene branch: put `cutAt` in `NetPhase2`.

### Nits

- A bot's pick (`pick`, `recluse.ts:416`) ignores `MoveScore.mate`. In a won position every move scores near 1, so a bot can
  shuffle without mating, and a draw doesn't win the board. Unlikely against his full-strength search.
- Phase 2's fresh bots join `r.bots`, so the lobby message's player list (`lobby.ts:838`) grows past the match's size when a board
  needs one. The app's `totalPlayers` reads it. Not seen in a test; only when fewer than 4 fought him to the end.

---

## Checked, no findings

- **Moves on the four boards:** a move on another's board, out of turn, illegal, too long, or before the clocks is refused, and the
  sender is told phase 2 again. A second tap on the same position is refused, since it's his move then. Two tabs share one seat and
  the first move wins. A late `phase2Answer`, one from the wrong device, or one after the quick move is ignored. Apart from m2's
  stale-position case, nothing is accepted twice.
- **Clocks and flags:** all server-side (`turnAt` and `bankMs` in server time, flags on the timer, `phase2Move` loses a board whose
  bank ran out when the move arrives). The app converts with `local()`. Nobody's clock runs before `clocksAt`.
- **The phase change's timing:** one `at` and `clocksAt` for everyone. `changeMs` stays within 300 ms of `PHASE_CHANGE.total` (a
  test). Reconnects get the last `phase2` (state is the server's, nothing doubled).
- **Budget:** one `takeBudget` per position (`serverAllMovesAt`), whatever its groups. No position is counted twice. A null answer
  after the budget was taken is still one. About 300 searches a fight looks right (his moves, the bots', and one per person's move
  for fair play).
- **No hang:** server search lost → device after 20 s → quick move after 6 s. Under his ultimate, a slow bot gets a random move from
  `phase2Timeouts`.
- **The 🏆 and the ultimate trigger:** both need `admin` from the Durable Object. The four-board 🏆 also needs the room
  (`party.room`). The ultimate trigger works in any of his fights, as phase 1's did. Both set `tested` (no XP). The room fight is a
  party, so it's never ranked. Phase 1's forced win is cleared (`winForm`, `bossForceWin`) as phase 2 starts.
- **Leaving:** a resign or `awayMs` in phase 2 (and in his fall) is a loss, and a fresh bot plays the board on. Everyone gone ends
  the match as his (`phase2Result` → `"boss"`). The leaver isn't counted again in `humanResults` (not deferred).
- **Fair play:** only people who aren't practicing are scored (`fairPlayer`). Bots' moves and the random moves of his ultimate are
  never judged. A FairMove has `crowd: 0`, and plies under `bookPlies` are skipped as book, as for any game.
- **The Crowd final:** only the top 4 are alive at the end of phase 1, so `runner.alive()` is the top 4, with fresh bots for empty
  boards. Watchers get the four boards with none theirs (`mine.you` guards the screen). The watchers' own results are unchanged
  (`teamWon` null, as they didn't reach him). For the top 4 a win now needs all four boards: intended (decision call 8).
- **Protocol:** every addition is a new message type or an optional field (`toPhase2`, `simul`, `phase2`, `recluseCutscene`,
  `phase2Ask`, `phase2Move`, `phase2Answer`). Other lobbies never send or read them. `phase2Result` and `simul` act only with
  `r.recluse2`, so existing modes' results are unchanged (the full unit suite passes).
- **Known and listed in the PR (not re-reported):** XP's move count is phase 1's only. A reload mid-room-fight loses the room's 🏆.
  His online strength (120k nodes a group, not UCI_Elo) is the director's call.
