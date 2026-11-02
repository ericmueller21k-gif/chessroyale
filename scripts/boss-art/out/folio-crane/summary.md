# Boss art (rider): folio-crane

- Model claude-opus-5-5, effort high, adaptive thinking. 9 turns, 5 renders.
- Spend: **$0.75** of the $6 cap (20 input, 43,832 cache-write, 198,412 cache-read, 24,489 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio-crane/folio-crane.tsx.
- Previews: scripts/boss-art/out/folio-crane/preview/idle.png, scripts/boss-art/out/folio-crane/preview/move.png, scripts/boss-art/out/folio-crane/preview/look.png. Each look it took: scripts/boss-art/out/folio-crane/looks/.

## Its notes

Paper Crane (folio-crane) is finished: a mythic ride. It's a big origami crane seen from the side, facing right. It has a long creased neck, a small folded head with a dot eye, a pointed tail and two raised wings in a V. The near wing is up and back on the left. The far wing rises behind the pawn on the right, so the pawn sits between them. The crane hovers about 5 units off the ground over a soft shadow that stays on the ground and shrinks as the crane rises. The pawn's lowest part (cut 72, pawnY −10) is hidden behind the crane's back ridge and the near wing's root.

**Painted part:** all the paper is the item's color: wings, body, neck, tail and head.
- The left and upper faces (lit from the top left) use the plain color, so the sheen colors keep their gradient.
- Shaded faces are 15% darker, and the far wing is darker again (30%).
- Creases are thin lines in a much darker shade, with a thin light highlight along the near wing's front edge and the back ridge.
- The faint handwriting squiggles on the wings and body are blue-grey on light colors and a lighter shade of the paper on dark ones.
- **Fixed:** the small red seal on the near wing's root (red square with a tiny cream stamp mark, no letters) and the black eye.

**Idle** (8 frames × 220 ms, 1.76 s loop): a slow bob of about 2 units. The wings lift a little and settle, and on frames 4–6 the head dips once (up to 22°) and comes back.

**Move** (8 frames × 75 ms, 600 ms): dx goes 0, 11, 23, 36, 50, 64, 77, 89, so the next move's frame 0 (dx 100) follows on.
- Frames 1–3: the wings sweep down while the crane rises up to 6 units; at the bottom of the stroke the near wing hangs below the body.
- Frames 4–6: the wings sweep back up and the crane glides back down.
- Frame 7: it settles into the hover pose.
- The pawn tips back a few degrees on the downstroke and forward on the glide. The head lifts slightly through the beat.

**Choices you might want to change:**
- I swept the near wing back (to the left) so it doesn't cover the pawn. That means the wings make a backward V rather than standing up on both sides.
- During the downstroke the far wing is mostly hidden behind the body, so the near wing carries most of the beat.
- The tail is short and mostly behind the near wing at rest; it shows more during the beat.
- The seal is small. At town size it's just a red dot.
- Midnight reads dark but its faces still show. On Pearl, the 75%-purity blotches show as lilac patches on the paper.
