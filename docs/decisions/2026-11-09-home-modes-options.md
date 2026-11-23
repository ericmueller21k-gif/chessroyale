# Home: Solo queue | Party | Bots for 50 v 50 and Squads (Nov 9, 2026)

**Eric (Nov 9):** "solo queue, party, and then ... bots ... 1v1, there is no options ... squad, same thing ... only invite up to 3 more
people, and then bots ... with 31 bots." **Then (Nov 9, via the director):** a 50 v 50 party is NOT the private lobby: it queues together
into the normal public 50 v 50 matchmaking with real people ("like Fortnite squads"), sides random, ranked, up to 8 (you + 7), bots
filling only empty seats. The private lobby (code/link, up to 100) stays as it is, reached from the friends overlay.

- 50 v 50: **Solo queue** (Default's queue), **Party greyed** ("Soon"; tooltip "Queue with up to 7 friends (soon)": a greyed option
  can't be picked, so the line above PLAY never shows it), **Bots** (Solo, through the Bot level box). Bots off has no button any more.
  `CROWD_PARTY_MAX = 8` in settings.ts for the future party, unused by the server; the private lobby's cap is unchanged.
- Squads: Solo queue | Party (as today; its line "Queue with up to 3 friends") | **Bots greyed** ("Soon") until the follow-up.
- Calls: a stored "botsoff" (tests use it: front-door, quests, matchmaking's Bots off test) still queues people only, shown under Solo
  queue. Sub lines: "join a lobby", "Soon", "99 bots, now" / "join a squad", "up to 3 friends", "Soon". The "Play with friends" sheet's
  code is untouched (the top bar's Friends button is another job's).
