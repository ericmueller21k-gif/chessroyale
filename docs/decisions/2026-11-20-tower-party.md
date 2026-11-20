# The Battle Tower's party (Nov 20, 2026; PR 12)

**Eric, Nov 20 (the spec):** "there should be a solo mode, and then there have an invite friends, or another option, which is like
basically like open party, and it maybe sends a message in the town that just says like player is ... looking for others to join ...
if several people team up but then they like have to take a break, how can they all team up again later from the same starting spot?
... everyone would ... want to be the host then, because they get to keep the ... seed. But ... if you give everyone a different one,
then they can just like invite other people. So I think what we need to do is everyone can keep that seed, but if you disband and then
don't play with the same party, then you can continue on your own, but it's just solo from that point forward ... the invite friends
one should just give a pop-up for your friends list."

This replaces the design's "whose run" paragraph (2026-11-18-battle-tower-design.md, §5 "The party": the leader held the run, the
others joined it): every member keeps a copy. The rest of §5 stands.

## What was built

- **The clerk's card** (`town/TowerDesk.tsx`): three ways, always shown: **Solo** (today's Start, Continue and Start over, and
  "Alone: floor N", your party climb played on by yourself), **Invite friends** (a party, and your friends list to invite from: the
  friends sheet, `InviteSheet`), **Open party** (a party, and its line in the town's chat, "Ann is looking for 3 more to climb the Battle
  Tower", with **Join**). Under them one panel, the same size whatever it holds: your solo climb, or your party's four seats, what START
  does (the plan) and READY or START, and Leave party. An option that doesn't apply shows greyed (Solo while in a party; Open party for
  anyone but the leader, a full party, or one already open).
- **The party** is Boss Battle's (`PartyCore` with kind "tower", the `PARTIES` Durable Object): up to `TOWER_PARTY.max` (4), seats,
  READY and START, Kick and Promote; one seat an account, accounts only, no bots. Its floor's match is a Boss Battle party's battle on
  the floor's settings (`towerPartySettings`: the party rule, ties always to the engine's best, `partyCloseCp` 0; the bosses at the floor's
  strength; no difficulty).
- **One run, a copy each** (server `tower.ts`): a party's run is one seed and one deal; each member holds a `tower_runs` row of kind
  'party', its `members` the run's key and who climbed it (`{run, uids, alone?}`). START begins the floor on every copy at once
  (`preparePartyFloor`, `commitPartyFloor`: one batch, all or nothing); the floor's match room writes each member's end to their copy
  (`LobbyCore.takeTowerEnds` → `partyFloorWrite`, beside its results, retried as they are), never a device.
- **Teaming up again:** the plan (`partyPlan`) reads everyone's copies: when two or more hold an open copy of one run and every one of
  them climbed it, they go on together; anything else is a new run from floor 1.
- **Alone after disbanding:** the solo routes take `kind: "party"` (your copy, played on the device; marked `alone`), the device's word
  as a solo floor.
- **The town's line** (`town-chat.ts` "party"): posted by the party's Durable Object through the live hub, taken out again when it lapses.
- **The floor room:** everyone's pawn walks in, in seat order and seat colors (`MATE_MARKS`, `mateAt`); the party's START is the way up
  from a floor won (`TowerPartyUp`).

## The calls (the director's reading of Eric's words, and mine)

1. **Every member keeps a copy**, written by the room for every member who started the floor: the same seed, deal and floor.
2. **Re-forming: the party's floor is the lowest of its members' copies** (the director's call): nobody is carried up a floor they didn't
   win with the party. Copies above it go back to it; their party bests stay (bests only rise).
3. **Nobody new joins a run already climbed:** a party with anyone new starts its own run from floor 1. A run's members are fixed at its
   first START (nobody joins mid-run; the design's "joining mid-run" is dropped).
4. **Starting a new party run asks first** whoever's open party copy it would end: a member's READY is their yes (the app asks before it),
   the leader's START carries `confirm`. Any change of plan un-readies everyone, and START checks the plan is still the one they saw.
5. **Two or more to START.** A party of one plays alone (Solo, or "Alone" for a copy).
6. **Leaving mid-floor** (Leave, gone too long, kicked): their copy takes their leave as the party's moves stood (free before the party's
   2nd move, else a loss: core `leaveFloor`, solo's rule), so leaving never dodges a loss; those still in at the end take the party's
   result; anyone admitted who never came, a free leave. The floor fails only as a party's battle does (mate, the clock, all gone).
7. **A party floor whose room has gone without its result** (only our failure gets there: the room's closing waits for its writes) is let
   go free, the same floor fought again; never a loss the room didn't see (`settleStale`, asking the room `holdsTowerFloor`).
8. **Played alone, a copy is solo from then on:** its floors won alone raise the **solo** best (the device's word, as every solo floor);
   the party best rises only with floors won as a party. Its members can still climb it together again later (call 2).
9. **Pay:** a party floor is the room's word, so its win pays XP's win (the lobby's XP, as any raid) and a crate on floors 25, 50, 75 and
   99, once an account (`tower:<floor>:<ledger id>`; not while rewards rest); its quests are "tower": any and win, never the boss
   quests. A copy played alone pays as solo.
10. **The merge and deleting:** deleting an account takes its id out of every other copy's `members`. On the sign-in merge a guest's id
    in others' copies becomes the account's (the brief said clear it; a guest **is** the account it signs in to, and clearing it would
    stop that person climbing on with their own party; the guest's id is gone from every copy either way). Guests can only be in a
    party where signing in isn't asked for (local, tests).
11. **Open party** is the leader's; its line lapses when the party fills, starts a floor, or its leader leaves (`takeLapsedOpen`), and
    with the town's other lines after `TOWN_CHAT.lineMs`. Anyone with the line's Join (or a friend's invite) comes in by the party's
    code, as Boss Battle's link.
12. **A tower party floor's settings** reuse `bossPartySettings` with 4 seats; the floor's strength is the run's, never a difficulty.

## Stored data

No new table or column: `tower_runs.members` (PR 9's, unused until now) holds a copy's JSON. The download names how many climbed a
copy, never who. The privacy policy's "The Battle Tower" says a party copy names the others.
