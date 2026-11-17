# Boss art: arena-moo-closeup

- Model claude-opus-5-5, effort high, adaptive thinking. 11 turns, 6 renders.
- Spend: **$1.32** of the $3.5 cap (24 input, 70,467 cache-write, 449,525 cache-read, 43,932 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-moo-closeup/arena-moo-closeup.ts.
- Previews: scripts/boss-art/out/arena-moo-closeup/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-moo-closeup/looks/.

## Its notes

I drew Scene B, the close-up. It's 200 x 260, opaque edge to edge, and exported as ARENA_MOO_CLOSEUP (id "arena-moo-closeup", name "Moo and Moon close-up", foot [100, 255]). I rendered both animations at full size and the first and last frames side by side. I couldn't inspect the faces at 4x: the render tool shrinks the whole picture to fit, so I checked the faces only at about 1-2x.

**The picture:** Moo is in side profile, facing our left, snout lifted toward the upper left. His head fills most of the frame:
- **Face:** a big pink snout with a nostril and a shine, the mouth line, and a big brown eye with an iris, pupil, two glints, a white corner showing which way he looks, a heavy upper lid, swept-back lashes and a brow ridge.
- **Head:** a dark-brown patch round the eye, a spiky cream tuft, a tan horn with a darker far horn behind it, fur tufts under the jaw, and a big floppy ear swept back with its pink inside showing.
- **The Moon:** a crescent tucked under his jaw with its hollow turned up toward the light, held to his chest by his near foreleg (a brown sock, a dark split hoof). Its face is a small open eye looking up, a pink cheek and a small smile.
- **Colours:** both use Moo's own palette colours, with cool violet-lilac night shade on the cream and a pale rim light (1-2 px) on every edge facing up and left.
- **Background:** navy-indigo sky in bands, getting lighter toward the upper left; six diagonal shafts of light; about 120 stars; a pale glare in the top-left corner where the moon is, just off frame; dark grass tips along the bottom. Where a shaft crosses Moo or the Moon, they're one shade brighter.
- All faces and eyes are inside x 4-196, y 22-238.

**idle** (4 frames x 300 ms, loops; eyes normal):
- **Frame 0:** base look. Twelve sparkles sit along the shafts, each at its own point in a 4-step cycle: it appears small, grows into a star, fades, and drifts about 6 px down its shaft each frame.
- **Frame 1:** the shafts brighten and the rim light flashes pure white.
- **Frame 2:** the ear twitches (its tip lifts about 4 px) and the stars twinkle brighter.
- **Frame 3:** the shafts dim below normal, then the loop starts again.

**whiten** (5 frames: 220, 220, 220, 220, 400 ms; plays once and holds the last frame). Frame 0 is exactly idle frame 0. From frame 1 on, a second set of sparkles joins and the shafts get brighter every frame.
- **Frame 1:** white starts filling Moo's iris from the upper left (the light's side), with a pale-gold leading edge. The Moon's eye starts filling the same way.
- **Frame 2:** Moo's iris is mostly white and the rim light turns pure white.
- **Frame 3:** both eyes are all white, with a pale-gold ring where Moo's iris was. A small glow starts: gold round Moo's eye, white round the Moon's, which now has a dark outline so it reads.
- **Frame 4 (held):** both eyes pure white with a big glow halo and eight short rays, the shafts at their brightest, and the sky lifted slightly. Even at phone size Moo's eye reads as a glowing white disc.

**Choices you might want to change:**
- The Moon's eye is small (about 8 x 10 px). Its first whitening steps are hard to see on a phone; it mostly reads once it's fully white (frames 3-4). It can be made bigger.
- Moo's eye is already mostly white by frame 2, so frames 3-4 are about the glow. The fill speed is one number per frame (`fill` in `mooEye`).
- The glow round Moo's eye is gold and the Moon's is white (gold barely shows on the yellow Moon).
- The shafts are only in the sky behind them. On the characters, the light is the rim light plus the one-shade lift, which shows as diagonal steps in the shading on his neck; take that out if it looks too busy.
- Only the near foreleg and hoof show; there's no second hoof.
- The ear twitch is subtle (4 px). The `ear(lift)` setting controls it.
- The bottom grass is mostly below row 240, so on a computer only the tips may show.
