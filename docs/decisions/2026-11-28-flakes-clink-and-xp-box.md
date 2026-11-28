# Two flakes, both real app bugs (Nov 28)

Brief: fix the xp.spec and boss-result.spec flakes at their cause.
- **A clink a coin.** The clink gate (one at most every 90 ms) measured frame times, so a slow frame and then a quick one could drop a
  coin's clink (4 for 5 on #1027). A held-back clink is now owed and plays on a later frame; the cascade waits for the last.
- **XP EARNED kept its height.** While waiting it shows "+0" and "Counting your XP…"; a no-XP result swapped both for one line and the box
  shrank 21 px, so the boss's row jumped up ("nothing shifts", eric.md). The parts line's room stays under the why line (padding).
