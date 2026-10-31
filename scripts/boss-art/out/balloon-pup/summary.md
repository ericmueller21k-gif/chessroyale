# Boss art (rider): balloon-pup

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 5 renders.
- Spend: **$0.63** of the $6 cap (24 input, 39,042 cache-write, 220,376 cache-read, 19,363 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/balloon-pup/balloon-pup.tsx.
- Previews: scripts/boss-art/out/balloon-pup/preview/idle.png, scripts/boss-art/out/balloon-pup/preview/move.png, scripts/boss-art/out/balloon-pup/preview/look.png. Each look it took: scripts/boss-art/out/balloon-pup/looks/.

## Its notes

Balloon Pup is drawn: a mythic ride, id "balloon-pup". It's a twisted-balloon dog seen from the side, facing right. It has sausage-shaped legs, body, neck and head, two short ear bubbles, a curled tail with a round pom, and small knots at each joint and at the tip of the snout. It also has a dot eye and a little smile. The pawn sits on its back with its lower part hidden behind the body. The last render was in yellow and showed the bow blending in, so I deepened the bow's orange; I didn't render again after that change.

**Painted part:** every balloon segment, knot and the pom takes the item's color. Each segment has a bright curved white highlight. The far legs and the far ear are shaded darker so they read as behind. The bow on the neck keeps fixed colors: orange with black stripes, as a nod to Babur. I checked every color scheme: Pearl and Midnight both read.

**Idle (8 frames, about 1.2 s loop):** a soft squeaky bob, with the whole balloon squashing and stretching a couple of percent from the ground and the pawn riding up and down with the seat. The tail swings about ±13° from its root, and the head nods ±2°. In frames 4–6 a white sparkle glints across the back end of the body.

**Move (9 frames, 690 ms, dx 0 to 100):**
- f0: squashes down to get ready.
- f1: boings up, stretched, and the pawn leans back.
- f2–f5: a low arc that tops out 23 units up at f3. The ground shadow shrinks and fades as it rises and comes back as it falls.
- f6: lands at dx 100 in a big rubbery squash, and the pawn tips forward.
- f7–f8: wobbles back up and settles.

The next move's first frame (another squash) follows straight on, and the tail flips about the whole way.

**Choices you might want to change:**
- The ride's box runs from x -6 to 114, so the dog's head and snout stick out past the right edge of the square.
- The ears point up and back. Floppy ears would look more like a poodle but less like a classic balloon dog.
- I added a dot eye and a smile for charm. Real balloon dogs have no face.
- The bow is small, so at town size it's just a hint of orange.
- The pawn sits fairly high: its waist line is at the top of the body, and about two thirds of the pawn shows.
- The jump is 23 units high.
