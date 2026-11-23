# Birdie's ultimate, Scene A: the fall and the train (a cinematic picture, not the arena)

You are drawing **one full-bleed cinematic picture** for Birdie's ultimate cutscene in HunChess, in the game's sprite format and
pixel-art style. This run uses the arena mode only for its format and tools: ignore everything about the Colosseum. It is not a
boss's board sprite; it's a cutscene's picture, shown full screen.

## What it's for (Eric, Nov 23, his design)
When Birdie has lost a certain amount of material, the game pauses and cuts to a cinematic like Moo's Full Moon. First he falls
out of his spot on the board; then a cut to a view that's zoomed in, but not so close you can't see what's below: **he tumbles
through the air like a bird falling from a great height, almost dying**. The background is blurred, with wind and speed lines, as
in a cartoon fall. As he falls **a train track comes into view below, and his own train (the same drawing as his ride) barrels
toward him, closer and closer. Its headlights get brighter and brighter as it nears.** Then it hits him, and he transforms (the
game draws the flash and the transformation; another run draws that part).

You draw **the fall**: the sky, Birdie tumbling, the track and the train coming up at him. (Another run draws Armored Birdie.)

## Who they are
- **Young Birdie** (`packages/app/src/characters/`: read `scripts/boss-art/out/boss-birdie/boss-birdie.ts`, his palette and his
  look; `boss-birdie.png` references if present). A young **mourning dove**, warm and round, a real bird's look and a warm face:
  brown feathers (`b c d e`, shadow `a`), a buff face and throat (`f g h`), a dark beak (`B`), a big dark eye (`x`) in a pale
  ring (`o`) with a glint (`w`), a conductor's **navy cap** (`1 2 3 4`) with a **gold band** (`K L`), and a tie (`R T U`). Nothing
  else on him. In this picture his **cap flies off** above him, his **wings flail** out, his tie streams up, and his eyes are wide.
- **His train** (read `scripts/boss-art/out/birdie-train/birdie-train.ts`, and `boss-birdie.ts` for the front): a **bright yellow
  toy diesel**, the same drawing as his ride: a rounded nose, a sloped windshield, a dark charcoal roof, a thin **red stripe** that
  sweeps down the nose, silver trucks and wheels (`j l J`), round headlights (`W`), dark windows (`z Z`). Yellow is `u v y Y`,
  its shadow `u`, its roof `m n N`, the red stripe `q`. Seen from the **front three-quarter**: its nose toward us and up, so we see
  the headlights and the front of the cab, coming up the track toward the viewer.
- **No letters or numbers anywhere** in the picture: no words, no "RR" on the crossing, no signs with writing. Shapes only.

## The frame and how it's shown
- **200 wide x 260 tall**, fully opaque (every pixel filled, edge to edge: no outline round the frame and no transparent margin;
  it's a full-bleed picture, so ignore the "pixel on a frame's edge" warning).
- On a **computer** it's drawn at **3x** (600 x 780 px) over the board column (600 x 660): up to **20 rows at the top and 20 at the
  bottom are cut off**. On a **phone** at **2x** (400 x 520) over the top of the screen: a few pixels at each side are cut. So keep
  everything that matters inside **x 4-196, y 22-238**: Birdie, the headlights, the train's front and the track's nearest rails.
  The edges are only more sky, more blur and more track.
- **The camera:** a low-ish camera, **not super zoomed in**, so you can see what's below. Birdie is big enough to read at a glance
  (about 60 to 80 px tall at the start), not a tiny figure, and the train grows from small in the distance to filling the **bottom
  third** of the frame (y about 173 to 238) by the last frame.

## The picture
- **The sky** (upper part, all of it at the start): a blurred cartoon sky, banded from a pale blue-grey at the top to a lighter
  haze, with **soft wind streaks** (horizontal and diagonal, pale and few) and **vertical speed lines** streaming **up** the frame
  past him (the air rushing up as he falls: thin, pale, dashed, some in the sky's haze tones, a few darker). Clouds seen far below
  as soft pale blurs, drawn as bands and dither, no smooth gradients. Use a limited palette of blues and greys, and a warm light
  from the sun, off frame, on Birdie's brown back.
- **Birdie** (the start): in the upper-middle of the frame, around (100, 80), tumbling on his back and side, wings out, his cap
  flying off above him (a navy shape with its gold band, clearly a cap), tie streaming. Almost dying: a wide-open eye with a glint,
  the beak open a little (a squawk), the feathers ruffled up. Cartoon fall, readable at phone size: a clear silhouette.
- **The track** (comes into view in the approach, below him): two steel rails in perspective, converging to a far point in the
  haze, with wooden sleepers and a bit of gravel, coming up from the bottom of the frame. In the first frames it's just a faint
  line in the haze below; by the last it fills the bottom third, its rails near enough to see the rivets.
- **The train** (in the approach): the same yellow toy diesel, its nose toward us and rising up the track from the haze. Small and
  far at the first approach frame (about 20 px wide, in the haze, its headlights just two dots), then bigger each frame, its front
  coming up, until it fills the bottom third, about 150 to 170 px wide and 80 to 90 px tall in the last frame. Its **two headlights**
  are the picture's brightest things: **two clean round light shapes** in their own palette keys (`W` the near lamp, `V` the far
  lamp, both `#fff3b8`), so the game can add its existing light glow over them. Each frame, the headlights are brighter (more of
  the lamp's core `w` at the centre, a soft `W` ring round it, a little bloom of pale light on the rails in front of them).
- **Birdie in the approach:** he sinks lower in the frame each frame (his fall carries him toward the train), from around y 80 to
  around y 140 in the last frame, still above the train's roof and nose at the end, so the train is about to hit him at the centre.
- **Style:** chunky, clean pixel art, banded shading, a limited palette (about 24 to 30 colors, the two palettes above plus the sky's
  blues and greys). Outlines (`k`, dark) on Birdie and the train's shapes, none on the sky or the track's haze. It must look
  lively, a little urgent, and read at a glance on a phone.

## Animations (export `ARENA_BIRDIE_FALL`: a Character with id `arena-birdie-fall`, name "Birdie's fall", `w` 200, `h` 260,
`foot` [100, 255])
- **`fall`** (loops): **5 frames at about 120 ms each** (about 0.6 s a cycle, looping). Birdie tumbles: each frame he turns a little,
  the wings and tie flap, his cap moves a little further up and away; the **speed lines stream up** a step each frame (a dash moves
  up and is replaced at the bottom), the wind streaks shift. The track and the train are not in these frames: this is the sky and
  Birdie only, falling. Every frame is the same picture with Birdie and the lines moved, so build from one painted sky and a few
  layers (the sky, the lines, Birdie) so it stays cheap.
- **`approach`** (plays once, holds its last frame): **9 frames at about 390 ms each** (about 3.5 s). Frame 0 matches `fall` frame 0 for
  the sky and Birdie's pose (the cut from the fall to the approach is seamless). Over the 9 frames: the track rises into view from
  the haze below; the train grows from small in the distance to filling the bottom third, its headlights brighter each frame
  (frame 0 two faint dots, the last frame two blazing lamps); Birdie lower each frame; the speed lines keep streaming up, a little
  faster; the wind streaks thicken. The last frame is the moment before the hit: the train's nose just under Birdie, its headlights
  at full brightness, the rails and sleepers close and sharp.
- Nothing else: no flash (the game draws the white flash on the hit), no text.

## How to check
Render `fall` and `approach` at scale 2 and look at them whole, then render frame 0 and the last frame of `approach` at scale 4 to
check details: Birdie's face and wings, the headlights, the rails. The headlights must grow visibly brighter from frame to frame,
and the train must read as the same yellow toy diesel as his ride at phone size. Pace yourself: a readable, lively picture in a few
renders beats a long polish. Call `done` with notes: the palette keys, the frame timings, where the headlights are (the keys `W` and
`V`) and where the track's nearest rails sit, and any choice the owner might change (the camera height, how far Birdie sinks, how
fast the lines move).
