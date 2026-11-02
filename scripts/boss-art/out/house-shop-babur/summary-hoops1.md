# Boss art: house-shop-babur

- Model claude-opus-5-5, effort high, adaptive thinking. 22 turns, 6 renders.
- Spend: **$1.28** of the $4 cap (48 input, 118,658 cache-write, 1,481,839 cache-read, 19,603 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-shop-babur/house-shop-babur.ts.
- Previews: the final preview failed: . Each look it took: scripts/boss-art/out/house-shop-babur/looks/.

## Its notes

Second pass on Babur's shop: I added `fire-hoops`, three burning hoops on stands. No other piece was changed. I looked at all 8 frames of `fire-hoops` at 4x on dark and light backgrounds, and at the room still at scale 1. I didn't re-render the pieces from the first pass, since none of them changed.

**Size:** 3 x 1 squares at columns 15–17, row 4 (solid). The picture is 121 x 84 px: the 111 px of its three squares plus 5 px each side so the side flames aren't cut off. That's a little over the brief's ~111 x 80. The foot is at (60, 81), the middle of the three squares, and each hoop sits over the middle of its square.

**Each hoop:** a steel ring 29 px across with 3 px of steel. It uses the tiger's colors value for value: steel `% & =` and fire `p u v Q R`. The fire is on new keys `i l m n R` because the room's palette already uses `p u v Q`. As on the tiger's hoop, the steel is lit from the top left with dark wrap bands. Each hoop stands on a steel post with a small round foot and a ground shadow, and a gold collar grips the bottom of the ring. About two dozen tongues of flame come off the outside of the ring: longest over the top (about 11 px), leaning out and up on the sides, short along the bottom, with none at the collar. They run white-hot at the ring to dark red at the tips. Flames never cover the steel or fill the hole, and everything is outlined in `k`.

**The flame loop, 8 frames at 110 ms (880 ms):**
- Every frame, each tongue grows and shrinks on one or two full cycles per loop, so the loop wraps without a jump. A ripple runs up each tongue twice per loop, which is the licking.
- The middle hoop runs 3 frames ahead and the right hoop 5 frames ahead, so the three never pulse together.
- Sparks: one rises off the left hoop in frames 1–3, the right hoop in frames 4–6 and the middle hoop in frames 6, 7 and 0. Each is 2 pixels and climbs 4 px a frame, cooling from white to orange.
- Only the flames and sparks move; the steel, collars, posts and feet are identical in every frame.

**Light:**
- `SHOP_BABUR_HOOP_LIGHTS`: one `LightSpot` per hoop around its ring and flames. Only the fire's pixels light (keys `ilmnR`), in `TORCH` color, at strength 1 with flicker and a 30 px halo.
- `SHOP_BABUR_HOOP_POOLS`: one warm `LightPool` per hoop on the sawdust at its foot (rx 22, ry 7, strength 0.3).

**Hooked in:** it's in `SHOP_BABUR_PIECES` (as `shop-babur-fire-hoops`), in `SHOP_BABUR_LAYOUT`, in the room still (which shows frame 0), and in `HOUSE_SHOP_BABUR` as its own `fire-hoops` animation with all 8 frames.

**The cold hoop:** moved to the west side, column 3, row 7 (solid). There it balances the burning hoops across the room and is out of the way of the door, the counter and the ring. The path from the door (columns 9–10) up to the counter is still clear in the room still.

**Things you might want to change:**
- Between neighboring hoops the side flames nearly touch. They still read as three hoops at town scale; rings of about 26 px would leave clear gaps.
- The sparks are small and hard to see on pale sawdust.
- The room still gives a warning that a pixel touches the frame's edge. That's the room's full-width floor reaching the border, not the hoops.
