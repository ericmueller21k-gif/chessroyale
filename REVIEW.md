# Delta review: PR #835, Battle Tower party play (`claude/tower-party`, `689330c..66d287e`)

An independent delta review, read-only on the PR's code. The lane is full (stored data, the server, a protocol). I read the first review
(`REVIEW.md` on `review/tower-party`), the author's write-up (`12b3e64:.review-fixes.md`) and the whole delta: server `tower.ts`,
`squads-party.ts`, `squads-do.ts`, `lobby-do.ts` (`writeTowerEnds`), `lobby.ts`, `town-chat.ts`, `town-chat-api.ts`, `live-hub.ts`,
`index.ts`, `api.ts` and `accounts.ts`; app `tower-party.ts`, `TowerDesk.tsx`, `Town.tsx`, `TownChat.tsx`, `ShopRoom.tsx` and the CSS;
the protocol and settings; `docs/rules/eric.md`; the new tests. The PR's `tower-party.test.ts`, `tower-party-do.test.ts` and
`tower.test.ts` pass (63 tests). Three throwaway vitest probes ran against the PR's code (not committed): A (below, under finding 1), and
the probes for new findings 2 and 7.

## The first review's findings: all fixed

1. **Fixed (the blocker).** `members.party` is set only by the party's own writes: the commit (the floor begun) and `partyFloorWrite`
   (the floor after). `startTowerFloor` writes `party` and `partyMet` once, as the first floor alone begins, and never again while
   `alone` (`tower.ts:369`). `finishTowerFloor`, `stopTower` and `settleStale` never touch `members`. `partyPlan` takes
   `min(floor, party)` (`tower.ts:668`). The appendix's test and the second case are in. The continue path's deal is taken from a copy
   on the party floor, or else from `partyMet` (`tower.ts:726-735`). The commit writes that one deal to every copy, so a copy going back
   leaves its floors dealt alone behind, and no crate or party best comes from them. *Probe A:* Ann, Bo and Cy climb to floor 3. Ann and
   Bo climb on to 5 without Cy, and Cy plays alone to 6. All three re-form: the plan is `continue` on floor 3 with `back` for all three.
   After the commit, every copy is on floor 3 with floor 3's original deal (`floors[0..2]` equal to Cy's `partyMet`) and
   `members = {run, uids, party: 3}`. Old copies: `party` falls back to `floor`. That's safe, because main has no party writes yet
   (`origin/main` has the `members` column but no `partyFloorWrite`), so no party copies exist in production.
2. **Fixed (flooding and the moderation checks).** Each account holds one line, a newer one replaces the older, and there's a 60 s wait
   between new ones (`TownChat.partyOpen`). The party's Durable Object runs the town chat's checks for the leader first: banned, a chat
   ban, the chat paused (`townPartyPoster`). The line carries the account's filtered name, and `dropAccount` takes it out with the
   account's other lines. *Left over:* the line is still a `sys` line with no `from`, so Mute doesn't hide it and it can't be reported
   (new finding 8).
3. **Fixed.** The line lapses at `open.at + TOWN_CHAT.lineMs`, with `at` reset when it goes up, and that time is in `nextAlarm`. The
   sentence about `openLineMinutes` is gone. Call 17's fix (lapse while a floor is under way, not on `state === "placed"`) is right.
4. **Fixed.** `removeParty(n, code)` removes a line only while it is that party's.
5. **Fixed, and safe.** `preparePartyFloor` refuses a seat whose account is gone (`gone`). For a new run, `user_id` comes from
   `(SELECT id FROM users WHERE id = ?)`, and `tower_runs.user_id` is `NOT NULL`. D1's `batch()` is one transaction (`accounts.ts:62-90`;
   the test database's `batch` is too, `memory-db.ts:20-29`). So an account deleted between the plan and the commit fails the INSERT,
   and the whole batch rolls back, the member DELETEs before it included: nothing is half-written. A continue START was already safe (the
   as-read check sees the copy or `members` change).
6. **Fixed, server and UI.** `kick` returns while `towerFloorOn` (`squads-party.ts:451`). The view carries `tower.floor`, and the seat's
   Kick is greyed for anyone but the leader and during a floor. The room's AFK kick (`kickMember`) still applies. *But* the flag can
   stick when a floor's room never reaches its results (new finding 2).
7. **Fixed.** `writeTowerEnds` passes over a failing entry. `failedAt` is stored with the record (`store(rec)` runs on failure too). A
   crate's grant stops holding its floor up after `MATCH_SAVE.strictMinutes`, and the failure is logged and counted. The crate's ledger
   key still pays at most once on a retry.
8. **Fixed.** The `json_each` rebuild is correct: it maps the guest's id to the account's, drops the guest's entry when the account is
   already there, and keeps the array's order. `json_set` keeps `party` and `partyMet`. The statement only runs when `holdsPartyCopy`
   (one indexed read). The race between that read and the batch can only leave a stale id in someone else's `members` where sign-in
   isn't required, and that only turns a later plan into "new", which asks first. Fine.
9. **Fixed.** `win` only where `env.TEST_SWITCHES === "1"` (`index.ts:349`).
10. **Fixed.** `back` is in the plan: "Ann's climb goes back from floor 30". READY asks first when it's yours, and the leader's START
    needs `confirm`, checked by the server (`squads-party.ts:555`). A changed `back` un-readies everyone (`setTowerPlan`), and START
    compares the whole plan, `back` included (`squads-do.ts`, `planOf`). The up button's words come from the plan.
11. **Fixed.** The panel has one layout: the party's half, then the solo half, whichever doesn't apply greyed. Join answers only on the
    party's `welcome` (`joinTowerPartyAnswer`: refusals end the client, `squads.ts:1220`, so `towerParty()` is null again). The town
    line's button is now one label, "Go to the tower" (`nowrap`). *But* the plan line can still grow past its three lines (new finding 3).
12. **Tests added:** (a) through (e) are all present. (b) is the new `tower-party-do.test.ts`: START with the plan readied for, a plan
    changed between READY and START, the room made but the commit refused, and the raid kill switch.

## New findings

1. **Important: `GET /api/tower/parties` fans each request out to the live hub and up to 12 party Durable Objects, with no cache and
   no sign-in, every 4 s for each card on screen.** `packages/server/src/index.ts:357-366`; the poll is in
   `packages/app/src/town/TowerDesk.tsx:40-49`. Each call is one `townParties` call to the live hub (one global Durable Object, the
   site's choke point for presence, live counts, town chat and friends' news) plus `towerListing()` on up to `listMax` (12) party Durable
   Objects. The town's own reads were built to avoid exactly this: each Worker instance caches the room for `TOWN_CHAT.readCacheMs`
   ("the hub hands its whole room to each Worker instance every readCacheMs", settings.ts:3805; `/api/live` is cached 3 s;
   `docs/areas/ops.md`, "The live line"). This route makes the hub's load per reader again, and it's open to guests. The only limit is
   the general per-address one: 10,000 a minute, per Worker instance.
   *Scenario:* a script without a session calls `/api/tower/parties` in a loop. At the per-address limit that's about 166 hub calls a
   second per address per Worker instance, plus up to 2,000 party Durable Object calls a second once 12 parties are open. Spread over
   a few addresses, it can slow the hub and with it the online count, town chat and presence for everyone. Real use: 1,000 players at the
   clerk's card make 250 hub calls a second, plus up to 3,000 Durable Object calls a second.
   Also, small: the codes are capped at 12 *before* filtering, so non-joinable entries can push joinable ones off the list; and a code
   held twice (a failed removal, then the new leader's line) would render two rows with one `key`.
   *Fix:* take the codes from the Worker's cached town snapshot, which already carries each line's `party` (`townSlice`'s cache). Cache
   the assembled list per room per Worker instance for `TOWN_CHAT.readCacheMs` (or `listPollMs`), so it costs one hub read and at most 12
   party calls per instance per window, not per reader. Dedupe the codes, and filter before capping (ask a few more than `listMax`).

2. **Minor: the "floor under way" flag (`passes`) never clears when a floor's room doesn't reach its results, so Kick stays greyed, Open
   party is refused and the party stays off the list.** `packages/server/src/squads-party.ts:617-619` (`towerFloorOn` reads `passes`),
   `:521-523` (only `battleOver` clears them), `packages/server/src/lobby.ts:1452-1455` (`takePartyOver` only in `results`, once), and
   `packages/server/src/lobby-do.ts:712` (a failed `battleOver` call is logged, not retried).
   *Scenario (probe):* Ann presses START, but nobody reaches the floor's room (both phones drop at that moment). The room never starts,
   since `startBy` needs someone connected, and closes idle without reaching `results`. Or the room ends but its one `battleOver` call to
   the party fails. A day later the party still shows `tower.floor`: Kick is refused (a connected member who never READYs can't be
   kicked, so START can't happen), Open party is refused, and `towerListing` is null. The copies themselves are fine (`settleStale` lets
   the floor go at the next read). It clears only when another floor completes, or when the leader leaves.
   *Fix:* let the party end the floor itself once the room has let it go. For example, after `placedIn`, set the party's alarm for the
   room's idle-close time and ask the room `holdsTowerFloor(fight)` (already used by `settleStale`); when it's gone, run
   `battleOver(placedStart)`. Or retry `battleOver` from the room until it's taken.

3. **Minor (Eric's "nothing shifts"): the plan line grows past its three lines for a four-member party, and everything under it moves
   down.** `packages/app/src/tower.css:211-212` (`min-height`, not `height`) and `TowerDesk.tsx:146`. The card is 272 px wide at 12 px,
   about 43 characters a line.
   *Scenario:* Ann leads Bo, Cy and Di back onto their run after the other three played on alone. The line reads "Your climb together
   goes on: floor 5. Bo's climb goes back from floor 30, Cy's from floor 12, Di's from floor 9. Waiting for Bo, Cy." With 10 to 16
   character names that's 4 or 5 lines: READY/START, Leave party and the solo half move down, and the card grows (a `new` plan ending
   three climbs does the same). The line also changes length as people READY, so the rows under it move while you look.
   *Fix:* a fixed `height` for three lines, with words that fit. For example: "Your climb together goes on: floor 5. 3 climbs go back." The
   names and floors can go in the READY/START confirm, which already exists. Drop "Waiting for …": the seats' ✓ already show who's ready.

4. **Minor (what the list reveals): the list ignores the age gate and the town chat's pause, both of which hide party lines in the
   town.** `packages/server/src/index.ts:357`; compare `api.ts:292-299` (`enterOnly` for a too-young device, `{paused: true}` while the
   town chat is off). On a device the age gate marked too young, the town never shows party lines, but the clerk's card lists them,
   leaders' names included, and its Join is live. While the town chat is paused, the list still shows lines posted before the pause.
   Otherwise it reveals no more than the line does: the leader's name, already filtered (`seatName`, the same as the line's
   `isBlockedText`), the code, which the line already carries, and a live head count.
   *Fix:* answer `{ parties: [] }` when `ageAnswer(request) === "under"` or `isPaused(env, "town-chat")`. The card already says
   "No open parties right now."

5. **Nit (Eric's "nothing shifts"): the list box overflows by 3 px with exactly three parties.** `tower.css:62-82`. The list is
   `3 × 32 + 2 × 3 = 102 px` tall, but three rows with `margin-bottom: 3px` take 105 px. A computer browser with classic scrollbars
   (Windows) shows a scrollbar for those 3 px, and the rows narrow by its width whenever it appears (with 4 or more parties too).
   *Fix:* `.tw-open-row:last-child { margin-bottom: 0 }` (or a grid with `gap`), and `scrollbar-gutter: stable` on `.tw-open-list`.

6. **Nit: an abandoned "Go to the tower" still lands you by the clerk on your next visit, and the button is live but does nothing during
   a boss's challenge walk.** `packages/app/src/town/Town.tsx:428-449`. `toClerk` is cleared only when a building is entered.
   *Scenario:* Bo presses "Go to the tower", then taps elsewhere before he reaches the door. Ten minutes later he walks into the tower by
   its door card and starts by the clerk with his card open, not at the door. Separately, on the street while a challenge plays
   (`flow !== "town"`), the pill is live but `goTower` returns.
   *Fix:* clear `toClerk` when the town's walk to the door ends without going in. Pass `onGoTower` only when `flow.current === "town"`,
   so the pill shows greyed then. It never bypasses a room's own way out: it's greyed inside other buildings and on tower floors, and an
   elevator walk-in's timer still takes you up.

7. **Nit: a party "closed" to the town (`tower.closed`, a run's own members climbing on) still seats anyone with its code.**
   `squads-party.ts:314` (`connect` doesn't check it). Probe: Ann and Bo's plan is `continue`, and Zed connects: `ok`. The only way in
   for a stranger is a list entry up to 4 s stale. It does no harm, because the plan turns to a new climb, which asks the run's members
   first, and the leader can kick. Worth a sentence in the decision note, or a refusal with words while `towerContinues`.

8. **Nit (finding 2's leftover): the party line has no sender, so Mute doesn't hide it and it can't be reported.** `town-chat.ts:345` →
   `notice(…, "party", code)`, with no `from`; the app mutes by `uid` (`TownChat.tsx:151`). With one line an account, at most one a
   minute, this is low impact. *Fix (optional):* put the leader's id on the party line as `from`, so it gets the name's menu and Mute
   hides it.

9. **Nit: a deleted member still connected keeps the party re-reading every 3 s for as long as their socket stays open.**
   `squads-do.ts:733`: every refusal asks for a recheck, `gone` included. Nothing but a kick or a leave changes `gone`, and both re-read
   anyway. `resting` and `broken` already behaved this way before the delta. *Fix:* no `recheck` for `gone`.

**Checked and found sound:**
- The town line: one line an account (each instance's numbers are unique, so replacing one never removes another player's line),
  the cooldown with its words (`openRefused` tells the leader), the moderation checks, `townRemoveParty`, and the lapse on a floor
  under way.
- Kick is refused from START (`starting`) to the room's end, on the server and in the UI. Promote, Leave and the room's AFK kick are
  unaffected, and a kick after `battleOver` revokes nothing.
- Joining from the list: Join is greyed while you're in a party. Guests and full parties are refused with the party's words, and the
  client ends on a refusal. Your own party reads "Joined". A closed party drops off the list (its Durable Object answers null), and so
  does a lapsed line (gone from the hub).
- "Go to the tower" never bypasses a room's own way out: it's greyed in every other building, the Hidden Boss's room included, and on
  tower floors. On the street it only runs while `flow === "town"`.
- The typing rule (`docs/rules/eric.md:112-114`): its new text names the party line's button, and its guard (`e2e/town-chat.spec.ts`)
  is unchanged. `e2e/tower-party.spec.ts` checks `.tc-form` stays closed after the press. The pill has one label and never changes size.
  The Kick button fits the seat's 28 px, and the seats are two fixed halves.
- No new stored columns. `party` and `partyMet` live in `members`, which the download never exposes (it gives `climbers` and `alone`
  only).

## Verdict

Every finding from the first review is fixed, including the blocker. The party's own floor (`members.party`, `partyMet`) can't be moved
by the alone routes. A re-formed party goes back to the right floor with the right deal, for a three-member split as well. Old copies
are safe because none exist in production. The deleted-account refusal is all-or-nothing in D1's batch. `writeTowerEnds`, the
`json_each` merge, the town line's per-account rules and the Kick refusal are all correct. Nothing here blocks the merge. The one
finding I'd fix before merging is new finding 1, the open-parties route: it's uncached, open to guests, and makes up to 13 Durable Object
calls (the live hub among them) per request, every 4 s for each card on screen. A per-instance cache built from the town snapshot each
Worker already holds makes it cheap. Findings 2 to 4 (the stuck floor flag, the plan line growing, the age gate and pause) are small and
fit in this PR or a follow-up, at the director's call. Finding 3 touches Eric's "nothing shifts", so it shouldn't wait long. Findings 5
to 9 are nits. With finding 1 fixed: ready to merge.
