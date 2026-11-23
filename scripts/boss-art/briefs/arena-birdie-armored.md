# Birdie's ultimate, Scene B: Armored Birdie revealed (a cinematic picture, not the arena)

You are drawing **one full-bleed cinematic picture** for Birdie's ultimate cutscene in HunChess, in the game's sprite format and
pixel-art style. This run uses the arena mode only for its format and tools: ignore everything about the Colosseum. It is not a
boss's board sprite; it's a cutscene's close-up, shown full screen.

## What it's for (Eric, Nov 23, his design)
Birdie's ultimate: he falls, a train barrels into him, and **he transforms**. He takes on the train's color scheme (yellow, the dark
roof, the red stripe), with armor on his wings. **He stands upright on both legs, more like a human stands, like a typical Mega Man
boss.** The game cuts from the fall to this close-up: a low camera looking up at him, steam and sparks, his shoulder headlights
blazing. Then the scene fades and he hops back to his spot on the board.

You draw **the reveal**: Armored Birdie, the sleek version (A), standing in his hero pose. (Another run draws the fall.)

## Who he is
- **Armored Birdie, variant A (sleek)**, the approved drawing: read `scripts/boss-art/out/boss-birdie-armored-a/boss-birdie-armored-a.ts`
  (his palette, his parts, his idle) and `scripts/boss-art/out/boss-birdie-armored-a/summary.md`. Keep his design: he's still
  **Birdie**: the same round grey-brown head (`b c d e`, its face and throat `f g h`, the beak `B`, the big dark eye `x` in its pale
  ring `o` with a glint `w`), the **navy cap** (`1 2 3 4`) with its **gold band and visor** (`K L`), the **burgundy tie** (`R T U`),
  and his **long dove's tail** (the same shape as in the drawing, sweeping behind him, with its dark band and pale tip).
- **The armor, in the train's colors:** the train is a bright **yellow** toy diesel (`t u v y Y`, the armor's shadow to light),
  a **charcoal** roof and plates (`m n N`), and a thin **red stripe** (`q`). His chest plate is yellow, shaped like a locomotive's nose,
  with a charcoal collar and the red stripe down the middle; his shoulder pads have a charcoal top over a yellow band, with a
  **headlight** in each (`W` the near one, `V` the far one, both `#fff3b8`), the cream glass of the lamps. His wings: thin yellow
  plates with scalloped lower edges over the feathers, a pale feather fringe between them, dark flight feathers below.
- **His stance in this picture:** upright on both legs, a hero's pose like a Mega Man boss: chest out, head up and a little turned
  (the eye, the glint), wings held out a little from his sides as armor, feet planted. Tall yellow boots with a red stripe and
  charcoal toe caps, the knee plates yellow, the charcoal waist with a small gold buckle.
- **No letters or numbers anywhere** in the picture: no words, no marks with writing. Shapes only.

## The frame and how it's shown
- **200 wide x 260 tall**, fully opaque (every pixel filled, edge to edge: no outline round the frame and no transparent margin;
  it's a full-bleed picture, so ignore the "pixel on a frame's edge" warning).
- On a **computer** it's drawn at **3x** (600 x 780 px) over the board column (600 x 660): up to **20 rows at the top and 20 at the
  bottom are cut off**. On a **phone** at **2x** (400 x 520) over the top of the screen: a few pixels at each side are cut. So keep
  everything that matters inside **x 4-196, y 22-238**: his head, his cap, his headlights, his hands and feet. The edges are only
  more steam and more backdrop.
- **The camera:** a **low camera looking up at him**, so he's huge and heroic: he fills most of the frame, his head about 60 to 70
  px across and his full height about 200 to 210 px (head near the top of the safe area, y about 30, his feet at about y 236).

## The picture
- **The backdrop:** dark, behind him: a night-blue sky at the top, banded (navy to blue-violet, with ordered-dither seams, never a
  smooth gradient), and at the bottom, the dark ground of the track's cutting, with a few dark steel and rail shapes in shadow and a
  faint glow from the sparks. Keep it simple so he pops.
- **Steam and sparks:** the steam is pale grey-white and billows around his feet and up past his shoulders, thick at the bottom and
  thinning up the frame (use a few pale grey keys of your own: `S` for the steam's light, `Q` for its shade, or any other single
  letters the drawing doesn't use yet); a few **sparks**, short yellow-white strokes and dots (the train's `Y` and `w`), fly off his shoulders and boots. Some
  steam drifts across his lower body, leaving his head and headlights clear.
- **The light:** from the sparks and his own headlights: his shoulder headlights blaze (the cream `W` and `V` glass with a soft `w`
  core and a pale bloom round each), his chest plate catches a warm yellow rim light on its top edge, his armor has a dark charcoal
  shade on the side away from the glow. A dark outline (`k`) round him, banded shading, lit from the front and the lamps.
- **Style:** chunky, clean pixel art, banded shading, a limited palette (about 30 colors: the armored palette above, the steam and the
  night's blues). It must look striking and heroic, read at a glance on a phone, and make the headlights and the cap obvious.

## Animations (export `ARENA_BIRDIE_ARMORED`: a Character with id `arena-birdie-armored`, name "Armored Birdie", `w` 200, `h` 260,
`foot` [100, 236])
- **`reveal`** (plays once, holds its last frame): **6 frames at about 200 ms each** (about 1.2 s). The steam clears to show him: frame
  0 is mostly steam with only his boots and the lamps' glow showing through; the steam thins frame by frame (blown off to the sides
  and up) until frame 4 shows him whole; frame 5 is him in the hero pose, the sparks settled, the last glint on his eye (the `w`
  twinkle on the eye's glint, a short plus-shaped twinkle, then gone). Frame 5 is the **held final picture** the game keeps on
  screen until the fade.
- **`hold`** (loops): **3 frames at about 300 ms each** (about 0.9 s a cycle). He stands still in the hero pose; the steam drifts
  slowly (a few wisps move a pixel or two, the rest stays), the two headlights **pulse** (frame 0 the normal glass, frame 1 the glow's
  bloom wider, frame 2 back to normal), and a spark or two flickers. Build the frames from one rig (his body, the steam, the glow),
  so each frame is a few layers, not a redraw. The hold frames match `reveal` frame 5 exactly apart from the steam and the glow.

## How to check
Render `reveal` and `hold` at scale 2 and look at them whole, then render `reveal` frame 0 and frame 5 and `hold` frame 1 at scale 4 to
check details: his face and eye, the cap and visor, the headlights, the armor's edges. He must read as Birdie in armor at a glance
(the same cap, the same eye, the same tie), the armor must be obviously the train's yellow, charcoal and red, and the headlights must
blaze. Pace yourself: a striking picture in a few renders beats a long polish. Call `done` with notes: the palette keys, the frame
timings, the headlight keys (`W`, `V`) and the steam's keys, and any choice the owner might change (how big he stands, how much steam,
how bright the sparks, whether the tail stays).
