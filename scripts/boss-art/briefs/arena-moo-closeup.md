# Moo & Moon's Full Moon: Scene B, the close-up (a cinematic picture, not the arena)

You are drawing **one full-bleed cinematic picture** for a short cinematic in HunChess, in the game's sprite format and
pixel-art style. This run uses the arena mode only for its format and tools: ignore everything about the Colosseum. It is not a
boss's sprite sheet.

## What it's for (Eric, Nov 17, word for word)
"For moo and moons ult let's add an animation where the game pauses, he jumps down onto the center of the board, then the board
and everything above it like the boss bar, is replaced with a singular cinematic drawing of a field of grass with a starry night
and a giant moon taking up a big chunk of the sky, then it does this cool view switch where it shows a super close up of moo and
moon from a side profile angle staring up at the moon (you can't see it in this part but you can see a glistening radiating in
their direction) their eyes start turning white, then it goes back to the first scene and this is where he does the
transformation, then the background fades and then once it fades he hops back to his spot."

You draw **the second scene: the super close-up.** (Another run draws the field.)

## Who they are
Read `packages/app/src/characters/moo.ts` (its header and `MOO_PALETTE`) and look at the references `moo-idle.png` (him at rest,
hugging the Moon) and `moo-power.png` (powered up: the white glowing eyes). **Moo** is a round, soft Holstein calf: cream
(`C D E F`) with dark-brown patches (`a b c d`), a big patch round his eye, a pink snout (`p q r s`, nostrils `n`), big floppy
brown ears with pink insides, small tan horns (`h i j`) with a cream tuft between them, big brown eyes (`e` ring, `x` pupil, `w`
glint). **The Moon** is his friend: a soft-yellow crescent (`M N O P`, darker rim `Q`) with a face (eye and mouth lines `u`,
small smile, pink cheeks `v V`). Use his palette's colors so they're plainly the same pair; add night colors for the background.

## The frame and how it's shown
- **200 wide x 260 tall**, fully opaque (filled edge to edge; ignore the "pixel on a frame's edge" warning). Shown at 3x on a
  computer (top and bottom 20 rows may be cut) and 2x on a phone (a few pixels at the sides cut): keep the faces and eyes inside
  **x 4-196, y 22-238**.
- It's a **close-up**, far bigger than his sprite: draw them with much more detail at this size (bigger eyes with a proper
  iris, lashes, the snout's shine, fur tufts), still true pixel art in the same style (dark outline `k` round them, banded
  shading, whole pixels, no smooth gradients).

## The picture
- **Side profile**, both of them **facing our left and looking up toward the upper left**, where the giant full moon is (off
  frame: you never see it). Moo's head and shoulders fill most of the frame (his head about 120-150 px wide), his snout lifted,
  an ear swept back; the Moon, held up in his front hooves by his cheek (as in the idle, his hug), also in profile, its face
  turned up the same way. Low camera, looking slightly up at them: they're huge and the night sky is behind them.
- **The light:** from the upper left, off frame, a **glistening radiance** streams onto them: a few soft diagonal shafts of pale
  moon-yellow/white light, sparkles drifting in them, and a strong pale rim light along their faces, snout, horns and ears on the
  side toward it; the rest of them in cool night shade (blue-violet shadows on the cream). That light is the moon's call.
- **The background:** dark starry sky (navy-indigo bands, small stars), a hint of grass tips at the very bottom. Keep it simple
  so they pop.

## Animations (export `ARENA_MOO_CLOSEUP`, a Character with id `arena-moo-closeup`, name "Moo and Moon close-up", `w` 200, `h`
`260`, `foot` [100, 255])
- `idle` (loops): **4 frames at about 300 ms**, **eyes normal** (Moo's warm brown eyes with their glint; the Moon's eye its
  usual line or a small open eye looking up): the light shafts shimmer (sparkles drift down along them, a shaft brightens and
  dims), an ear twitches or the rim light flickers a pixel. They stand still and gaze.
- `whiten` (plays once, holds its last frame): **5 frames, about 220 ms each (the last 400)**: **their eyes turn white**: the
  brown iris fills up with white from the light's side, then pure glowing white with a faint white-gold glow bleeding past the
  eye into a small halo (as `moo-power.png`'s eyes, at close-up size), for both Moo and the Moon. The light shafts grow
  stronger as it happens. Frame 0 matches `idle` frame 0; the last frame is both pairs of eyes fully white and glowing.
- Build frames from one rig (the head, the eyes, the shafts as their own layers), so a frame is a few numbers, not a redraw.

## How to check
Render `idle` and `whiten` (scale 2 for the whole, `frames: [0]` at scale 4 for the faces). They must read as Moo and his Moon
at a glance, look striking and cinematic, and the eyes' change must be obvious even small on a phone. Pace yourself: a few good
renders. Call `done` with notes: each animation beat by beat and any choice the owner might change.
