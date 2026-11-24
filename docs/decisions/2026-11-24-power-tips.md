# Power tips: the boss and the God King explain a power, the first time and now and then (Nov 24, 2026)

Eric (Nov 24): "the first time you play Hollow, for example, your king should have a line ... or Hollow says something ... it says it
once always the first time, but then maybe it comes up again in a game or two, and then maybe in like 5 or 6 games, and then after
that just every like 5 games against that boss ... just like one number ... start with ... 5 and I'll just play and see how those
actually feel." A pilot of five (Birdie's train, Hollow's dark, Sawyer's split, Chandy's lock, Boingo's pie): `packages/app/src/power-tips.ts`.

- **The schedule:** `POWER_TIPS` in settings.ts, one rule for every boss: the 1st, 3rd and 8th battle in which you see that power, then
  every 5th (13, 18, ...); a battle counts once, as the power's first moment comes; once a battle at most.
- **Per account on this device** (`brc.tips.<account id or "guest">.<boss>.<power>` in localStorage, like the replay's coach marks), not
  on the server: no stored data, the targeted lane. A store that can't be read shows the tip (better to explain than not).
- **The call: the exchange replaces both ordinary lines.** The boss's tip line is said in place of his own line for that moment, and
  the God King's other lines are held until his reply has had its time (no double talk), but for those that answer your own call
  (his strike, his move) and his fall. Fallen, he stays silent as always: the boss's line alone.
- Chandy's tip comes with his first lock at the end of a turn (`lockOn` without `first`), not a taught capture's. Boingo's line says
  "two splats ... freeze it" (the brief's "freezes": plural subject). The other lines are the director's draft, checked against the FAQ.
- Test switch `?tip=all`: every tip in every battle (stills, e2e).
