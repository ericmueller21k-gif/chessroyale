# The Hidden Boss's phase 1 online: no random move either (Nov 13, 2026)

Eric, Nov 13 (option 1): "Keep Maia on the devices, but replace the random-move fallback with the same pause plus a server move."
Until now, online, his phase 1 move (the child's or the man's) went to the host's device (Maia, or Stockfish's seeded move where
Maia isn't loaded), checked by a second device (BOSS_CHECK). With no device answering in its window (`bossTimeout`), another device
was asked; with none left, he played a random legal move.

## What changed

- **No device answers his move:** in his fights online (his room's and the Crowd's boss final, child and man), once the host's
  window has passed with no answer from any device asked, his move goes to the engine server (every legal move scored, on his own
  row of the day, never refused: `phase2Search` with an id `p1-…`). He plays one at the strength the devices were asked for: the
  child's Maia rating's Stockfish stand-in (`levelForMaia`, the runner's `bossEloNow`) or the man's fixed level, as the turn drew it
  (his usual move, a slip, or the King's strike's step back): `bossMoveFromScores` (chess `runner-tools.ts`). Never a random move.
- **Tried again as phase 2's are:** an empty answer after `RECLUSE_ONLINE.retryMs`, doubling to `retryMaxMs`; one never answered,
  past `searchMs` plus 5 s. Each position counted once.
- **Never in (`serverWaitMs`, 60 s from the ask): no result**, as phase 2's. Those fighting him then ("No result: the Hidden Boss
  couldn't connect. Nothing counts for or against you."): no XP, rank, result row, Welcome Crate or token, only fair play written.
  Everyone else's result stands ("Your place stands.": a Crowd final's others). The battle ends as a draw (the duo on the results
  as a draw's). Counted for the health view (`<day>:recluse-none`).
- **No engine server set up** (local runs, the e2e suite, staging) or gone mid-fight: the server's quick move, never a random one,
  and the match unvouched (it pays as a solo game, not ranked), as phase 2's quick move.
- **Other bosses: unchanged** (another device, then a random move). A follow-up for Eric if he wants the same for every boss.

## Calls made

1. **The pause is his turn as it already is.** Nobody's clock runs on his turn (the crowd's starts after his move and its moments),
   so nothing flags or times out, the bullet clock waits, and every screen says "The boss is thinking…" from his move's ask (the
   boss message's `thinking`). Nothing new pauses or is shown. Phase 2 needs `paused` because its other boards' clocks run during
   his move; phase 1 has one board. The away sweep (someone gone longer than `LEAVING.awayMs`) goes on, as in phase 2's pause.
2. **The engine server after the first window, not another device's.** The host's window passing unanswered (and its checker's,
   where one was asked) is "no device answers". Asking another device cost everyone 15 s more, and two silent devices took turns
   forever (`pickHost` skips only the current host): the random move came only with one device left. The server answers in about
   a second, at his strength. Another device hosts his moves to come, as before. The server's use stays tiny: only a silent
   device's move.
3. **Once asked, that move is the server's alone.** A device's late answer isn't heard, and the host isn't asked again for it (a
   reload, a new host). Mixing the two would need the check's machinery again mid-wait, for a second at most. His next move goes
   to the devices as ever.
4. **The pick:** `bossMoveFromScores` is pickBossMove's seeded Stockfish move (`eloDraw` within the guard, else a slip; the slip;
   the strike's step back) made from the server's numbers' top 8. A test checks it gives a device's move, from the same seed, at
   every strength and kind. It skips pickBossMove's head-to-head second look at a move other than the best (that needs an engine;
   every move here was scored at one budget). A mate in one: the server scores it 1 (Stockfish's win/draw/loss), so no other move
   is within the guard and he plays it.
5. **Whose no result:** those still in the battle (`runner.alive()`: `LobbyRecord.recluse1.none`). Someone who left it before had
   their loss written as they left: it stands. Fair play keeps every move (each was really played and judged; phase 2's no result
   drops only phase 2's).
6. **The health view's count and his row take phase 1's too.** The ops page, the digest and `ops:report` say "his fights", not
   "phase 2".

## The delta review of #683: its minors

- **m1:** his searches no longer wait on D1's count. The count goes beside his groups (`serverAllMovesAt`'s `background`: the
  Durable Object's `waitUntil`), so a slow or hung D1 never holds his move up. The others' searches still wait on their budget.
- **m2:** the daily digest posts at 8 am Central (14:00 UTC), so today's UTC row alone missed most of the US day. It now names
  yesterday's row too: "the Hidden Boss's fights with no result (UTC days): yesterday N, today so far M". The health view returns
  `noResultsYesterday`, and the ops page shows both.
- **m3, written down (the reviewer's point):** in phase 2 the host's device chooses the bots' moves (`phase2Ask`), and the server
  checks only that each is legal. Phase 1's bot picks have always worked this way (the host's scores carry them). The reason given
  before ("a bot plays for its own team, so it can't be used to cheat him") doesn't hold:
  - in his room's fight, a modified host could play its three bots at full strength and win their boards;
  - in a Crowd final, a host who is watching could throw the finalists' bots.
  This is accepted, as in phase 1. The boards' people are the ones fair play watches, and a bot's moves are nobody's record. If it
  ever needs closing: send a bot's search to fair play's instance (never his queue), with the device as the fallback. The comments
  that gave the old reason now say this (`recluse.ts`, `settings.ts`, `protocol.ts`).

## Checks changed (old → new)

- `packages/server/test/engine-server.test.ts`: "the day's budget spent by the judges …" now awaits his counts (handed to
  `background`) before reading his row (was: read at once, the count awaited inside the search); "the health view …" now also
  checks `noResultsYesterday` (and yesterday's row, read the next day). New: "his search never waits on D1's count".
- `packages/server/test/health.test.ts`: the engine's health `recluse` has `noResultsYesterday: 0`.
- `packages/server/test/alerts.test.ts`: new, "the digest names the Hidden Boss's fights with no result yesterday too".
- `packages/server/test/recluse-online.test.ts`: new, "his phase 1 move when no device answers" (the server's move at the man's
  level, his turn held, a late device answer unheard, the next move the devices'; the child's strength as it rises; retries and
  no result; no engine server: the quick move, unvouched).
- `packages/server/test/crowd-hidden-boss.test.ts`: new, "no result in phase 1" (the finalists' results none, a watcher's stands).
- `packages/chess/test/boss-brain.test.ts`: new, `bossMoveFromScores` (a device's seeded move from the same seed; weaker plays
  worse; `allowed`).
- No check removed.
