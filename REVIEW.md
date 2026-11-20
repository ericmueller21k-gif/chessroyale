# Review: PR #835, Battle Tower party play (`claude/tower-party` at `689330c`)

Independent review, read-only on the PR's code (lane: full; stored data, the server, a protocol). Read: the decision note
(`docs/decisions/2026-11-20-tower-party.md`), `docs/rules/eric.md`, `docs/areas/battle-tower.md`, the whole of server `tower.ts`,
`squads-party.ts` and `squads-do.ts` (kind "tower"), `lobby.ts` `takeTowerEnds` and `revokePartyMember`, `lobby-do.ts` `towerQueue`, the
routes (`index.ts`, `api.ts`), town chat (`town-chat.ts`, `live-hub.ts`, `TownChat.tsx`), friends' invite, the app's `tower-party.ts`,
`tower.ts` and `TowerDesk.tsx`, and the server tests. The PR's `tower-party.test.ts` and `tower.test.ts` pass (45 tests).

Findings 1, 4, 5, 6 and 7 were each confirmed with a throwaway vitest probe run against the PR's code (not committed; the key one is
in the appendix, ready to become a test). The rest are from reading the code, each traced end to end.

## Findings

1. **Blocker: floors won alone (the device's word) carry into a re-formed party, its party best and its crate floors.**
   `packages/server/src/tower.ts:623-630` (`partyPlan`: the floor is the lowest *copy's* floor) and `:682-688` (`preparePartyFloor`
   builds the floor from that copy). A copy played alone climbs by the device's word (`finishTowerFloor` with `kind: "party"`, held only
   to `soloWinMinSeconds`, 10 s a floor). When every member re-forming has played alone past the party's last floor, the lowest copy is
   still above it, so the party goes on from a floor it never reached as a party.
   *Scenario (probe P1):* Ann and Bo START a new party run and both leave before the party's 2nd move (free: both copies open on
   floor 1, nothing won as a party). Each sends 24 alone "wins" from a script (start, wait 10 s, finish "won"). They party up again: the
   plan is `continue` on floor 25. One party win there: each gets the floor-25 crate (`TOWER_PARTY.crateFloors`) and a party best of 25.
   Repeat for 50, 75 and 99. This breaks call 2 ("nobody is carried up a floor they didn't win with the party") and the design's §3
   (a crate is the server's word, a solo floor the device's), and makes the party best (later the leaderboard's) forgeable. Two accounts
   are enough.
   *Fix:* keep the party's own floor on each copy, e.g. `members.party`: the floor the copy last reached in a party write
   (`partyFloorWrite` sets it from the floor after; `commitPartyFloor` sets it to the floor begun), never moved by the alone routes.
   `partyPlan` then takes `min(copy.party ?? copy.floor)` over the copies, and the copies above it go back to it, which is call 2 as
   written. Old copies have no `party` field, so fall back to `floor` (nothing to migrate: no party copies exist yet). Add P1 as a test.

2. **Important: Open party lines can flood the town's chat, and nobody can mute or report them.** `packages/server/src/squads-do.ts:678`
   (posts the line), `packages/server/src/live-hub.ts:253` and `packages/server/src/town-chat.ts:333` (no limit). Each party posts one line;
   nothing limits how many parties an account opens. The only limit is `play` (40 a minute, counted per Worker instance) on
   `POST /api/tower/party`. A `sys` line has no sender, so it has no menu: no Report or Mute. It also skips what a typed town line must
   pass (`townPostResponse`: a moderator's chat ban, `chatBlock`, and the town's send limit), so an account a moderator has banned from
   chat can still post lines under its name.
   *Scenario:* a script makes 40 parties a minute, opens a socket to each, sends `{t:"open"}`. The town shows about 200 lines of "X is
   looking for 3 more to climb the Battle Tower" (each lasts `TOWN_CHAT.lineMs`, 5 minutes). Players' lines are pushed out past
   `holdMax`, and nobody can mute them.
   *Fix:* one party line per account in the town: pass the leader's uid to `townPartyOpen`, and the hub replaces that account's older
   party line. Before posting, run the town chat's checks for the leader (`chatBlock` and the ban case, as `townPostResponse` does);
   refuse with its words if they fail. A short per-account cooldown (say one line a minute) would also help.

3. **Important: after 5 minutes the town drops the line, but the party still shows Open party pressed and refuses to post it again.**
   `packages/server/src/squads-party.ts:607` (`openParty` refuses while `tower.open` is set) and `:635-638` (`takeLapsedOpen` never
   lapses it on time). The hub drops every line after `TOWN_CHAT.lineMs` without telling the party.
   *Scenario (probe P4):* Ann opens her party and nobody joins in 5 minutes. The line is gone from the town, but her card still shows
   Open party pressed and greyed (`view.tower.open` stays true, and `nextAlarm` has no time for it), and a new `open` is ignored. Her
   party can't be found again unless she leaves and makes a new one. The card says one thing while the town shows another (Eric's
   "nothing hidden").
   *Fix:* treat `open` as lapsed at `open.at + TOWN_CHAT.lineMs` (in `takeLapsedOpen`, with that time in `nextAlarm`) so the button comes
   back live. The `TOWER_PARTY` comment (`packages/core/src/settings.ts:1196`) also describes an `openLineMinutes` setting that doesn't
   exist; add it or drop the sentence.

4. **Minor (could be important while main deploys many times a day): taking a lapsed line out by its bare number can remove another
   player's line.** `packages/server/src/squads-do.ts:676` → `live-hub.ts:401` `townRemove(n)`. The town's chat is kept in memory only.
   Its numbers start again from 1 whenever the hub restarts (`town-chat.ts:214`, `private n = 0`), and every deploy restarts it.
   *Scenario:* Ann's line is number 41. A deploy restarts the hub, and new lines count up from 1. Ann's party then fills, and its Durable
   Object calls `townRemove(41)`, which removes the new line 41 (likely a player's message) for everyone, through `gone`.
   *Fix:* remove only that party's line: `townRemoveParty(n, code)`, which checks `sys === "party" && party === code` before removing.

5. **Minor (privacy rule): a deleted account still seated in a party gets a new copy, and its id goes back into the others'
   `members`.** `packages/server/src/tower.ts:713-714` (`commitPartyFloor`, new run). The party's Durable Object never hears that an
   account was deleted; its seat keeps the `userId`.
   *Scenario (probe P2):* Bo deletes his account from another tab while seated in Ann's party. Ann presses START (a new run). The batch
   inserts a copy for Bo's deleted id, which no later delete will ever remove, and writes Bo's id into Ann's `members`. "Delete must
   remove the id from others' members" is broken. A "continue" START is safe: its as-read check sees the members change and refuses.
   *Fix:* in the new run's batch, insert each copy with
   `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`, and refuse the commit when a member's account is gone (or check
   in `preparePartyFloor`, which reads the copies anyway).

6. **Minor (a call to confirm with Eric): the leader can end a member's climb by kicking them mid-floor.**
   `packages/server/src/squads-party.ts:442` (Kick has no state check, so it works after START) → `lobby.ts:1474`
   `revokePartyMember` → `leaveMatch(h, "kicked")` → `takeTowerEnds` "left" → `leaveFloor`: a loss once the party has made 2 moves.
   *Scenario (probe P5):* Ann and Bo continue their run on floor 40. Ann opens the party in a second tab and kicks Bo at move 3. Bo's copy
   is out, and his 40 floors are lost for something he didn't do. Call 6 lists "kicked" on purpose (so a kick can't be used to dodge a
   loss), but this side of it, a leader griefing a member, isn't weighed in the note.
   *Fix:* grey Kick during a tower party's floor (state "placed") and enable it again when the floor ends. The match's own AFK kick
   still applies, and neither side can be abused.

7. **Minor: one member's failing write holds back every member's result, and a failing crate grant has no lenient fallback.**
   `packages/server/src/lobby-do.ts:240-250` (a failure `break`s the loop) and `tower.ts:779` (the crate is granted, and must succeed,
   before the copy is written). Each member has at most one end per floor (`told`), so the order between members doesn't matter.
   *Scenario:* the floor-25 crate grant keeps throwing for Bo (a ledger fault). Bo's write and every write queued after it are retried for
   `MATCH_SAVE.retryHours` (24 h). Meanwhile everyone's plan says "…'s last floor is still being saved". Then the room closes,
   `settleStale` lets the floor go free, and the party's win is lost. The results path has a lenient rule (`MATCH_SAVE.strictMinutes`)
   for exactly this ("a lasting bug in one of them never costs the result").
   *Fix:* `continue` past a failed entry instead of `break`. After `strictMinutes` of failures, write the floor without its crate (and
   log it).

8. **Minor: the sign-in merge names the account twice when it already holds a copy of the same run, and scans the whole table.**
   `packages/server/src/tower.ts:568`.
   *Scenario (probe P3; only where sign-in isn't required, since in production guests can't sit in a tower party):* a guest and the
   account it signs in to both climbed run R with Cy. `replace()` gives Cy's copy `uids: [acct, acct, cy]`, and Cy's download says
   `climbers: 3`. Separately, `instr(members, ?)` over every party row runs inside every sign-in merge's one batch, and D1 holds other
   writes while it runs. That is a full scan of `tower_runs`, on a common path, for a case production can't reach.
   *Fix:* rebuild `uids` with `json_each`, skipping the guest's id when the account's is already there (as `towerDeletes` does), and
   run the statement only when the guest holds a party copy (or not at all where sign-in is required).

9. **Minor: an admin's `?win=1` party in production pays everyone in it.** `packages/server/src/index.ts:348`: `testSwitches()` is true
   for admins as well as where `TEST_SWITCHES` is "1".
   *Scenario:* Eric tries a `?win=1` tower party on the live site and opens it to the town. Players who Join win every floor with Qxf7,
   so they collect real XP, the 25/50/75/99 crates and a party best of 99 within minutes.
   *Fix:* allow `win` only where `env.TEST_SWITCHES === "1"`, or have a `win` party's room write no ends, crates or bests.

10. **Minor (UI): going back floors is neither said nor asked, and the floor room's button names a floor START may not play.**
    `packages/app/src/tower-party.ts:135` and `packages/app/src/town/TowerDesk.tsx:215`. On "continue", Ann's copy on floor 30 (played
    alone) drops to Bo's 5, and the plan only says "Your climb together goes on: floor 5." Losing 25 floors without being asked is close
    to the "asks first" Eric set for ending a climb. Separately, `TowerPartyUp` says "Up to floor N+1" whatever the plan says (a
    continue on a lower floor, or a new climb from floor 1).
    *Fix:* send each member's `from` floor in a continue plan, so the line reads "Ann's climb goes back from floor 30" and READY asks
    first, as it does for ends. Build the button's words from `plan`.

11. **Minor (Eric's rules: please confirm with the director): the clerk's panel hides the solo controls while you're in a party; the
    town line's Join says "Joined" too early.** `TowerDesk.tsx:111-112`: in a party, Continue or Start, Start over and Alone are swapped
    out for the seats. They come back only after Leave party, rather than showing greyed. The note calls it "one panel, the same size
    whatever it holds", but per `eric.md` an exception is Eric's to name. In `TownChat.tsx:62-76` the Join reads
    "Joined: see the clerk" once the socket opens, before the party accepts: a guest (refused: "Sign in to climb with a party.") or
    someone pressing Join on a party that just filled still sees "Joined". Its label also widens the pill, so the line can reflow.
    *Fix:* confirm the panel swap with Eric, or keep the solo row greyed under the seats. Set "Joined" on the party's `welcome`, and show
    the refusal's words otherwise.

12. **Tests: what's untested.** The PR's tests cover copies, re-teaming, ends, crates once, alone, merge and delete, the plan, START
    and the open line well. Missing:
    - (a) every member having played alone past the party floor (finding 1, the appendix's test);
    - (b) the Durable Object's START path (`makeTowerFloor`): a plan changed between READY and START, the room made but the commit
      refused, the raid kill switch. `squads-do.ts` has no unit test, and the e2e covers only the happy path;
    - (c) a failing write in `towerQueue` (finding 7);
    - (d) the open line's expiry (finding 3);
    - (e) Eric's typing rule for the new Join. The code is right (`TownChat.tsx` `onDown` returns on `.tc-join`, so the press never opens
      typing), but neither the rule's guard (`e2e/town-chat.spec.ts`) nor `tower-party.spec.ts` checks it. One `expect` after the Join
      click, that `.tc-form` didn't open, would do.

**Checked and found sound:**
- A device can't finish, stop or re-send a party floor (`fight.lobby`; `resultAgain` skips `party` lasts).
- The unique index keeps one open run of each kind per player.
- A new run's commit refuses next to an open copy whose holder didn't agree, and wipes nobody's copy then.
- The continue commit is all-or-nothing and only applies to copies as they were read; two parties racing for one member fail safely.
- Nobody new continues a run; it takes two or more.
- Deleting removes the id from the others' copies; the download gives a count, never who.
- A pass admits only its own account; `accounts` is never cleared, so a leaver is always told.
- The new routes use the same SameSite=Lax session and ban checks as the boss and 50 v 50 parties.
- Too-young devices get only "enter" lines, never party lines.
- Solo runs and old rows are untouched (`members IS NULL`); a party floor's quest is "tower"; the crate key pays once per account, ever.

## Verdict

Not ready to merge as it stands, but close. The design holds up well. The stored copies, the room's writes, the commits and the
device's exclusion from party floors are careful and well tested, and I found no way to forge a party floor's result directly or to
join a run you didn't climb. The one blocker is finding 1: the party's floor is read from copies the device can advance by itself, which
carries forged floors into the party best and the crate floors. That breaks the director's own call 2 and the design's §3. The fix is
small (keep the party floor on the copy) and should land in this PR with its test. Findings 2 and 3 are the town line's: one is open to
abuse (unlimited lines nobody can mute), the other stops working silently after 5 minutes. Both are cheap to fix and worth doing before
merge. The rest (4-11) can go in the same PR or a follow-up at the director's call. Findings 6, 10 and 11 need a word from Eric, since
they touch his rules or a call in the note.

## Appendix: finding 1 as a test (drop into `packages/server/test/tower-party.test.ts`, which has `begin`, `copyOf`, `best` and the imports)

```ts
it("floors won alone never carry a re-formed party above the floor it reached together (no forged crates or party bests)", async () => {
  const sql = await world();
  const [ann, bo] = [await signedIn(sql, "ann@example.com"), await signedIn(sql, "bo@example.com")];
  const first = await begin(sql, [ann.id, bo.id], T0);
  for (const u of [ann.id, bo.id]) await partyFloorWrite(sql, T0 + 1, first.fight.id, { uid: u, outcome: "left", moves: 0 }, { pool: POOL });
  let t = T0 + 10;
  for (const uid of [ann.id, bo.id])
    for (let i = 0; i < 24; i++) {
      const s = await startTowerFloor(sql, uid, t, { pool: POOL, kind: "party" });
      t += BATTLE_TOWER.soloWinMinSeconds * 1000 + 1;
      await finishTowerFloor(sql, uid, t++, { fight: (s.body as { fight: { id: string } }).fight.id, outcome: "won" }, { pool: POOL, minWinMs: BATTLE_TOWER.soloWinMinSeconds * 1000, kind: "party" });
    }
  // (Today: { kind: "continue", floor: 25 }, and one party win there pays the floor-25 crate and a party best of 25.)
  const again = await preparePartyFloor(sql, [ann.id, bo.id], t + 10, { pool: POOL });
  expect(again.ok && again.prep.plan).toMatchObject({ kind: "continue", floor: 1 });
});
```
