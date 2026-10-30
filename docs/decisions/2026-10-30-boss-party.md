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
