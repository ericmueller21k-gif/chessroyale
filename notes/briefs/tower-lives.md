# Battle Tower: 2 lives (Nov 20). Opus, xhigh, alone. FULL lane (stored run data, the server)

**Eric, Nov 20:** "2 lives I think is still the way to go. And yeah, it just takes you on to the next match, and it just counts. You
just advance. But then in your recap, it would show like that you lost like round, floor 8 or whatever." (Earlier: "add 2 lives, but it
doesn't make you replay. You just win the floor.")
- A run has `BATTLE_TOWER.lives` (2). A floor lost or drawn costs one and the run climbs on (the next floor dealt as after a win); the
  run ends ("out") at a loss with none left. Core `finishFloor` (and the sim's TOWER_LIVES, which already models it: reuse its rule).
- The run remembers which floors were lost (for the recap): e.g. `lost: number[]` on the run (stored with it: additive, old runs read as
  none lost and full lives).
- Party runs (PR 12, merged first): one shared life count per run; every member's copy the same.
- On screen (nothing hidden, nothing shifts): the lives always shown in the tower's bar and the floor room (hearts, greyed when spent);
  the result screen after a lost floor says the floor counts, a life is gone, N left; the run's recap (the clerk's card / the end)
  lists the floors lost ("Lost floor 8").
- Pay: a lost floor pays as a loss (no win XP, no milestone crate for it); the next floor's pay as usual.
- Tests: core (lives spent, climbs on, out on the third loss, lost floors kept, old runs), server (stored, party copies), one e2e (lose a
  floor, see a heart go, climb on). Decision note; battle-tower area page. Stills.
