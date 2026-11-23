# Boss art: arena-birdie-armored

- Model claude-opus-5-5, effort high, adaptive thinking. 19 turns, 14 renders.
- Spend: **$1.81** of the $8 cap (40 input, 95,647 cache-write, 1,188,859 cache-read, 54,796 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-birdie-armored/arena-birdie-armored.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.23.5
. Each look it took: scripts/boss-art/out/arena-birdie-armored/looks/.

## Its notes

I drew the Armored Birdie reveal as a 200 × 260 full-bleed picture (`ARENA_BIRDIE_ARMORED`, id `arena-birdie-armored`, name "Armored Birdie", foot [100, 236]). It has only the two animations you asked for, `reveal` and `hold`. The render tool warns that an idle is missing; that's expected.

**How I checked it:** the render tool always showed the strip of frames at 1x, whatever scale I asked for, so I couldn't render at scale 2 or 4 as the brief says. To see detail I briefly added a one-frame `idle`, because the bottom of the render shows the first idle frame at 2x. That way I looked at reveal frames 1 and 5 and hold frame 1 at 2x, and I took the `idle` back out before finishing. I saw reveal frame 0 at 2x only at the very end (with no idle, the tool shows it there), and hold frames 0 and 2 only at 1x.

**Composition:** a low horizon (y 186, about knee height) under a banded night sky. He stands upright in an A-stance:
- **Head and cap:** the head is 60 px across with its middle at (100, 68); the cap runs from y 22 to 50.
- **Feet:** the boot soles are at y 234–236, inside the safe area.
- **Width:** wings out to the sides, his outer edges at x 35–165.

His design follows variant A:
- **Head:** the round grey-brown head (b c d e) with its buff face (f g h), the beak (B C), the big dark eye (x) in its pale ring (o) with a 4 × 4 glint (w), and the cheek mark (s).
- **Cap:** navy (1–4) with the gold band and visor (K L) and a small gold diamond on the front (a shape, no writing).
- **Tie and chest:** the burgundy tie (R T U) sits on a yellow locomotive-nose chest plate. The plate has a charcoal collar, the red stripe (q) down the middle, a warm rim light on its top edge and a dark shade on its right side. I added two grille slits on the nose.
- **Shoulder pads:** a charcoal top, the red stripe, then a yellow band with the headlight in it.
- **Wings:** two yellow plates with scalloped lower edges, a pale fringe between them, and dark fingered flight feathers below.
- **Waist and legs:** charcoal waist with the gold buckle, plus a small yellow plate below the buckle (an addition, like a locomotive's front plate). Charcoal thighs, yellow knee plates, yellow boots with a red stripe and charcoal toe caps.
- **Tail:** it hangs behind him and fans down between his legs, with feather lines, a dark band and a pale notched tip.

**Palette keys:**
- **Birdie and the armor:** k a b c d e f g h s o x w B C 1 2 3 4 K L R T U, and t u v y Y (the armor's yellow) m n N (charcoal) q (red stripe).
- **Headlights:** **W** for the near one (screen right) and **V** for the far one, both #fff3b8, each with a w core. **J** (#ffe9a6) is the bloom and the lens streak.
- **Night sky:** 6 A D E F H, banded with ordered-dither seams.
- **Rest of the backdrop:** X is a violet backlight one pixel outside his outline. M and G are the ground of the cutting; P and O are the sparks' warm glow on it.
- **Steam:** **S** (light), **Q** (shade), **Z** (deep shade).
- The total is about 50 keys, more than the brief's "about 30", mainly because I kept his full face, cap and tie colors and added the night and steam colors.

**Reveal** (6 frames × 200 ms = 1.2 s, plays once and holds its last frame):
- **Frame 0:** a wall of steam. Only his boots, the bottom of the tail and the two lamps glowing through (bloom plus a short lens streak) show.
- **Frames 1–2:** the steam parts down the middle like curtains and blows out to the sides and up. First the cap, tie and chest stripe show, then the head and chest.
- **Frame 3:** only thin dithered wisps are left at the sides.
- **Frame 4:** he is shown whole, with the bloom at its wide size.
- **Frame 5:** the held picture. The sparks have settled into short streaks off the shoulders and boots, and a plus-shaped twinkle shows on the eye's glint.

Sparks fly outward through frames 0–4 and get fewer as they go.

**Hold** (3 frames × 300 ms = 0.9 s, loops): the same rig as reveal frame 5, without the twinkle.
- **Frame 0:** normal bloom.
- **Frame 1:** wider bloom and a longer, thicker lens streak (the pulse), the wisps moved 1 px, a few different sparks.
- **Frame 2:** normal bloom, the wisps moved 2 px, fewer sparks.

Only the front steam, the bloom and the specks change from frame to frame.

**Choices you might want to change:**
- **His size:** the body is in chibi Mega Man proportions with a big head and short boots. To make him bigger, widen the stance in `leg()`, enlarge the boots, or move the head (HX, HY).
- **Steam:** how much there is (BACK, FRONT, COVER) and the cover's rows and push in `cover()`. The side columns still look a little like stacked balls up close.
- **Sparks:** how bright and how many (SETTLED, FLICKER, `flying()`).
- **Tail:** it now hangs between his legs rather than sweeping off to the side as in the board sprite. It can be cut by removing it from the list of his parts (`HIM`).
- **Backdrop details:** the red signal lamp on the left and the gantry beam at the top right are optional.
- **The twinkle:** it stays on screen as long as frame 5 is held. If it should vanish while the frame holds, drop TWINKLE from frame 5.
