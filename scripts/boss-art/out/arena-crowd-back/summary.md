# Boss art: arena-crowd-back

- Model claude-opus-5-5, effort medium, adaptive thinking. 5 turns, 2 renders.
- Spend: **$0.18** of the $2 cap (12 input, 15,030 cache-write, 36,829 cache-read, 4,654 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-crowd-back/arena-crowd-back.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.22.0
. Each look it took: scripts/boss-art/out/arena-crowd-back/looks/.

## Its notes

I've drawn `arena-crowd-back` (exported as ARENA_CROWD_BACK). I checked it in two renders: all six stills side by side, once on dark at 4x and once on light. Nothing on either needed fixing.

- **Size and anchor:** the frame is 18 x 22 with the foot at (9, 21), bottom centre. There are no exported points and nothing tiles: the game places each copy.
- **The five pawns (`red`, `blue`, `green`, `gold`, `purple`):** each is one still frame. It's a pawn seen from behind, about 16 x 20 counting its outline: a round ball for the head, a flat collar disc and a bell-shaped body flaring to a wide base. It follows the town's pawn shape and has no face. The ball, collar and body are separate parts, so each gets its own `k` outline and the joins read clearly. Each colour has three flat tones lit from the top left (light patch on the upper left of the ball, light strip down the body's left side, shade on the right), and the bottom row of the base is shaded. They're plain, so the game's bob will work on them.
- **The far figure (`far`):** 7 x 8 including its outline, which is a bit bigger than the brief's "about 5 x 7". A narrower head would have been only one pixel wide. It's a head dot on a shoulders blob in neutral greys for the game to tint, sitting at the bottom centre of the frame (x 6..12, y 14..21).
- **Palette:** `k` #2a1c14 is the outline. Each colour has its own keys, so none clash with the coliseum's stone, navy, gold or marble keys:
  - red `A B C`
  - blue `D E F`
  - green `G H I`
  - gold `J K L`
  - purple `P Q S`
  - far `T U V` (#bdb29c, #9a907e, #6e665a)
- **Halo:** a faint warm `#fbf0d830`.

**You might want to change:** the body colours are my picks, not taken from the mockup; the far figure's size; and the halo, which you could drop if a ring of hundreds of far figures looks too soft.
