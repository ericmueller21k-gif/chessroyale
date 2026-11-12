# Each boss's mate its own; Vibration greyed on iPhone (Nov 11, 2026)

- **Eric:** "when Babur mated me it showed the dark matter Hollow uses on the tile." The cause was shared code: `KingAttack.tsx` drew
  Hollow's dark (`darkItem`) on the king's square and his violet flash on the king at every boss's mate. Both are now Hollow's kit's
  (`mateMark`, `glow`); every other boss's mate leaves the square empty once the king has gone, its flash white. Not a leak between
  battles (nothing is kept from one to the next).
- **Call made:** the same check of every boss found Dash's swipes showing Jefferson's fireball pops (`popItem`). Dash got his own
  claw marks (`clawHit`, effects/dash.ts: three streaks in his teal), the least code that gives him his own.
- **Eric:** iOS 27's Safari gives web pages no tick, so Settings → Sound "Vibration" is greyed on an iPhone or iPad with "Not
  available on iPhone." The switch-trick path stays, so `?haptics=debug` still shows what a later iOS does. Android and the rest
  are unchanged.
