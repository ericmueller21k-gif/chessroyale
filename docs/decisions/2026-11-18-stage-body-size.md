# The Boss Battle stage sizes a boss by its body and what it draws (Nov 18, 2026)

**Eric (a computer screenshot of the stage, Chandy picked):** "why is this mofo so SMALL"
**Cause:** the stage capped each boss by its whole frame's width (`100 / ch.w`): Chandy's frame keeps empty room for his rifle held level (174 px wide, twice the others), which halved him (0.575 cqi a pixel). His slung rifle also counted toward his height.
**Fix (`components/BossStage.tsx` `placeOnStage`):** the width cap counts the columns the idle actually draws, and the drawn part stays on the stage (the frame's empty room may hang off); the aim height is the body's (props excluded: kits.ts `barProps`, as the phone bar since #793); the room cap still counts the props, so the rifle's tip stays under the bubble, never cut off.
**Result:** Chandy's body 42.5 → 60.6 cqi (the rifle's tip at the room's top; the others' bodies 67.1). Only a kit with props (`barProps`: Chandy) measures what it draws; every other boss keeps its exact size and place (a first try that measured every boss moved Ginger and let Wrangler's frame overhang the stage, caught by `e2e/boss-select.spec.ts`).
