# Boss art (rider): riding-chirp

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.80** of the $6 cap (18 input, 45,878 cache-write, 188,448 cache-read, 26,494 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/riding-chirp/riding-chirp.tsx.
- Previews: scripts/boss-art/out/riding-chirp/preview/idle.png, scripts/boss-art/out/riding-chirp/preview/move.png, look: failed (Error: Command failed: mv /home/user/chessroyale/scripts/boss-art/out/riding-chirp/preview/look.png /home/user/chessroyale/scripts/boss-art/out/riding-chirp/preview/look.png
mv: '/home/user/chessroyal). Each look it took: scripts/boss-art/out/riding-chirp/looks/.

## Its notes

Riding Chirp is finished (mythic, id "riding-chirp"). It's Chirp the grasshopper seen from the side, facing right. He has a big round head, a large shiny black eye that blinks, a little smile, a pink blush, yellow mouthparts, two long antennae, a folded wing, a striped jumping thigh, thin yellow-green legs (the far-side legs are darker), and a small gold bell on a collar. The pawn sits in the saddle with its bottom hidden behind the seat (cut 69, lifted 16), and the rest rides upright on top. I checked it in renders: the idle and move frames at 4x with white and black pawns, every color at town size, the tile, and the 100% and shiny versions. No warnings came up.

**What takes the item's color:** the saddle (seat and horn), the saddle flap and the collar. The blanket under the saddle is a darker shade of the same color, or a lighter one for very dark colors like Midnight, so it stands apart from the saddle. Its trim stripe and the stitching are a pale tint. Chirp's greens, his eyes and the gold bell stay fixed.

**Idle** (10 frames, about 1.9 s): a slow breathing bob where the body sinks about 1 unit and rises while the feet stay planted, with the pawn moving along. The near antenna twitches forward, then the far one twitches. A short blink. Then he lifts his near front leg and sets it back down.

**Move** (8 frames, 650 ms, one hop from dx 0 to 100):
1. Crouch and a deeper crouch, with the pawn sinking a bit into the saddle and the antennae folding back.
2. Launch at dx 14: nose up 12°, hind legs kicked out straight behind him, and the pawn lagging low and tilted back.
3. Rising at dx 36, then the top of the arc at dx 56, 27 units up, where the pawn floats a little.
4. Coming down at dx 76 and 94, nose dipping and front legs reaching forward, with the antennae swinging forward.
5. Landing at dx 100 in a squat with a small forward lurch, which runs straight into the next hop's crouch.

**Choices you might want to change:**
- **Painted part:** I put the color on the saddle rather than on Chirp's body, so he always stays green like the boss. With Emerald and Sage the saddle sits green-on-green, so those read less strongly, though the outlines keep the parts separate.
- **Hop height:** the top of the arc is 27 units, about a quarter of a square. Make it lower if the town looks too bouncy.
- **Seat depth:** the pawn's lowest part is hidden (cut 69). Lowering the cut toward 66 shows a little more of the pawn.
- **Cute extras:** the blush, smile and bell are my additions. The references have reins down to a chest bell, and the pawn has no hands to hold reins, so I kept only the bell.
- **Reach past the square:** the head and antenna tip go about 5 units past the right edge, and the tile frame is [-6, 0, 112, 100].
