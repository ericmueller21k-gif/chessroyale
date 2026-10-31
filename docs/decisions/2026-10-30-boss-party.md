# Boss Battle's live party (Oct 30, 2026)

Eric's design (Oct 29 and 30) and his OK on the stills (Oct 30: "the solo or the party boss changes are fine"). Area:
[bosses.md](../areas/bosses.md), [squads.md](../areas/squads.md) ("Parties"). Plan and stills: part 2, step 1.

## Eric's rules
- Up to 3: you and two on the platforms behind you; invite only from their circles. A member's menu: View profile; the
  leader also Kick and Promote to party leader.
- READY / START: a member's START reads READY (a green check over their head); the leader starts once all are ready.
  Any change of boss or difficulty un-readies everyone (the difficulty: the director's reading).
- Everybody picks every move. Two or more on one move: played, always. No majority: the engine's best pick, unless two
  are within 30 centipawns, then one of those at random.
- You see your teammates' picks as they happen.
- 10 min + 10 s a move, one team clock; the boss has none; out of time loses (with solo: 2026-10-30-boss-battle-clock.md).
- The turn waits for everyone, no cap. One minute after a turn's first pick, the leader can kick whoever hasn't picked.
  An AFK teammate drains the team clock until kicked (Eric: fine; the kick is the fix).
- Bot members for admins and tests only.

## Calls (director; they stand, Eric Oct 30)
- Colors by seat (0 orange, 1 blue, 2 pink), the same on every device.
- Picks change until the turn resolves; the last pick resolves it.
- Any member's God King call acts for the team (`kingAnyCall`): his move at once, or his strike.
- A dropped member isn't waited for (the raid's `roundDone` already waits only for those connected).
- The leader is the one who hasn't picked: the members who have picked get the kick. The Kick chip is seen only by whoever
  may kick, grey for the turn's first minute.
- "Within 30 cp": the judge measures expected scores, not centipawns; `cpFromExpected` reads centipawns off them on
  Lichess's win-chance curve (expected = 1 / (1 + e^(-0.00368208 cp))).
- Never ranked; scored as a raid. The boss at the leader's difficulty: its Maia rating (`bossAloneMaia`) and its offset on
  the members' strength, as Boss alone.
- A party's battle waits BOSS_PARTY.joinWaitSec (30 s) after START for its members, then begins with those who came.

## Server (PR 2)
- The party is Squads' `PartyCore` and Durable Object (`PARTIES`) with kind "boss": no new class or migration. POST
  `/api/boss/party`, `/api/boss/party/CODE(/ws)`. Messages: ready, choose, kick (the token never back in, "You were
  removed from the party."), promote, start, bot (admins/tests), look.
- START makes a private raid lobby (`bossPartyOverrides`, `partyLobby`): only the party's pass and a free seat get in.
  The draw rule "party" (`partyMove`), `bossClockSettings`, `kingAnyCall`, `setTeamBank` (the turn's length off the team's
  bank: `finishRound`'s `teamMs`), live tallies to everyone, `partyKickable` / `kick`, the kicked seat passed back to the
  party (`takePartyKicks`, `kickSeat`). Settings in `BOSS_PARTY` (max 3, closeCp 30, afkKickSec 60, joinWaitSec 30).

## The review's fixes (#420, Oct 30)
- A kick bans the account as well as the token (`kickedUsers`), and closes the kicked socket.
- START gives each member their own pass; the battle admits that pass only to that member's seat, once, from that
  account (`PartyLobby.admits`). The AFK kick goes back to the party by member id; a kick at the stage after START revokes
  that member's pass in the battle, and puts them out of it if they're in (`revokePartyMember`).
- The battle never strands: nobody here when its wait is over, it waits again, and the first to come (or come back) after
  that begins it.
- One battle per START (the Durable Object's `making` guard); a placement is only ever its own START's (`starting.id`).
- Director's calls: a party battle is recorded but never counts as an online tier beaten (`bossElo` null); no fair-play
  signals from a party's battle (teammates see picks live). A member who has picked can still call the God King (the call
  replaces the pick).
- (The re-review) A kick in the battle's join window never closes it on the others (a party's battle doesn't close when
  its lobby empties; it starts with whoever comes, or closes when nothing happens). A revoke names the party and its
  START, and a battle under a reused code, another START's, or one that's over ignores it; a battle that's over tells its
  party, whose passes then go. The battle's AFK kick leaves the party's other pending revokes alone.

## The stage (PR 3)
- The invite circles are live: a tap makes the party the first time and opens "Invite friends" (the code, the link to
  copy or share, who's in, admins' bot buttons, Leave the party). `/boss/party/CODE` opens Boss Battle in that party.
- Members stand on the back platforms (seat order), their own dressed pawns; the crown over the leader (you too), the
  check over a ready member. A tap opens the menu above their head (View profile; the leader's Promote and Kick).
- The leader's START is greyed until everyone's ready; a member's button reads READY, then "READY ✓". A line under it,
  its room always kept: "Waiting for Maya to ready up", "Everyone's ready.", "Eric picks the boss and the difficulty."
- A member's tiles are muted and the arrows greyed (the leader's boss and difficulty); promoted, they keep them.
- Alone in a party (nobody joined yet), START is still Boss alone's. START with others: everyone joins the battle (the
  party's pass and their seat); the settings are core's `bossPartySettings`, the same as the server's.
