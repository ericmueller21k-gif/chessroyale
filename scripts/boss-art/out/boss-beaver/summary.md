# Boss art: boss-beaver

- Model claude-opus-5-5, effort high, adaptive thinking. 44 turns, 36 renders.
- Spend: **$4.76** of the $9 cap (90 input, 284,486 cache-write, 6,614,126 cache-read, 100,566 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/boss-beaver/boss-beaver.ts.
- Previews: scripts/boss-art/out/boss-beaver/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/boss-beaver/looks/.

## Its notes

Timber's full animation set is drawn in scripts/boss-art/out/boss-beaver/boss-beaver.ts (export BOSS_BEAVER, id "boss-beaver", name now "Timber"). I looked at every animation at 4x and beside the tiger at phone size.

**The idle is unchanged.** I added the rigging around the approved drawing, and at rest the rig gives the same parts, in the same order, at the same places. That means the same pose, face, palette, hat, vest, planks, belt, tools, tail and timing. I checked this by reading through the code and by looking at the idle render; I couldn't compare the frames pixel by pixel.

**Rig (numbers in `Pose`):**
- **Whole body:** breathing; a crouch or sit (`sink`), with the feet set apart (`spread`); a sideways lean; moving all of him and lifting him into the air (`dx`, `air`).
- **Head:** it moves as one. On it: eyes (smile, blink, proud, squint, shut, wide, wink), brows (cheer, angry, worry, up), mouth (smile, grin, frown, open with `jaw` 1–5, which drops a chin and shows his lower teeth) and a tongue for licking his lips.
- **Hat:** shifted or tilted on his head, or off it altogether.
- **Arms:** each paw is placed by a point and the elbow bends by itself. Switches bring the near arm, or the far arm, in front of his face.
- **What he holds:** the hammer comes off his belt into either paw at any angle. The back plank slides out of its strap; he can hold a plank, a scrap of wood, and his tools can spill.

**Animations, beat by beat:**
- **entrance:** his shadow grows; he drops in with his hat lifting off and lands with a stomp and dust (cue `stomp`). He straightens his hat with the far paw (`pat`), pulls the hammer, twirls it (`whoosh`), taps it with a puff of sawdust (`tap`) and puts it back.
- **thinking** (loop): paw on his chin, eyes narrowed, a blink. He shuts one eye to sight along the board, and his tail taps (`tap`).
- **move:** hammer off the belt, a point and a tap at the board (`tap`), then back on the belt.
- **capture:** he winds the hammer up beside his hat, swings it down (`whack`), chips and sawdust fly, he holds it up proudly, then puts it away.
- **hurt:** a flash and a shake (`oof`), his hat knocked askew, then a gruff glare. He straightens the hat with his paw (`pat`).
- **check:** he raises the hammer and points it at the board, leaning in with his brows down (`point`), jabs once (`tap`) and grins.
- **smug** (loop): hammer resting on his far shoulder, chin up, a toothy grin, a wink, a slow tail pat.
- **rattled** (loop): shaking, eyes wide, brows worried, sweat flying, tail twitching, his hat slipping down over his brow.
- **defeat:** a flash (`oof`), his hat flies off, his tools pop off the belt, he sits down hard (`thump`). The hat lands tipped over on his tail, the tape and wrench lie on the ground (`clatter`), and he sits dazed with stars round his head. The last frame holds for 900 ms.
- **victory** (loop): hammer high, the other fist up, hopping, his tail slapping (`slap`), wood chips falling like confetti.
- **scrap:** a scrap drops in from the upper left and he catches it. He sets it at our upper left, takes the hammer and taps it into place twice, with a puff of sawdust each time (cue `tap` ×2), then puts the hammer back. Afterwards the scrap is gone: the game's workshop strip takes over.
- **build:** he reaches back and slides the plank up out of its strap (`pull`). He swings it over his head and holds it up at his side to show it off (`show`). Then he swings it down to the board (`drop`, on the frame it lands) and slides it back into the strap (`pat`), so he ends with two planks as in the idle.
- **gnawWarn** (loop): he leans in with his teeth bared and eyes narrowed and gleeful. He licks his lips three times and clacks his teeth twice (`clack`).
- **gnaw:** he leans in, jaw wide, then four bites with splinters and chips flying from his mouth (`chomp` ×4). He leans back with a satisfied chew, then a little burp of sawdust (`burp`).
- **cheer:** a proud nod with his mouth open (`cheer`) and a tail pat.
- **bigCheer:** he crouches, then hops with the hammer high and the other fist up (`cheer`), with chips flying. He lands with a slap of the tail (`slap`), does a second slap, and puts the hammer away.

**Choices you might want to change:**
- **No `BOSS_BEAVER_ATTACK`:** it would need the shared `KING_ATTACK` timings and `attack-frame.ts`, which this file can't import.
- **Little headroom:** the frame is still 88×88, so the idle stays exactly as it was. Hops are only 2–3 px, and raised hammers sit beside his hat rather than above it.
- **Hammer reach:** points at the board stay inside the frame, so the hammer head comes near the left edge. The render warns that pixels touch the frame's edge in several animations; mostly it's chips and dust flying off.
- **The hat in defeat:** it lands tipped over on his tail, partly behind him. Upside down in front of him, it covered his legs.
- **Possible bug in the approved file:** the far paw's rest point is at x 46.5, a half pixel. The preview draws it, but the game may drop or shift a part placed at a fractional position. I left it alone so the idle stays exactly as approved. If it needs fixing, rounding `HAND_R` changes one paw by a pixel.
