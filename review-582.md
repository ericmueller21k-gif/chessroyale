# Review of #582 (ranked L1: the leave rules in 1 v 1)

Reviewer: independent, read-only (xhigh). Reviewed `git diff origin/main...origin/claude/ranked-l1` at `55c3707`.

Checks run: `npm ci` ok; `npm run typecheck` ok; vitest on `packages/core/test`, `server/test/{ranked-store,duel-room,account-data,kill-switches,duel-queue}.test.ts`,
`app/test/{ranked-leaves,faq}.test.ts`, `chess/test/duel-rules.test.ts`: 35 files, 503 tests, all pass. (I did not run the rest of `packages/chess/test`,
which needs Stockfish and isn't touched by this PR beyond duel-rules, and I did not run e2e or check 320 px in a browser.)
Findings 1, 2 and 3 were confirmed with a throwaway vitest against `DuelCore` (using duel-room.test.ts's `room`/`started`/`playing` helpers); the file was deleted afterwards.

**Verdict: one blocker (a free dodge and a free quick resign through the queue's Cancel) and two major fairness holes. The rest is solid:**
charge-once (nonce plus `INSERT OR IGNORE` plus a conditional fee in one batch) holds under retries and two recordings at once; the migration is additive and the
fingerprint picks it up automatically; download, delete, merge and purge cover the new table; and the kill switch covers the recording, the queue and `/api/me`.

---

## 1. BLOCKER: the queue's Cancel is a free dodge, and a free quick resign, for up to 60 s after pairing

`packages/server/src/index.ts:422` → `DuelGame.abandon` → `packages/server/src/duel-room.ts:316` (`cancelled`).

`Queue.cancel` returns `placedIn(ticket)` for as long as the placement is kept (`CAPACITY.queue.placedKeepMs` = **60 s**), and `abandon` only checks that the caller
is one of the game's two players. `cancelled(c)` sets `excused = true` whenever the game hasn't ended, whatever its phase, then sends `resign`. So:

- **During the versus moment or the vote:** `POST /api/1v1/cancel?ticket=<own ticket>` (the ticket is in the queue's answer, visible in devtools) aborts the game with
  `conduct = {}`. That's no dodge, no RP, no lockout and no mark. Confirmed: `started(); core.cancelled("w")` → aborted, `conduct {}`.
- **After the first moves:** the same call becomes a *resign* with `conduct = {}`, so a quick resign (before the 3rd move) escapes the leave mark and its −10 RP.
  The timeline (join ≤10 s, versus 2.5, vote 5, overlay 1.5) leaves roughly 40 to 50 s of play inside the 60 s window. Confirmed: `playing()`, e4 e5,
  `cancelled("w")` → `0-1 resign, conduct {}`.

The FAQ says "Pressing Cancel the very moment a match is found isn't a dodge". The code excuses much more than that moment.

**Fix:** excuse only a player who never saw the game. Record a per-colour `seen` flag in `connect()` (first socket), and in `cancelled` set `excused` only when
`!this.r.game && !this.r.seen?.[c]`. Otherwise treat it as the player's own Abort or Resign and let `conductOf` decide. Add a test for each phase (waiting,
versus/vote, after moves).

## 2. MAJOR: the opponent's Abort during my brief disconnect charges *me*, and the presser goes free

`packages/chess/src/duel/rules.ts:325` (`abort`/`no_first_move`: "exactly one gone → the gone one").

Presence is a bare socket check at the instant of the end, with no grace. A phone that backgrounds during the versus moment or the vote (iOS drops the socket
within seconds), a Wi-Fi to cellular handoff, or a reload are all "gone". If the other player presses Abort in that moment, the absent player gets the dodge
(−5/−10 RP, a mark, and a lockout from level 2), and the one who actually chose to leave pays nothing. Confirmed: `started(); go("b"); send("w", resign)` →
`conduct { b: "dodge" }`. It's also an escape: a dodger who waits for the other side's presence to flicker (the app shows `presence`) aborts for free.
The words are wrong for both players too. The presser's result says "You left before the first moves." with no cost line. The victim's says
"<them> left before the first moves. No rank change." (`packages/app/src/screens/Duel.tsx:176`), right above their own "Left before it started: −10 RP".
That contradicts the FAQ's "If your opponent was the one who left, you lose nothing" (`packages/app/src/faq/content.ts:385`).

**Fix:** track `goneAt[c]` (set in `disconnect`, cleared in `connect`), and count a player as "gone" for `conductOf` only after a grace (for example 10 to 15 s, a
`LEAVES.goneGraceMs` setting). Within the grace, a pressed Abort is the presser's dodge. For `no_first_move`, the side that sat on its move is charged as now
unless the *other* side was past the grace.

## 3. MAJOR: a no-show is charged even when the player never learned the game existed

`packages/chess/src/duel/rules.ts:323` (`no_show` → the absent player's dodge).

A ticket stays pairable for `ticketTtlMs` (**15 s**) after its app's last ask, but the room calls a no-show after `joinSeconds` (**10 s**). A phone that locks or
backgrounds while searching (common: the "Few players" wait is 45 s or more) can be paired in that gap. Its app never receives the code, so it never connects and is charged a
dodge. The second time, that's a 5-minute lockout. The design's "the server knows when it was at fault" applies here too: the server knows whether it ever *told*
that player the code (`placedIn` answered to their ask).

**Fix (either):** (a) the matchmaker marks a placement "delivered" when an ask returns its code, and `/api/1v1/cancel`, the room or `recordDodges` excuses a `no_show` whose
code was never delivered; or (b) simpler for L1: don't charge `no_show` at all until that's built (the FAQ's "or not turning up" goes too), and record
the call in `docs/decisions/`.

## 4. MINOR: a leave in the game that completes placements is charged, but the FAQ and the confirm say it isn't

`packages/server/src/ranked.ts:165`. On the last placement game `rankedGame` sets `n.ladder` (placed, `points` null), so `leaving && n.ladder !== null` takes
`leaveRp` off the fresh ladder. The FAQ (`faq/content.ts:388`, "In placements … just goes on your record") and `resignNote` (which uses the profile's
pre-game ladder, null, so it says "goes on your record") both say otherwise, and the result card's `points` is null, so the −10 is invisible except in the conduct line.
**Fix:** skip the fee when `change.placed` (charge 0 and mark only), or say it in the FAQ and the confirm.

## 5. MINOR: a ranked fee can be lost to a concurrent `recordDuel`

`recordDuel` writes `ladder = excluded.ladder` (`ranked.ts:177`), computed from a `before` read. Its optimistic guard compares only `games`, which a dodge
doesn't change. If a dodge's fee (`recordDodges`'s `UPDATE … ladder - ?`) lands between that read and the batch (for example, game A's recording retry after a D1 hiccup
while the player dodges game B), A's write overwrites it. The mark keeps `rp > 0`, but the ladder never paid it. It's rare, but it's money-like.
**Fix:** add `AND ladder IS ?` (the `before` ladder) to the guard, or apply the leave fee and the result as a delta (`ladder = MAX(0, ladder + ?)`).

## 6. MINOR: a ticket already in line isn't re-checked (second tab, or a dodge while searching)

`packages/server/src/queue.ts:120`. A second ask for the same account returns its existing ticket unchanged, and the lockout/delay check runs only when a ticket is
created (`index.ts`, first ask). A ticket made before the player was locked keeps pairing, and so does one made before they reached 3 marks (it has no `notBefore`).
For example, tab A is searching while tab B (or another device) dodges a game. **Fix:** re-read `rankedLeaves` on each ask that carries a ticket
(cheap: one indexed query), cancel the ticket on a lock, and set `notBefore` on a delay; or refuse to pair a uid that has an open duel room.

## 7. MINOR: a guest→account merge misplaces the guest's marks in the last-20 window

`packages/server/src/ranked-schema.ts:189`. The marks move, but each keeps the *guest's* `games`, while the window uses the *account's* `games`. If the account has more games
than the guest, the marks drop out of the window at once. If it has fewer, `max(0, …)` makes them count as the newest. Lockouts (time-based) carry over correctly.
This only affects servers without sign-in, so it's low impact. **Fix:** rebase `games` on merge (`games = games - guestGames + accountGames`, clamped), or document it.

## 8. MINOR: the server-restart race on a flag

A deploy drops every socket. If a clock's flag alarm fires after the opponent has reconnected but before the flagged player has, `timeout` with `present` `{flagged: false,
other: true}` is a leave. The "both gone → nobody" rule doesn't cover a staggered reconnect. The same `goneAt` grace from finding 2 (gone longer than N s) fixes it.

## 9. NIT: the privacy policy's words

`packages/app/src/screens/Legal.tsx:166`: "or soon after it did". A leave by abandoning (a flag while gone) can happen at any point in the game. Suggest:
"before it started, or by resigning very early or abandoning it".

## 10. NIT: notes

- `api.ts:671` (sign-out's new guest) calls `profile(sql, g.user)` without the kill-switch option. It's harmless (a new guest has no marks), but for consistency pass `leaves`.
- Lockouts are per account, so a second account on the same device bypasses them. The queue already hashes the device; it could check a device's latest lockout too. Leave
  this for A1 if you prefer, but name it in `2026-11-09-ranked-l1-not-yet.md`.
- While fair play holds a player, `games` doesn't increase, so their marks never age out of the window during a hold. Fine, but the FAQ's "Every game you finish
  pushes an old one out" isn't quite true then.

---

### Checked and fine
- **Charging once:** dodges use `INSERT OR IGNORE` keyed by (user, game), plus a fee `UPDATE` conditioned on the row having this nonce. Leaves are inserted only with
  `mine` in the game's batch. `asItStands` and `markOf` answer a lost-answer retry with no second charge. `DuelGame.recording` serialises within the room.
- **Both leaving:** `timeout` needs the opponent present, and `abort`/`no_first_move` with both gone → nobody.
- **Decided once:** `ended()` only sets `conduct` when it's unset (`{}` is truthy), and it's persisted with the record.
- **A recording that predates `conduct`:** `conduct ?? {}` means nothing changes for games already recorded or in flight, and `recordDuel`'s non-aborted path is unchanged when
  `conduct` is empty.
- **Migration:** `CREATE TABLE/INDEX IF NOT EXISTS`, additive. `SCHEMA_VERSION` hashes every statement, so the live DB re-runs `ensureSchema` once.
- **Data:** the download (`leaves`), delete (`rankedErase`), merge (`rankedMoves`), the 90-day purge on the `at` index, and the `account-data.test.ts` pin all cover the table.
- **Kill switch:** `penalties:false` in `recordDuel` (aborted → null; leave → no fee and no mark), the queue skips the lockout and delay, and `/api/me` returns `leaves: null`, so the
  app's confirms fall back to the old words. Conduct stays on the room's record but is never charged while the switch is on.
- **The math in `ranked-leaves.ts`:** level decay, `nextDodge` = the level now + 1, the window counting dodges' places, and the delay and lock thresholds all match section 4
  and the FAQ's numbers.
- **XP and the Welcome Crate:** neither is granted for aborted (dodge) recordings (`played`).
