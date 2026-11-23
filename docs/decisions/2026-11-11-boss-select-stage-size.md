# Boss Battle select: the picked boss stands bigger on the stage (Nov 11, 2026)

**Eric (Nov 11, on his iPhone 14 Plus screenshot):** "These bosses are too short. I think it's to match their in-game size, but on this screen they need to be a bit bigger."

**What changed**
- The picked boss stands on the stage at `STAGE_SCALE` (1.5, `characters/boss-select.ts`) times its old pixel size, but never taller than the room above its feet, less a clearance under the speech bubble's tail. Every boss but Wrangler (width-capped by his lasso) hits that room cap, so tall ones (the giraffe, the elephant, Don Dough) are held to the stage's height and never cut off. In-game sizes are unchanged.
- The figure's box keeps its own proportions (`.bs-spot .bs-sprite` in styles.css). Before, the canvas was stretched to the stage's height, so a figure was squashed as it grew wider.
- Don Dough's tile (`zebra`) gets a framing and a tint, so his portrait shows instead of the 🦓 icon. The new test checks every boss in the roster with a sprite has both; the Hidden Boss keeps no tint, by design.

**Calls made**
- The room cap binds for everyone, so the real growth is about 1.1x to 1.45x in figure height, not 1.5x. A 1.5x figure needs more room: lowering the stage pads or raising the speech bubble. That changes the stage's layout, so it's Eric's call.
- The bubble clearance is 12 cqi. A head sits under the bubble's tail otherwise.
- Don Dough's tint is `#d9667a` (his palette's pink): it stands clear of his white fur, stripes and maroon vest.
