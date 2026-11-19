# Chandy's queen lock: the piece goes when the round hits it (Nov 20, 2026)

Eric: "It makes your piece disappear before the beam actually hits it ... make sure for the animation, it's like it moves towards your
piece ... it also looks like a pretty boring shot right now ... a particle shot that's not just dotted lines."

- **Why the piece went early:** the server takes it off the board as his turn begins (`chandyBattle.afterCrowdMove`), and the screen drew
  that position at once while the round was still to come. Now the board shows it on its square until the round reaches it
  (`chandyFen`, as Timber's and Don Dough's moments hold theirs), then it shatters.
- **Why it looked like dotted lines:** the round's `fly` loop never ended, so each square kept its own flickering bolt. Now one round
  (a hot head and a tapering streak) moves down the file a quarter square at a time, shedding sparks that cool and fade; `hit` stops it
  at the piece's middle, where the existing shatter takes over. `shotStepMs` (65 ms a square, was 60) in settings.ts.
- **Later (not built):** the hit piece should shatter with the same effect as the God King's king shattering (Dodge's `DODGE_KING`).
