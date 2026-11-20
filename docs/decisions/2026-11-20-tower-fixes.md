# Tower fixes from Eric's phone playtest (Nov 20, 2026)

Eric, Nov 20, playing the Battle Tower on his phone: (1) "the black horse green color on the tile should be behind the 'cut' on the
board. It overlaps it weirdly." (2) "Disable wrangler ult plz in battle tower". (3) "is baburs balloon missing from the battle tower?
Didn't see it during the game."

- **Sawyer's cut over the highlights:** while his cut's groove (`.sw-cut-board`) or the board saw's gap (`.sw-gap`) is on the board,
  the last move's, the selection's and check's square tints drop to z-index 0, under his layers (1); the pieces (2) stay over all.
  CSS only (`styles.css`, by `:has()`), so every screen that draws him (solo, online, crowd, the tower) agrees. The move dots keep
  z-index 2 (taps, and other bosses' under-layers: the review of #784).
- **Wrangler's ultimate off in the tower:** `BATTLE_TOWER.noUltimate: ["pig"]`. The runner marks the boss's powers `noUlt` as a tower
  floor starts (one boss or several, so solo and the party's room agree); the showdown never comes (his line-up, his scout, his "ready"
  line, the admins' trigger), and his meter shows empty and dimmed all floor (the existing "paused" look; aria "Rage: no ultimate in the
  Battle Tower"). The gates are generic (prepareTurn's ultimate step, ultimateNow, the test trigger, the meter), plus his own showdown
  checks; a boss added to the list whose ultimate is set up elsewhere needs its own gate (the unit test runs every boss listed).
- **Babur's balloon:** the power ran on shared floors (the board's landings and pops), but the split bar never drew any boss's bar prop,
  so his pump and the balloon growing on it were nowhere. Now `BossUi.towerProp` (Babur only) draws it: a phone's in his part of the
  split bar at 1.25x, a computer's beside his figure by the board at 2x; never dimmed with his part (his balloon grows while others are
  to move). The other bosses' bar props (Hollow's bulbs, Timber's workshop, Dash's tally, Jefferson's candle row, Don Dough's timers)
  are still not drawn on a shared floor: left for the director (they need room the parts don't have).
