# Boss art (rider views): sawyer-dozer

- Model claude-opus-5-5, effort high, adaptive thinking. 6 turns, 4 renders.
- Spend: **$0.94** of the $3 cap (14 input, 56,254 cache-write, 187,953 cache-read, 31,104 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sawyer-dozer/sawyer-dozer.tsx.
- The side view: unchanged, and the front and back views are drawn.
- Previews: scripts/boss-art/out/sawyer-dozer/preview/idle.png, scripts/boss-art/out/sawyer-dozer/preview/move.png, scripts/boss-art/out/sawyer-dozer/preview/look.png, scripts/boss-art/out/sawyer-dozer/preview/front-idle.png, scripts/boss-art/out/sawyer-dozer/preview/front-move.png, scripts/boss-art/out/sawyer-dozer/preview/back-idle.png, scripts/boss-art/out/sawyer-dozer/preview/back-move.png, scripts/boss-art/out/sawyer-dozer/preview/views.png. Each look it took: scripts/boss-art/out/sawyer-dozer/looks/.

## Its notes

I added the front and back views to Sawyer's Dozer. The side view is unchanged: all the new code comes after it, and the only other changes are a `views` field and one extra type in the import line. Both new views use the side's frame counts and timings (idle 6 × 150 ms, move 8 × 100 ms). The pawn is centred (pawnX 0) at the same height as on the side (pawnY −14, cut 68), dx stays 0, and dy uses the side's own rumble and bob numbers. I rendered both views at 4x and at town size in several colours, with white and black pawns, and they read well. done's pixel comparison of the side view runs when this call goes through.

**Front (driving toward us)**
- **Blade:** the painted "blade" is curved and runs across the front. It has a darker lip along the top, a highlight, and a bolted steel cutting edge. Two steel lift arms with pins run from the hood down to it.
- **Hood:** above the blade sits the painted "hood", with a raccoon "bandit mask" band holding two glowing headlights, and two vent slats.
- **Body and seat:** the painted "body" shows at both sides. The dark seat back peeks out around the pawn.
- **Sides:** a track on each side shows its tread face. The stack is on our left and the antenna on our right, behind the pawn, with its ringed raccoon-tail flag swinging outward.
- **Pawn:** its head and upper body are fully visible above the hood. The blade sits well below it.

**Back (driving away)**
- **Back of the body:** the painted "body" shows its top deck from above, then the back panel. On the panel are two red tail-lights, the black-and-yellow hazard stripe and a tow hitch.
- **Seat and pawn:** the dark seat back is in front of the pawn's lower half, so the pawn reads as seated.
- **Sides:** the two tracks are left and right, with dark undercarriage between them. The antenna and flag are on our left, near us. The stack is on our right, beyond the pawn. The painted hood is drawn behind the pawn too, but it's almost entirely hidden.

**Idle (both views):** the same rumble-jiggle as the side. One puff pops from the stack, rises and drifts outward, with a smaller one behind it. The tail flag waves the whole time.

**Move (both views), beat by beat:**
- The tread bars roll the whole time: downward on the front view, upward on the back. They come back to the start after 8 frames, so the loop is clean.
- The side's small bob and rumble play throughout.
- The pawn rocks side to side up to about 1.6°, a little less than the side's 2°.
- Puffs stream up and outward on the side's timing: a little smaller on the front (going away from us), a little bigger on the back.
- Dirt crumbs arc out from both tracks, one on each side, staggered.
- On the front, the blade dips about 1.3 on frames 1–3 and lifts about 2.3 on frames 5–7, matching the side's dip and lift.
- Frame 7 leads into frame 0.

**Choices you might want to change**
- **Width:** both views are about 90 wide (tracks at x 5–95). That's wider than tall, because a dozer is squat. Both views' frames are [−8, −8, 116, 108].
- **Blade:** it's narrower than the outside of the tracks (x 17–83), so the tracks show at the sides. A real dozer blade is usually wider than its tracks.
- **Stack and antenna sides:** the stack is on the driver's right and the antenna on the driver's left, so they swap sides on screen between the front and back views.
- **Flag:** in the end-on views the tail flag swings out sideways rather than streaming toward or away from us.
- **Tail-lights:** the back has two tail-lights where the side shows one.
