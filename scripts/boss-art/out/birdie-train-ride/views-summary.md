# Boss art (rider views): birdie-train-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.80** of the $3 cap (18 input, 53,487 cache-write, 253,736 cache-read, 24,021 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png, scripts/boss-art/out/birdie-train-ride/preview/front-idle.png, scripts/boss-art/out/birdie-train-ride/preview/front-move.png, scripts/boss-art/out/birdie-train-ride/preview/back-idle.png, scripts/boss-art/out/birdie-train-ride/preview/back-move.png, scripts/boss-art/out/birdie-train-ride/preview/views.png. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

I added the front and back views to Birdie's Train. The side view's code is untouched: the new code sits after it, and the only other changes are an extra type in the import line and the new `views` field. I checked the renders in red, yellow, emerald, cobalt and midnight at 4x and at town size. No warnings came up, and I didn't add a trail mark.

**Back (going up the screen):**
- **What it shows:** the yellow back wall of the cab (painted region "cab") with a white highlight along its top edge. The red stripe carries on across the back, with a small red tail lamp each side that has a soft glow. The two rear posts ("backpost") hold up the dark arched roof with its lighter top line. Below are the dark footplate, a grey coupler, and the grey trucks with their wheels seen edge-on.
- **Inside the cab, behind the pawn:** a dark floor, the inside of the cab's front wall in a darker shade of the body color ("farwall", the same as the side's far wall), the front posts ("frontpost", slightly darker), and faint windshield glass with two glints.
- **The pawn** is seen from behind, centered, with the same height and cut as the side (pawnY -10, cut 66). Its lower part is hidden by the back wall.

**Front (going down the screen):**
- **What it shows:** the rounded yellow nose ("hood") in front of the cab's front face ("cab"), which shows at both sides and as a sill above the nose. A big headlight sits high on the nose with a smaller one below it. The red stripe comes in from both sides and sweeps down into a smile shape under the lower lamp. There's also the short dark stack, the windshield posts ("frontpost") with faint glass and glints, the rear posts behind the pawn ("backpost", darker), the roof, a grey cowcatcher, and the trucks.
- **The pawn** sits behind the windshield with its head and shoulders clear above the sill. The stack covers part of its neck.

**Both views, beat by beat:**
- **Idle (12 frames × 150 ms):** the side's bob and rock, with the rock shown as a 0.6° roll side to side, and the pawn rolls with the body. The lamps' glow brightens and dims slowly: the headlights at the front, the tail lamps at the back. In frames 6–11 a puff rises from the stack and drifts to our right, so at the front it stays clear of the face. At the back it rises behind the pawn and peeks out to the right of its head.
- **Move (10 frames × 65 ms, dx 0):** the same timing and the same two wheel turns as the side. On each wheel, small tread marks roll past and a crank-pin knob on the outside rises and falls. The side's lean becomes a roll of about ±1.3°, with the same small rail bob. The lamps brighten and dim once per square. A puff rises from the stack in frames 0–4, and none is left behind. A faint ground shadow shrinks a little as the body rises.

**Choices you might want to change:**
- **The headlights are stacked**, one above the other, because that's how the side's upper and lower lamps line up. With the stripe they read as a small face. Two lamps side by side is the other option.
- **The puff still comes from the hood stack**, as on the side, not from the roof. At the front it drifts to one side so it doesn't cover the face, and at the back it is mostly hidden behind the pawn.
- **The ground shadow is new.** The brief asked for it, but the side view has none, so it only shows from the front and back. It's faint.
- **Colors:** the tail lamps are fixed red, so on a red ride they only stand out by their outlines. As on the side, the stripe almost disappears on a red ride.
