# Power tips: the boss and the God King explain a power (Nov 24, 2026)

Eric: "it says it once always the first time, but then maybe it comes up again in a game or two, and then maybe in like 5 or 6 games,
and then after that just every like 5 games ... start with ... 5." Pilot: Birdie's train, Hollow's dark, Sawyer's split, Chandy's
lock, Boingo's pie (`packages/app/src/power-tips.ts`).

- **Schedule** (`POWER_TIPS`): the 1st, 3rd and 8th battle in which you see that power, then every 5th; once a battle.
- **Per account on this device** (localStorage): no server data. An unreadable store shows the tip.
- **Replaces both ordinary lines:** the boss's tip line stands in for his line for that moment; the God King's other lines are held
  until his answer has had its time (not those answering your call, or his fall). Fallen, he stays silent.
- **Timing calls:** each line keeps its own time, as every line does (`e2e/boss-speech.spec.ts`; Eric: "a few seconds… not that long"), the answer starting as the line before has typed out (a first draft held the boss's line until the answer had typed out: up to about 1.2 s past its time, which that spec caught); with the God King mid-line, the exchange
  starts later, so his answer never lapses in his queue.
- Boingo's "freezes" became "freeze" (plural subject). `?tip=all` plays every tip every battle.
