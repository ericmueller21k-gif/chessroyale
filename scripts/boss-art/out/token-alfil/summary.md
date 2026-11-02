# Boss art: token-alfil

- Model claude-opus-5-5, effort high, adaptive thinking. 12 turns, 8 renders.
- Spend: **$0.56** of the $1 cap (26 input, 32,948 cache-write, 226,265 cache-read, 17,301 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-alfil/token-alfil.ts.
- Previews: scripts/boss-art/out/token-alfil/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-alfil/looks/.

## Its notes

token-alfil is finished: a 40 x 40 frame on a transparent background, meant to be shown at 2x. It's exported as TOKEN_ALFIL, named "Alfil token". I rendered it at 4x on both dark and light backgrounds and looked at the phone-size view. The mammoth, his tusks and the Nettipattam read at a glance. The eyes are small at 1x, but the brows still show the anger.

**The coin:** copied unchanged from token-blitz: the same rim with its 8 rivets, dark inner ring, navy middle (lighter navy from row 27 down), k outline, faint gold halo and glint code. Only the face parts are new.

**The face (back to front):**
- **Shoulders:** a narrow mass of dark fur at the bottom, cut off by the inner ring.
- **Ears:** two darker floppy ears at the sides of the head.
- **Head:** a lighter, high domed head, shaded from the top left, with a few darker shaggy streaks and locks hanging under the cheeks. Thick black brows slant down toward the middle, over white eyes with the pupils toward the centre.
- **Nettipattam:** red, with a blue diamond around a gold centre and two small blue dots, gold trim, coming to a point toward the trunk.
- **Trunk:** down the middle, with wrinkle bands, its tip curling up to our right.
- **Tusks:** two big ivory tusks start beside the trunk, sweep down and out, then curl up at the sides. The tips cross a little onto the dark inner ring, which the brief allowed. The right tusk is shaded one step darker, since the light comes from the top left.
- **Colours:** his fur, ivory, eye and Nettipattam colours come from alfil.ts. His dark blue is renamed `L` so it doesn't clash with the coin's navy `N`.

**Idle, beat by beat (as Blitz's):** the glint steps a quarter turn round the rim every 180 ms for 4 frames, starting at the top left. Then a 1400 ms rest, then a 150 ms blink: the eyes close to a dark line under fur lids. Nothing else moves.

**Choices you might want to change:**
- **Navy inside the tusk curves:** small patches of navy show through there. I kept them so the tusks stand out, but filling them with fur would make the token rounder and heavier.
- **Tusk tips:** they barely touch the inner ring. Pushing them further onto the rim would make them more dramatic.
- **Nettipattam:** kept to one diamond so it reads small. The real one has more pattern and gold tassels, which I left out.
- **Head brightness:** a single number (the head fur bias, 0.45) sets how light the head is against the darker ears.
