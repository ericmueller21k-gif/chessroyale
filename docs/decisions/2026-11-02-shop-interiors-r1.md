# Shop interiors, round 1: going into Babur's and Puddles' homes (Nov 2, 2026)

Eric, Nov 2: walk up to Babur's home, a card says "Go in", the camera zooms in on the door and fades into the tent; inside you start in
Close, the Shopkeeper (the boss's kid) sells "Babur's Boss Crate" (3 Babur tokens, or 1 Babur token + 1 crate key); "Go out" by the door
brings you back. Puddles' greenhouse the same way. Round 1 is the town side; buying is one stub (`buyBossCrate`) until round 2 builds
the stored data. How it works: [town-square.md](../areas/town-square.md), "Inside a shop". The art's decisions:
[building-interiors](2026-11-02-building-interiors.md), [shop-zoom](2026-11-02-shop-zoom.md), [bigger-showpieces](2026-11-02-bigger-showpieces.md).

The calls made in this round, each easy to change:

- **"Go in" joins the home's card; "Shop" (greyed) and "Coming soon" stay under it.** Buying isn't built yet, so they're still true, and
  every other home's card (and the town spec that checks Babur's) stays as it was. Round 2 can drop them once the crate can be bought.
- **Going in:** "Go in" walks you to the square in front of the door; there the town's canvas is scaled up about the door (CSS, no change
  to the town's drawing or its frame loop) while it fades to black, and the room's code and art load then (nothing of a shop loads while
  you walk round the town). The town waits while you're inside (no frames, nothing moves) and goes on when you come out, you where you
  stood. Numbers in `SHOP_FEEL` (`doorZoom` 2.4, `doorZoomMs` 600, `fadeMs` 260).
- **Inside, the back button means "out to the town"**, not home: it's the way back one step.
- **No joystick:** the town has none (checked main and every branch), so inside works as outside: tap to walk, drag to look around, the
  focus button to come back. A joystick would be its own job, for the town and the shops together.
- **The Shopkeeper's places** are the mockup's: Stripes beside the counter's east end (Babur's 58 px counter hides him behind it),
  Drizzle behind the middle of Puddles' low counter. **Talking range is 3 squares**, and a tap on the Shopkeeper (or the counter) walks
  you to the square 3 in front of it: the counter between you and the kid in view, as the mockup's "at the counter" still stands.
- **The door is behind you** (the camera looks north): you walk back toward it, or drag the view back and tap it; its "Go out" card
  shows over your head when you stand on one of the two squares just inside it.
- **Near pieces fade:** an upright piece nearer the camera than 3 squares fades out (gone at 2), so the front wall never fills the screen
  as you stand at the door, and a prop between the camera and you doesn't hide you.
- **The floor** is baked once into one picture and laid flat in blocks of 2 x 2 squares (each two triangles, as the mockup drew a
  tile); a block drawn taller than 90 px (near the camera) is drawn a square at a time. Headless: 60 fps walking, phone and computer.
- **Your ride waits outside:** inside you're on foot (your dressed pawn). The rider drawing is the town renderer's; bringing it in is a
  later step if Eric wants it.
- **Indoors has no time of day:** no sky tint inside; Babur's three hoops always glow (their pools and halos from the art's lights).
- **The prices** are in core's settings (`BOSS_CRATE_PRICE`), so round 2's server reads the same numbers. **What you have** shows 0 of
  each (`bossHoldings`: nothing is stored yet), and both buy buttons stay tappable and answer "Coming soon", so the one seam is exercised.
- **The art** is copied from `claude/boss-art` as drawn, only its import lines changed, minus the review-only parts (the whole-room still
  `HOUSE_SHOP_*` and its blown-up review animations, and Puddles' unused first pond), which built large grids as the file loads.
- **Puddles has a ride**, Puddles's Mower: it's his crate's first prize.
- The town's box is never scrolled (`overflow: clip`): a button brought into view inside it once moved the whole world off its box.
