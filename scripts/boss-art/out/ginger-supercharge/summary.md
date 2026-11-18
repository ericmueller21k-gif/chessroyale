# Boss art: ginger-supercharge

- Model claude-opus-5-5, effort high, adaptive thinking. 23 turns, 13 renders.
- Spend: **$1.20** of the $6 cap (48 input, 81,110 cache-write, 1,244,176 cache-read, 27,312 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/ginger-supercharge/ginger-supercharge.ts.
- Previews: scripts/boss-art/out/ginger-supercharge/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/ginger-supercharge/looks/.

## Its notes

I've drawn Ginger's Super Freeze: `superCharge` (loop), `superBlast` (one shot) and `idle`. Everything is built on his own rig through `gingerLayers`, as in ginger-intro.ts. His parts, palette, frame (84 x 93) and foot [43, 88] are unchanged, he faces front, and the orb, frost and bolt are specks drawn on top. I rendered both animations on dark and light backgrounds and checked the charge at phone size beside bigboy: the glowing orb on the cane and the wide stance read at a glance there. No pixels touch the frame's edge.

**superCharge** (loops, 8 frames × 110 ms = 0.88 s, no cue)
- **Pose:** feet wide, crouch 2-3-3-2 (rising and sinking), cane raised in front of him and glowing, free fist clenched out beside it, icy eyes. His face is mostly shouting, with angry frames 3, 6 and 7, and his head lifts a pixel on frames 3 and 7.
- **Glow:** the cane alternates between `GLOW_PULSE` (even frames) and `GLOW_BRIGHT` (odd frames). On the bright frames his icing goes frost-white too.
- **Orb:** a ball of ice light sits in the hook's curl: white core toward the top left, pale blue, a dark blue rim and a dithered halo. Its radius pulses 5.6 → 6.8 → 6.2 → 7.4 → 6.2, and four rays glint, switching between straight and diagonal each frame.
- **Frost and sparkles:** two rings of frost streaks spiral in to the orb (each streak has a bright head and a curling tail), plus two sparkles winking each frame.
- **Shiver:** a 1 px shake on frames 2, 5 and 6.
- **Loop seam:** the rings' radius wraps with the frame count, so frame 7 joins frame 0 cleanly.

**Join from the intro's `charge`:** I checked its last frame beside my frame 0. The grip drops 1 px (crouch 1 → 2) and each foot steps 2 px wider. There's no jump in the cane.

**superBlast** (one shot, 8 frames, 690 ms)
- **f0 (90 ms):** last flare. Still in the charge pose, crouch 3, head up, shouting; the orb is at its biggest (radius 8) as the last frost is sucked in.
- **f1 (70 ms):** swing. The cane is swung down and across him (pose "aim"), a swoosh of ice light follows the swing's arc, and a small orb sits at the cane's end.
- **f2 (90 ms):** cue `blast`, shake [-1, 0]. The cane points right and a little down (pose "thrust"). A flash at its end, and a bright slanted shard of frost leaves to our right with a short trail.
- **f3 (80 ms):** recoil (dx -1, crouch 3). Only the bolt's wake of frost puffs is drawn, with no second shard, since the game's `iceBolt` is flying by then.
- **f4 (80 ms):** laughing, still recoiled, the wake fading, the glow softening.
- **f5 (90 ms):** fierce laugh, the glow at half.
- **f6 (90 ms):** cane back down (pose "lift"), fist up, laughing.
- **f7 (100 ms):** `GINGERBREAD.anims.idle.frames[0]`.

**idle:** his idle's first frame.

**`SUPER_BLAST_FROM`** = the shard's tip in f2 = `caneTip(CAST) + [19, 5]`, which works out to about [80, 80] in frame pixels. It's computed in code from the rig.

**Choices you might want to change**
- **The bolt leaves the cane's straight end, not the hook.** None of his cane poses aims the hook at the board, and I could only use his existing poses. In "thrust" he holds the cane by the hook end and points the straight end, as in his freeze cast. So the swing frame shows the orb's light moving to that end before the bolt fires.
- **His free hand doesn't grip the cane.** None of his free-arm poses reaches it, so it's clenched out beside it ("out", the same as the intro charge's last frame).
- **The cane is held up in front of him ("raise"), not overhead.** That keeps the grip continuous from the intro's `charge`. An overhead version (orb high above his head) would read even bigger, but the cane would jump at the join.
- **After the cue frame I draw only the bolt's wake, not the bolt.** This avoids two bolts once the game's bolt takes over. If the game's bolt starts late, frame 3 could draw the shard one more time.
