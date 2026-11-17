# Moo & Moon's Full Moon: Scene A, the moonlit field (a cinematic backdrop, not the arena)

You are drawing **one full-bleed backdrop picture** for a short cinematic in HunChess, in the game's sprite format and pixel-art
style. This run uses the arena mode only for its format and tools: ignore everything about the Colosseum. It is not a boss.

## What it's for (Eric, Nov 17, word for word)
"For moo and moons ult let's add an animation where the game pauses, he jumps down onto the center of the board, then the board
and everything above it like the boss bar, is replaced with a singular cinematic drawing of a field of grass with a starry night
and a giant moon taking up a big chunk of the sky, then it does this cool view switch where it shows a super close up of moo and
moon from a side profile angle staring up at the moon (you can't see it in this part but you can see a glistening radiating in
their direction) their eyes start turning white, then it goes back to the first scene and this is where he does the
transformation, then the background fades and then once it fades he hops back to his spot."

You draw **the first scene: the field.** (Another run draws the close-up.) Moo & Moon (`packages/app/src/characters/moo.ts`; look
at the references `moo-idle.png`, `moo-power.png`) are **not** in your picture: the game draws his own sprite standing on your
grass, on top of it, and he transforms there (he turns gold and glowing). Leave a clear spot for him.

## The frame and how it's shown
- **200 wide x 260 tall**, fully opaque (every pixel filled, edge to edge: it's a backdrop, so no outline round the frame and no
  transparent margin; ignore the "pixel on a frame's edge" warning).
- On a **computer** it's drawn at **3x** (600 x 780 px) over the board column (600 x 660): up to **20 rows at the top and 20 at
  the bottom are cut off**. On a **phone** at **2x** (400 x 520) over the top of the screen (390 x 515): a few pixels at each side
  are cut. So keep everything that matters inside **x 4-196, y 22-238**; the edges are only more sky and more grass.
- **Moo's spot:** he stands in the middle, his feet at about **(100, 205)**, and he's about **50 px tall and 40 wide** at this
  scale (his sprite at the same pixel size as yours). Keep a calm, readable patch of moonlit grass there, nothing busy behind his
  body (roughly x 75-125, y 150-210), so he reads clearly against it. A faint pool of moonlight on the grass where he stands is
  welcome.

## The picture
- **The sky** (upper ~60%): deep night, banded from dark navy-indigo at the top to a lighter blue-violet near the horizon (bands
  and a little ordered dither between them, never smooth gradients). **Lots of stars**: tiny single pixels, some 2-3 px crosses,
  a few bigger sparkly ones, maybe a faint band of the Milky Way. No letters, no constellations of anything real.
- **The giant moon:** a **full moon** taking up a big chunk of the sky, about **110-130 px across**, high and centered or a little
  to one side (inside the safe area), so it hangs over Moo's spot. It's the same moon-yellow family as his little friend the
  Moon (moo.ts palette keys M, N, O, P, Q: `#e3a22b`, `#f8c744`, `#ffdc6c`, `#fff0a8`, `#c9801f`) but paler and softer, with
  a few gentle craters/maria in a slightly darker tone and a **soft glow ring** round it (two or three bands of see-through pale
  yellow over the sky). No face on the big moon: it's the moon in the sky, his friend's big sister, not a character.
- **The horizon:** low rolling hills in dark blue-green silhouette, and far off, small, a little farm: a red barn with a lit
  window and a fence line (Moo is a farm calf). Small and quiet, so it doesn't compete with him.
- **The field** (lower ~40%): grass, moonlit: dark blue-greens in shadow, cool moonlit green-yellow on the tops of tufts facing
  the moon. Bigger, darker grass tufts and a few small flowers (clover, white daisies closed for the night) in the foreground at
  the bottom corners; finer texture further back. The light comes **from the moon** here (not the top left): rim light on grass
  tips, shadows falling away from it.
- **Style:** chunky, clean pixel art, banded shading, a limited palette (about 20-28 colors). Outlines (`k`, dark) only where
  shapes need them (hills, barn, foreground tufts); the sky and the moon need none. It must look lovely and calm, a little
  magical, and read at a glance on a phone.

## Animation
- `idle` (loops): **4 frames at about 400 ms**: stars twinkle (a few at a time change size/brightness), the moon's glow ring
  breathes a little (one band in and out), the foreground grass sways a pixel. Subtle: it's behind a character. The rest is the
  same in every frame (build frames from one painted base plus small layers, so it stays cheap).
- Nothing else. (Export `ARENA_MOO_FIELD`, a Character with id `arena-moo-field`, name "Moonlit field", `w` 200, `h` 260, `foot`
  [100, 205].)

## How to check
Render `idle` at scale 2 and look at it whole; render frame 0 at scale 4 with `frames: [0]` to check details; check the four
frames for the twinkle. Pace yourself: a beautiful, readable scene in a few renders beats a long polish. Call `done` with notes:
the palette, where the moon and Moo's spot are, and any choice the owner might change.
