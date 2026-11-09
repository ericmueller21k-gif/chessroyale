# Delta review of #582 (ranked L1): the review's fixes

Reviewer: independent, read-only (xhigh). Reviewed only `854d04d` on `claude/ranked-l1` (with `.review-fixes.md`; `e347b59` only brings main in,
`399b5c5` only adds the summary). No conflict markers in the delta or the branch's `packages/` and `docs/`.

Checks: `npm ci` ok; `npm run typecheck` ok; the requested vitest set: 35 files, 516 tests, 515 pass. The one failure is
`app/test/duel.test.ts` "the result card…" **timing out at 5 s** on the cold dynamic `import("../src/screens/Duel.tsx")` in this container; it
passes with `--testTimeout 60000` (5.5 s), and main's test has the same import, so it's not the delta's (see N3). Scenarios below were confirmed
with a throwaway vitest on `DuelCore` (deleted afterwards).

**Verdict: no blocking findings.** All ten findings are fixed as described. One medium gap the grace didn't reach (the no-show, D1), and three minors/nits.

---

## Each finding

| # | Fixed? | Notes |
|---|---|---|
| 1 Cancel | **Yes** | `cancelled()` excuses only `!game && !seen[c]`; after the end it's a no-op. `seen` is set on `hello`. The real app never sends Cancel after it got a code (`start()` stops and the button's `cancel()` returns when stopped), so Cancel-after-seen is reachable only by hand, and is then exactly the Abort/Resign (confirmed: connected, waiting, `cancelled("w")` → `abort` by w, `{w: dodge}`), as the FAQ now says. |
| 2 Grace + words | **Yes** (except the no-show, D1) | `goneAt` set in `disconnect` (with the closing socket skipped, so `connected` is right), cleared in `connect` *after* `advance()` (a flag that fell while away is judged with the old `goneAt`: correct). `away()` judges at `end.at`, not at "now", so a late alarm or a wake doesn't move the line. Result words: `left` drives `calledOff`; kill switch/held (`outcome` without `conduct`) reads "No rank change." for both; "Updating your rank…" only while your own dodge isn't recorded. |
| 3 No-show | **Yes** (option a) | `told()` runs before the answer leaves the matchmaker, `deliver()` is once per placement, the game is created before `place()` so `delivered()` never meets a missing record. A failed or late `delivered` is lenient (nobody charged). See M1 for the one way "told" can be wrong. |
| 4 Placing game | **Yes** | `!change.placed` skips the fee, the mark keeps `rp 0`; matches `resignNote` and the FAQ. |
| 5 Fee race | **Yes** | `ladderNow IS ?` per player: `NULL IS NULL` for a player with no row or in placements, INTEGER vs bound number compares by value. The loop is bounded (4 tries, then throws; the room retries on its alarm, `RECORD_TRIES`), so it can't spin; the only other ladder writer is the dodge fee, so a live retry storm needs a dodge per try. A result is lost only after 4 × 4 contended tries, as before. |
| 6 Ticket re-check | **Yes** | `restrict` touches only tickets in line (`byId`); seating/placed tickets aren't in `byId`, so an already-placed ticket keeps its game and is answered with its code (200, by the `!("code" in answer)` guard). A dropped ticket → `expired` → the route answers 403 with the lock; the app shows it (`!res.ok` → refused). `notBefore` set once. A failed read changes nothing. See M2. |
| 7 Guest merge | **Yes** | Rebase runs before the guest's rank row is deleted (order swapped correctly); after the copy-if-none statement the account's `games` equals the guest's, so a copied rank leaves the marks' places unchanged; `?1/?2` numbered params are fine on D1. |
| 8 Staggered reconnect | **Yes** for flags/aborts | `advance()` stamps `goneAt = now` on a seen side with no socket and no heard close; judged at `end.at ≤ now`, it's never "away". Not for the no-show: D1. |
| 9 Privacy words | **Yes** | |
| 10 Notes | **Yes** | sign-out passes `leaves`; not-yet file names the second account and the held window; the FAQ's window sentence fixed. |

**Persistence (asked):** `seen`, `goneAt`, `delivered`, `excused`, `conduct` all live on `DuelRecord`, which `change()`/`persist()` store under `"game"`
whenever its JSON changes (and `hello`/`alarm` always persist), so they survive hibernation, eviction and a restart. If `goneAt` were ever missing
(a close never heard), `advance()` restamps it from "now", which only makes the rule more lenient. `told` in the matchmaker is memory only, but so is
the placement it guards: an evicted matchmaker forgets the code too, so it can never answer the code untold. **`left`:** in the shared view, so
both players get it in `game` and `welcome`; `ended()` now runs before every `broadcastGame()` that can carry an end (move, resign, draw, advance,
connect→advance); an older app ignores the field, an older server sends none (the app falls back to "No rank change." for `by`'s other side).

---

## D1. MEDIUM: the no-show has no grace, so "a moment away" before both are there together is still a dodge

`packages/server/src/duel-room.ts:236-241` (`advance`: `here` = sockets at `joinBy`; `by` = the other).

The grace covers Abort, a missed first move and a flag, but the no-show still reads bare sockets at `joinBy`. Confirmed: B connects at +1 s, B's
socket closes at +8 s (phone locks, a reload, a handoff), W connects at +9 s (first time), `joinBy` at +10 s → `no_show by b`, `conduct {b: dodge}`,
with `goneAt.b` = +8 s (gone 2 s). B was told and had the game open; they pay −5/−10 RP and, from level 2, a lockout. The same happens to a deploy
during the wait if the late side reconnects after `joinBy`. The FAQ now promises the opposite in the same bullet that lists "not turning up":
"A moment away isn't leaving: you count as gone only after 12 seconds without a connection".

**Fix (a few lines):** in `advance()`, name the absent side only if it's away by the grace at `joinBy`:
`by: here.length === 1 && this.away(other(here[0]!), this.r.joinBy) ? other(here[0]!) : null` (`away()` is already true for a side never seen,
so the plain no-show is unchanged). Optional nicer variant: hold `joinBy` open until a seen side's grace runs out, so the game can still start.
Add the scenario above to duel-room's grace tests.

## M1. MINOR: "told" means the server answered, not that the app heard

`packages/server/src/matchmaker.ts:398-408` (`told` before `return`).

`delivered` is set when the matchmaker answers the ask, not when the answer arrives. An ask held up to `holdMs` (2.5 s) whose phone locks or
backgrounds during the hold gets `delivered`, and the app may never process the code (iOS suspends it, or the response is lost), so it's
charged a no-show. The window is now 2.5 s per ask instead of finding 3's 15 s, so it's much rarer. Fine for L1; if it shows in playtests,
count "told" from the app's own next step (its `GET /api/1v1/game/CODE` or the WebSocket upgrade, before `hello`) instead.

## M2. MINOR: a locked account's ticket that's being seated is answered 403 but stays in the queue

`packages/server/src/index.ts:341-346` with `queue.ts:229` (`restrict` only sees `byId`).

If the re-check finds a lockout while the ticket is in `seating` (not in `byId`), it isn't dropped; if that ask then ends without a code, the
route answers 403 and the app stops asking. A failed seating puts the ticket back in line (`queue.ts:252-256`), where it can still be paired
until `ticketTtlMs` with a player who has left (never told, so it's nobody's no-show, but the opponent waits `joinSeconds` for nothing). Rare
(the lockout must land during a seat). Fix: when answering 403, also `cancel(ticketId)` (as the app's Cancel would), or have `restrict` drop a
seating ticket too.

## N1. NIT: the Abort confirm doesn't say to wait for an opponent who just went away

`packages/app/src/ranked.ts:122` (`abortNote`) and the strip's "away" tag (`Duel.tsx:400`). The tag shows the instant the opponent's socket
closes, which invites Abort, which is now the presser's dodge for 12 s. The FAQ explains it, but the confirm says the same
"Leaving before it starts costs X" whether or not the opponent has been away past the grace. A line in the confirm while the opponent is
away ("Bo is away. If they're not back in 12 seconds, leaving costs you nothing.") would follow "nothing hidden". Copy only; L2 is fine.

## N2. NIT: "over 12 seconds" vs `>=`

`faq/content.ts` says a flag is a leave "while you've been gone over 12 seconds"; `away()` uses `at - since >= goneGraceMs`. Exactly 12 s
counts. Say "12 seconds or more", or use `>`.

## N3. NIT (not the delta): `duel.test.ts` "the result card" times out cold

Its first `await import("../src/screens/Duel.tsx")` took about 5 s here (5.0 s limit, failed alone and in the batch; 5.5 s with a longer limit).
Same import on main. On a slower CI runner it may flake. Give that `it` a 20 s timeout, or import `Duel.tsx` once at the top of the file.

---

### Checked and fine
- **Grace vs alarms:** no alarm is needed for the grace: every decision is made at `end.at` from the stored `goneAt`, whether the end is an Abort
  (now), a flag (its deadline, even if the alarm runs late) or a missed first move. A game ending inside the grace treats the gone side as there
  (intended: the presser pays; a flag is a plain loss).
- **`deliver()`/`told()` races:** two asks at once: `deliver()` is synchronous, so only the first calls `delivered`; the second may answer
  before that call lands, but the app then connects (`seen`), which counts as knowing anyway. `delivered` after the no-show has been decided
  doesn't reopen `conduct` (decided once).
- **No new exploit from the grace:** a dodger who closes the app is still charged once 12 s pass (a missed first move takes longer than that);
  abandoning with under 12 s on the clock is a plain loss, which costs about the same.
- **Kill switch:** the re-check is skipped when `leave-penalties` is paused, as the first ask is.
- `rankedMoves` statement order, the `?1/?2` bindings and the clamp; `!change.placed`; `left` only once `conduct` is set.
