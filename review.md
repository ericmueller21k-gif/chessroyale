# Review: PR #673, the Hidden Boss's room challenge (read-only)

Reviewed: `git diff origin/main...origin/claude/hidden-boss-challenge` at `ffffd16c` (base `04296293`), and the PR body.
Effort xhigh. Tests: `npx vitest run packages/server packages/core` on the PR branch: **114 files, 1502 tests, all passed.**
No e2e runs, as the brief says. The failing cases below marked "probe" were run as a scratch vitest file against `HiddenRooms`. It was
deleted afterwards and is not on any branch.

**Verdict: no blockers. 1 major, 4 minor, 2 nits.** Nothing gives XP, coins or ranked from a forced win. Neither admin tool is
reachable by a player. The tie change can't alter any existing mode's result.

---

## Major

### M1. Banned accounts can take a place in the room and a seat in the fight

**Where:** `packages/server/src/hidden-room-api.ts:66-95` (`hiddenRoomResponse`), the `enter` and `challenge` actions.

**The problem:** Every other way into online play refuses an account banned for fair play: PLAY, `/api/lobby`, Squads, 1v1 and
`/api/boss/party` all go through `mayPlay` → `banCheck` (`packages/server/src/index.ts:522-528`). The room's route only checks three
things: signed in (`signedInReader`), not too young, and the kill switch. The ban is first checked at the fight lobby's WebSocket
(`lobby-do.ts:517`, `:565`), and by then the four are already made.

**Failing case:**
1. A banned account goes up the stairs: `enter` succeeds.
2. It taps Challenge and becomes the 4th.
3. `hiddenFight` makes the lobby with a pass for its seat, and the town's chat says "Banned, Ann, Bo and Cy are fighting the Hidden
   Boss."
4. Its hello is refused (`BANNED_MESSAGE`), so its seat stays empty.
5. `size` is 4, so the other three sit in the party lobby until `startBy` (`HIDDEN_ROOM.joinWaitSec`, 60 s) and then fight one short.

It can be repeated at will. Separately, a banned account can sit in one of the room's four places indefinitely as long as it keeps
polling.

**Fix:** Run the same `banCheck` (the account and the device cookie) for `enter` and `challenge`. Cache it beside `whoIs`, at most once
a minute. Answer 403 with `banned: true` so the app shows the ban notice. A unit check on `hiddenRoomResponse` with a banned case row
would guard it.

---

## Minor

### m1. A Cancel, Leave or re-enter racing the start loses a held seat, and the other three wait 60 s

**Where:** `packages/server/src/hidden-room.ts`:
- `cancel` at `:266-272` deletes the outcome unconditionally (`:270`).
- `enter` at `:168` deletes it on a new visit.
- `out`/`leave` during `starting` keep the seat ("it's theirs now"), but a device that has left stops polling and never reads the
  outcome.

**Background:** Devices learn about the start on their next look, up to `pollMs` (1.5 s) later. Until then their screen still shows
"3 of 4", Cancel enabled, or the "Cancel your game request?" sheet open.

**Failing cases:**
- **a. Cancel after the start (probe P1, confirmed).**
  1. a, b, c and d are in the room. a, b and c challenge, then d challenges, and `started(start, "ABCDE", passes)` runs.
  2. a's Cancel arrives, then a looks again: `{"in":false,"outcome":null}`. The fight outcome with a's pass is gone.
  3. a's client then sees `in:false` with no outcome and re-enters the room.
  4. Lobby ABCDE still has `size` 4 and a pass for a, so b, c and d wait the full 60 s.
  5. The town line has already named a.
- **b. Leave during the start (probe P3).**
  1. Someone taps "Leave and cancel" just as the 4th joins.
  2. `leave` runs while `starting`, so the seat is kept, but their client is `done` and never reads the outcome.
  3. The result is the same 60 s wait and a wrong town line.
- **c. A swept device re-entering (probe P2, confirmed; narrow).**
  1. a is swept out (silent) while the hub awaits `create` on the lobby DO. a's look returns `{"in":false,"outcome":null}`, so the
     client sends `enter` (`hidden-net.ts:148-155`).
  2. If that `enter` lands after `started()`, it erases the unread fight outcome: `{"in":true,"outcome":null}`.

**Fix:** Pick one rule and apply it to all three cases:
- **Either** a seat in a starting request is kept: `cancel` and `enter` keep an unread `kind: "fight"` outcome, and the app's
  `look`/`leave` still reads it.
- **Or** a cancel or leave after the start gives the seat back: tell the lobby to drop that pass and lower `pl.size`, the way
  `revokePartyMember` does, so the other three start at once.

### m2. The kill switch only gates `challenge`, so the admin's bots can start a fight while he rests, and it may not be him

**Where:** `packages/server/src/hidden-room-api.ts:90`, `live-hub.ts:324` (`hiddenRoom` → `R.due(now)`), and `runner.ts:351`
(`chooseBoss` over `rosterWithout(bossesOff)`).

**Failing case:**
1. An admin fills 3 bots and challenges.
2. `boss:recluse` (or `raid`) is paused.
3. The bots keep joining on the admin's looks, and the 4th bot completes the request via `due()`. No `challenge` call is involved, so
   no pause check runs.
4. The lobby's `bossesOff` now excludes recluse, so `chooseBoss("recluse", …)` falls back to a random playable boss.
5. The town line still says "…are fighting the Hidden Boss." The 🏆 is refused, because `winFormTrigger` sees a boss that isn't his.

This is admin-only, which is why it's minor.

**Fix:** Have `hiddenFight` check the pause too (the hub can read `isPaused(env, …)`) and end the request with the pause line. Or check
the pause on every action that can complete a request.

### m3. A forced win is stored as a real team win

**Where:** `lobby.ts:1410-1416` and `lobby-do.ts` `writeResult`.

**What's fine:**
- `tested` stops XP, quests and the daily reward (`gameXp` → `none: "test"`).
- A party is never ranked (`lobby.ts:3952`).
- The boss token goes by `battleCounts`, which is win or lose.
- The Welcome Crate doesn't depend on the result.

**What isn't:** `recordResult` still writes `team_won = 1`, `boss_id = 'recluse'` for every human in the fight. That includes up to
three real players in the four with the admin. It moves profile `teamWins` (`accounts.ts:1004`) and the fair-play review's "won"
counts (`admin.ts:199`). Solo's Win this form already does the same, so this is consistent, not new.

**Fix:** Either mark tested results in the row (or skip `team_won`), or accept it as solo does and say so in the decision note.

### m4. "One game request at a time" covers solo boss only, and costs every solo boss start a hub call

**Where:** `api.ts:593`.

**The cost:** `hiddenDrop` is awaited on every `/api/boss/solo/start` for every player, including the large majority who were never in
the room. That adds a round trip to the one global LiveHub on the critical path of every solo boss start.

**The gap:** PLAY queues, Boss Battle party START, Squads and 1v1 don't drop a room request. The room's `challenge` also doesn't check
whether the account is already queued or seated elsewhere. So with two tabs, a player can be in a Crowd queue and in the room's
four at once.

**Fix:**
- Use `ctx.waitUntil` (or skip the call unless the account was seen in a room, which the hub knows).
- Decide whether the other entry points should drop the room request too. Record it in the decision note either way.

---

## Nits

- **n1. The room never reports idle time.** `Town.tsx` `hiddenClient` sends `idleMs: 0` on every look, so the server's room AFK check
  (`TownHere.past` in `sweep`) only ever sees `hidden` and silence. The idle drop works in practice because the town's own away rule
  (`watchAway`) runs inside rooms and unmounts the town. The comments in `hidden-room.ts` and `hidden-net.ts` say the device's idle time
  drives it. Either send the away clock's `idleMs` or correct the comment.
- **n2. Two things appear rather than grey.** The "Nothing hidden, nothing shifts" rule applies here:
  - `HiddenCount` renders nothing at 0 and appears at "1 of 4". It's absolutely positioned, so nothing shifts. The rule's wording is
    about controls, so this is the director's call.
  - The admin's "Fill with 3 bots" button appears only once the first answer says `admin`, so an admin's card grows a row after it
    opens. It's admin-only.

---

## Checked, no finding

- **A 5th getting in:**
  - `enter` refuses at `members.size >= 4`, and bots count toward it. The hub is a single-threaded DO and `enter` is synchronous, so two
    enters can't both pass.
  - A 5th let in because the API was down self-corrects: the next `look` returns `in:false`, the client tries `enter`, and `onShut`
    sends it to the landing.
  - Guests watch uncounted, by design.
- **One person in two requests:** `where` is a single map per account, and `enter` elsewhere calls `leave` first. Two tabs of one
  account are one member, and at the lobby one seat per account means the second tab takes over that seat (`lobby.ts:914`).
- **A double start (two taps, two tabs, a retry):** `full()` sets `starting` synchronously before the hub's first `await`. A second
  `challenge`, `due()` or retry returns null or a no-op. A retried challenge after the start returns early, before the outcome delete.
- **A seat doubled at the hand-off:** Not possible. Admits are keyed by the pass, the account is checked (`admit.userId !== userId`)
  and so is the seat (`Object.values(pl.seats).includes(seat)`). Bots fill the free seats among 0 to 3 (`lobby.ts:1553`).
- **The cap during a start:** It's skipped while `starting` (`hidden-room.ts:338`).
- **NO_FIGHT:** The request ends and everyone stays in the room.
- **A hub restart:** Devices see `in:false` and re-enter.
- **Admin gates:**
  - **Fill with 3 bots:** `admin` is the server's word (`whoIs` → `ADMIN_EMAILS`). The API passes it and `HiddenRooms.fill` refuses
    anyone else. Bots only fit when the admin is alone, so they can't join a player's request.
  - **The 🏆:** `winFormTrigger` needs all of the following:
    - `attached.admin` from the DO's own `isAdmin`;
    - `party.room`, which only `live-hub.ts` sets (boss-party.ts never does);
    - a human sender;
    - his boss;
    - no result yet and not in results.
  - **No leaks:** `winForm` and `bossForceWin` are only restored from that lobby's record, and `newLobbyRecord` starts clean. Any other
    lobby ignores `{t:"winForm"}` (`message` returns).
- **The `partyMove` tie change:**
  - Only the draw rule `"party"` uses it, and only `bossPartySettings` and `hiddenRoomSettings` set that rule. Crowd and every other
    mode are untouched, and `packages/sim` doesn't use it.
  - `BOSS_PARTY.max` is 3, and bots fill only empty seats, so an existing party can never tie at two.
  - With one or no move at the top, the branches pick exactly what they did before, and every branch draws once from the rng. Stored
    and restored party battles therefore replay the same.
- **The protocol:** `{t:"winForm"}` is optional and passes `atTheDoor`. The app sends it only when `hiddenRoom` is set, which only the
  room's hand-off sets. Old clients never send it.
- **The room's own lobby paths:** `takePartyOver` and `takePartyKicks` are no-ops for `room`, so no PARTIES DO is called with an empty
  code.
- **The app's leave paths:**
  - Leaving asks on the stairs (`onPass`), back and Go out (`askIfWaiting`), and the side menu and back gesture (App's
    `LeaveTownConfirm` with `request={requestWaiting()}`).
  - "Leave and cancel" unmounts the room, which sends `leave`. `pagehide` sends `leave` (keepalive).
  - The summoning blocks every exit and every key.
- **No stuck screen:** An `ended` outcome shows a note and keeps you in the room. A `fight` outcome hands off to `joinLobby`, whose
  errors go through the normal path.
