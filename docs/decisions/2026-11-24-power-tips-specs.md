# Power tips run every tipped boss's spec (Nov 24, 2026)

- Main went red after #917: `e2e/sawyer.spec.ts` checks the split's line, and a first battle now shows Sawyer's power tip in its place.
  #917's PR run didn't include `sawyer.spec.ts`: `power-tips.ts` was mapped only to the God King's area.
- The cause, fixed: `power-tips.ts` has its own area in `e2e/areas.json` running every tipped boss's spec (Birdie, Hollow, Sawyer,
  Chandy, Boingo's `boss-powers`/`boss-character`) and `boss-speech`. A new tip adds its boss's spec there.
- The check: `sawyer.spec.ts` accepts the tip line ("Measure once, cut twice!") as the split's line too.
