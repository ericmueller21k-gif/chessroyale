# Boss art (rider views): ginger-sled

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 5 renders.
- Spend: **$0.81** of the $3 cap (18 input, 54,331 cache-write, 256,016 cache-read, 24,553 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/ginger-sled/ginger-sled.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/ginger-sled/preview/idle.png, scripts/boss-art/out/ginger-sled/preview/move.png, scripts/boss-art/out/ginger-sled/preview/look.png, scripts/boss-art/out/ginger-sled/preview/front-idle.png, scripts/boss-art/out/ginger-sled/preview/front-move.png, scripts/boss-art/out/ginger-sled/preview/back-idle.png, scripts/boss-art/out/ginger-sled/preview/back-move.png, scripts/boss-art/out/ginger-sled/preview/views.png. Each look it took: scripts/boss-art/out/ginger-sled/looks/.

## Its notes

I added a front view and a back view to the Candy Cane Sled. The side view's code is unchanged except that `RiderViewDraft` is added to the import line, which doesn't affect the picture. All the new code comes after the side's functions, and `views: { front, back }` is added to the draft. I checked both views in renders at 4x and at town size, in every color, with a white and a black pawn.

**Front view (walking down):**
- **What it shows:**
  - The gingerbread nose faces us: wavy icing along its top and bottom edges, three icing dots, and the red, green and red gumdrops on its top rail. The green one sits just in front of the pawn's lower body.
  - Under the nose are two short legs. The two candy-cane runners stand at the left and right corners in front of the nose and curl outward into hooks at the top.
  - Behind the pawn, seen from above, the sled's inside runs back to the backrest. It has a darker inside, its rim iced, and the backrest's corners show on either side of the pawn's neck.
- **Pawn:** centered, at the same height and cut as on the side (pawnX 0, pawnY −4, cut 66). It shows from the base of its body up, behind the nose.

**Back view (walking up):**
- **What it shows:**
  - The rear wall and backrest, near us: rounded shoulders, wavy icing along the top, three icing dots and wavy icing along the bottom.
  - Above it, the sled's side rails run away from us to the far nose. A red gumdrop sits on the left rail and a green one on the right.
  - The two runners show as striped posts below the body, with their hooks curling out at the far end on either side.
- **Pawn:** seen from behind, its head and collar above the backrest.

**Painted part:** the gingerbread and the legs. They use the same Region names where it's the same part: "panel" for the nose face (front view) and the rear wall (back view), and "legs" in both. The parts behind the pawn have their own names: "backrest" (front view) and "nose" (back view). They can't reuse "panel", because two regions with the same name in one drawing would clash. Icing, gumdrops, canes and snow keep their fixed colors.

**Idle** (12 × 220 ms, same tables as the side): the sled sinks half a unit and the pawn settles a beat later.
- **Frames 3–4:** a frost sparkle flashes on the icing (the nose's top icing in front, the backrest's top in back).
- **Frames 7–8:** a second sparkle flashes on the backrest corner.
- **Snowflake:** one drifts down the right side and lands small at the end of the loop, on the nose (front) or on the backrest's top corner (back).

**Move** (12 frames, same timing as the side, dx 0 in place):
- **Push (frames 1–2):** the sled dips 0.4 units. The pawn drops a little for the side's lean back: a little in front, more from behind, where its head tips toward us.
- **Glide (frames 2–8):** snow puffs are kicked out to the left and right of the runners, growing and drifting outward for about three frames each. In front they rise and sit behind the sled; in back they spread toward us and sit in front. The pawn rolls a tiny sideways wobble (±0.8°).
- **Stop (frames 9–11):**
  - The sled dips again (0.3, 0.5, 0.2).
  - Seen from the front, the pawn lurches toward us and drops about 2 units; from behind it barely moves.
  - On frames 9–10, a small spray flies off both hooks.
- **Hand-off:** frame 11 settles back to rest, so it loops cleanly into frame 0.

**Choices you might want to change:**
- End-on, the hooks curl outward rather than straight toward us, so they read as candy canes. Because of that, the front view can look a little like a table on cane legs.
- From behind, the backrest's top is at y 50, lower than the side's (y 39). That shows the pawn down to its collar, but the two views don't match exactly.
- A black pawn against the darkened inside of the sled is lower in contrast in the back view, though its outline still reads.
- Both views use the frame box [4, 10, 92, 90].
