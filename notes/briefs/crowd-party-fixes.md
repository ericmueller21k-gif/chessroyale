# The 50 v 50 Party, the fix round (PR #747). Opus, xhigh, alone

Effort xhigh (matchmaking, the lobby, the server, stored invites). `hub` delegate, across into matchmaking. Work on the PR's branch
`claude/crowd-party` (check it out from origin; merge origin/main first). Include `notes/briefs/rules-common.md`. The independent
review: `git show origin/review/crowd-party:review.md`. Full lane: a delta re-review follows, so list every fix in `.pr-body.md`.

## Do (the review's findings)
- **H1** a pooled member splits the party: don't treat a newcomer as `apart` when `msg.party` is a held `crowdParties` pass (the
  server sent them); a test with a pooled member.
- **H2** a party placed just before the fill is split: `reserveParty` requires `fillAt - now >= CAPACITY.queue.reservationMs`, else a new
  lobby; a test.
- **M1** "friends only" enforced on the server (the `crowdparty` invite branch checks `areFriends`); a unit test.
- **M2** reloads: on start, reconnect `currentParty("crowd")` as Squads' "Back to your party" does; join a placing while `lobbyStatus`
  says it's waiting, not by a 20 s age; a reloading leader keeps the lead. Tests for (a), (b), (c) of the review.
- **M3 (director's call until Eric answers):** a 50 v 50 match with a party in it counts as **unranked** (XP as usual); one setting so
  it flips when Eric decides; say it on the party screen in one short line ("Party matches aren't ranked") greyed under Find match.
- **M4** nothing shifts at the fill: keep rendering the party screen through the lobby and loading (close only the socket); the greyed
  Cancel once filled shows.
- **M5** the tests prove it: read the lobby's party group through a test hook (one team, every time, not by chance); an e2e step for
  the leader's Cancel bringing both back to idle; the leader leaving mid-search.
- **L1** latecomers after the hold seat as singles (or packing keeps the party's full size); **L2** block / Do Not Disturb revoke the
  party's admission (check the invites row at `hello`, or `crowdUninvited` from `block`); **L3** uninvite only when no `crowdparty`
  row for (to, code) remains; **L4** the crowd party's attachment by `memberId` (shared devices); **L5** an empty party stops asking
  and `Matchmaker.cancel` on Cancel; **nit** Do Not Disturb also hides earlier friend requests (its line says so). Check the notice
  doesn't cover the header's right buttons on a phone (a still).

Run the touched unit tests and the party e2e locally. Rewrite `.pr-body.md` (the fixes, the changed checks old -> new, M3's setting)
and write `.done`. No PRs, no CI waits, no model names in commits (end with the Claude-Session line only). Push work in progress.
