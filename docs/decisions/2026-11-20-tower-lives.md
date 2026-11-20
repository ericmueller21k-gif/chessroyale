# The Battle Tower: two lives (Nov 20, 2026)

**Eric, Nov 20:** "2 lives I think is still the way to go. And yeah, it just takes you on to the next match, and it just counts. You
just advance. But then in your recap, it would show like that you lost like round, floor 8 or whatever." (Earlier: "add 2 lives, but it
doesn't make you replay. You just win the floor.")

This replaces the design's "One loss and you're out" (2026-11-18-battle-tower-design.md, §3). The rest of §3 stands.

## The rule

- A run has `BATTLE_TOWER.lives` (2). A floor lost, drawn, or left after your 2nd move costs one, and the climb goes on: the next floor
  is dealt exactly as after a win. A loss with none left ends the run ("out"): the third loss. Core `finishFloor` is the one rule;
  `leaveFloor` takes the pool now (a counted leave deals the next floor). The climb sim uses core's rule (`TOWER_LIVES` tries another
  number; it had its own copy of the rule).
- The run keeps the floors lost, in order (`TowerRun.lost`; a run that's out has the floor that ended it last). Stored in its deal
  (`met.lost`), with `met.won`, the highest floor won, once a floor is lost: a run with none lost is stored exactly as before, and a run
  saved before lives reads as none lost, both lives. No D1 change.

## Calls made (the director's or mine)

- **The best counts only floors won** (the director's call): a floor lost with a life spent counts as climbed for the run's floor,
  never for a best. The best is the highest floor won (`floorsWonBest`): lose 8, win 9, and the best is 9; lose 9 and 10 after winning
  8, and it's 8. The solo best reads `met.won` (`soloBest`); the party's and a copy played alone already wrote only wins.
- **A draw costs a life, as a loss** (the design already counted a draw as a loss). The recap lists it with the losses ("Lost floor 8").
- **Floor 99 lost with a life left** (mine): the climb is done all the same, the run "top"; the best is 98 (or the highest won). With
  none left, out on 99.
- **The party** (mine): the room writes one result to every copy, so the party's copies spend their lives together. A member who left
  a floor after the party's 2nd move spent a life on their own copy only. Climbing on together again, the party holds **the fewest lives
  any of its copies holds on that floor** (each copy's floors lost below it): nobody is given back a life they spent, as nobody is
  carried up a floor (the party rule's "lowest floor"). Floors lost alone above the party's floor go with the floors won there. The
  plan says the lives once one is spent ("Your climb together goes on: floor 9, 1 life left."), and a change of them changes the plan.
- **The sign-in merge** keeps comparing floors (the higher floor stays, whatever its lives): a floor lost still counts as climbed.
- **On screen** (Eric's rule, nothing hidden, nothing shifts): two hearts, a spent one greyed, always: in the run's strip (after
  "Floor N of 99"), the floor room's corner ("Lives ♥♥", as the Hidden Boss room's count) and the clerk's card (your solo climb's
  line: its hearts and "Lost floor 8", "No floors lost", or "Two lives a climb"). The clerk's line: "A climb of 99 floors. Two lives:
  the third loss ends it." After a floor lost with a life spent: "You lost floor 8. It still counts: 1 life left." and the next
  floor's line; back in the room the elevator is open to the next floor. The run's end: "Your run ended on floor 12." and the recap,
  "Lost floors 8, 11 and 12. Best solo: floor 10". A resign after your 2nd move reads as a loss ("You lost floor 8."); its confirm
  says "it costs a life (1 life left after)", or with none left, as before, "Your run ends here".
- **Pay:** unchanged code: a lost floor is a lost game (no win XP, no crate: crates are paid only on a party's win), the next floor's as usual.
