# Boss Battle's clock: 10 + 10 (Oct 30, 2026)

Eric (Oct 30): "a normal time control for all bosses probably just 10 min + 10 per move"; seeing the part 2 stills: "the
solo or the party boss changes are fine". It replaces his Oct 21 call (Boss alone untimed,
[2026-10-21-boss-alone-untimed.md](2026-10-21-boss-alone-untimed.md)). Area: [bosses.md](../areas/bosses.md).

- **Boss alone** plays on `BOSS_CLOCK` (600 s bank, 10 s added as each move begins, no cap on one move; the boss has
  none): `bossClockSettings` on `RAID_SETTINGS.bossAloneClock`, applied by `SoloMatch` for a raid without bots. The
  party (part 2) uses the same clock as the team's one bank.
- **Out of time loses**: `bossClock` makes the runner's `bossOutOfTime` count an empty bank as it did only under the
  Hidden Boss's bullet clock (the move isn't played; "won on time").
- **Kept**: a Solo raid's raid clock; `?clock=N` (now `bossAloneClock: false`) for the clock and missed-move tests; the
  Bullet replaces the bank when it comes; phase 2's own clocks.
- **On screen**: the dock's clock now shows from the first move (10:10), with "+10" rising as each move begins (as the
  bullet clock's "+2"); the timer bar and the last seconds' 3-2-1 as on any timed boss battle.
- Player-visible text: the FAQ's Boss alone line, "and there's no clock: take as long as you like." → "on a 10 + 10
  clock: 10 minutes for the battle, and 10 seconds added as each move begins. The boss has no clock. If yours runs out,
  the boss wins on time."
