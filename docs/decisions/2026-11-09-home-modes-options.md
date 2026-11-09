# Home: Solo queue | Party | Bots for 50 v 50 and Squads (Nov 9, 2026)

**Eric (Nov 9):** "solo queue, party, and then ... bots ... for 50v50 you can invite up to 8 people ... start a game instantly with 99
bots ... 1v1, there is no options ... squad, same thing ... only invite up to 3 more people, and then bots ... with 31 bots."

- 50 v 50: **Solo queue** (Default's queue), **Party** (Play with friends' lobby, its sheet titled "50 v 50 party", opened at once and
  by PLAY), **Bots** (Solo, through the Bot level box). Bots off has no button any more.
- The party's cap: `CROWD_PARTY_MAX = 9` (settings.ts) via `lobbyPeopleCap`: a private Crowd lobby takes 9 people ("This lobby is full."
  for the 10th), bots fill the rest when the host starts; the lobby screen says "Players (n of 9)". Raid and Classic lobbies unchanged.
- Squads: Solo queue | Party | **Bots greyed** ("Soon") until the follow-up's server part.
- Calls: a stored "botsoff" (tests use it: front-door, quests, matchmaking's Bots off test) still queues people only, shown under Solo
  queue; the people-only path stays for them, as the brief allows. Sub lines: "join a lobby", "up to 8 friends", "99 bots, now" /
  "join a squad", "up to 3 friends", "Soon" (fit 88 px buttons at 320 px). The Party option is stored ("party") like the others.
- The top bar's Friends button is untouched (another job changes it); the 50 v 50 party sheet is its own state, so it stays when that
  button stops opening "Play with friends".
