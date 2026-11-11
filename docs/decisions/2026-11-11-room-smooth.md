# Rooms smooth while walking, and `?report` inside them (Nov 11, 2026)

**Eric (Nov 11, iPhone 14 Plus in Safari, after #639):** "the town is butter smooth now. It's perfect." Inside buildings (he tried 2):
"it's not moving as smoothly as the town... It's not going up and down, but it's just like capped. It seems like it's just a slower
speed inside. I'm very certain." And `?report` "is pausing when I run into the building, so I don't know how to capture it."

**`?report` inside a room.** The room's frames were recorded all along (#638), but the pill's "● Recording N s" was set by the town's
frame loop alone, which stops while you're in a room, so it stood still ("pausing"). Now the recorder calls the pill each new second
(`FrameRec.onSec`), whichever loop records. No WebKit browser here (only Chromium), so it was checked in Chromium. The cause was
browser-independent: the pill was set from the one loop that stops inside a room.

**Walking in a room.** While the view moved, the room laid its floor on its 2D canvas as 156 to 360 clipped, stretched triangles a frame.
The canvas draws those after our code runs ("Outside our code" in the report), and that pushed a walking frame past 16.7 ms, so it ran
at 30. Now the room's back (the ceiling's picture, a cave's rock, the day outside, the floor and the still plans on it) is drawn by
WebGL into one opaque picture (`shops/back-gl.ts`) and copied onto the canvas in one `drawImage`, where the back was. Everything after
it (pools of light, figures, Hollow's dark) lands on it as before, in the same canvas. So a walking frame costs the 2D canvas one copy,
as standing still already did. No WebGL, or a lost context: the 2D way, unchanged.

**Calls made**
- **Why not "paint once, draw with the camera's transform":** the room's camera is a curved perspective (`proj`: the ground drops with
  distance from the focus, sideways too), so no single 2D transform maps the floor's picture. **Why not the town's painter:** the room
  draws with "multiply", reads its own pixels (snapshots, the kept back) and makes hundreds of pictures. Moving all that would be a
  rewrite. The floor alone in WebGL is about 300 lines and touches nothing else. **Why not a WebGL layer under the canvas:** the
  pools ("lighter", Folio's "multiply") and the darks blend with the floor, so they must be in the same canvas.
- **Tried and measured, headless (Smudgy's, phone slowed 4x):** no floor at all, 15 → 60 fps (the floor is the whole cost);
  clip-free pattern-filled triangles, 15 → 20 (too little).
- **Same picture:** drawn both ways at one view (`__shopBackDiff`), the differences are tile edges about a pixel apart, mostly far
  off, where the 2D way stretched one triangle over two squares (WebGL uses one square everywhere). Side by side the stills look the
  same.
- **Not proven here: the phone's speed.** This container has no GPU. Headless Chromium draws WebGL in software (SwiftShader), and
  copying a WebGL picture onto a canvas becomes a CPU readback, so headless numbers get worse (phone 1x 60 → 30, computer 1x 30 → 12).
  On a phone the GPU draws the floor, and Safari's canvas (drawn on the CPU) copies one opaque picture, as it does at 60 standing still.
  To settle it on Eric's phone, same build: `/town?report` and `/town?report&back=2d` (the 2D way, anyone's; the report's device line
  says "(rooms 2D)"). Compare the Room column. If WebGL isn't faster there, `back=2d`'s path is one line away from being the default
  again.

## Going in: the whole inside ready behind the black (Nov 11)

**Eric:** "when you go into a building, just make it take an extra second. We probably don't even need to show a loading bar, and just
load the whole inside." And: "when it's zooming in... the screen's not interactable anyway, that's actually like part of the true
loading." Not to build now: if a room's load is ever well over a second of black, show the room's boss animating in the middle of the
black. "I assume it'll be literally about a second or less... probably not necessary at the moment, but we'll fall back to it if it's
too slow."

**What changed**
- The room's code and art already started loading at the door's tap (during the zoom). Now its pictures are painted at most 4 ms a frame
  while the town zooms (`shops/load-slice.ts`, `SHOP_FEEL.loadSliceMs`), and the rest all at once once it's black.
- The black lifts only once the room has drawn 3 frames (`warmFrames`), at most 1 s (`warmMaxMs`). So the first-time costs (WebGL's
  set-up and uploads, each picture's first draw) are paid under the black. Before, the room was drawn once and the black lifted at once,
  often before the screen had gone fully black.
- After that, walking in a room paints and uploads nothing (the report's counts in the room's frames: 0, before and after).

**Measured** (headless phone 428×746, drawn 2, a first visit, 2 runs each; from the zoom's start to the black lifting, 600 ms at the
least by design):

| | before | after |
|---|---|---|
| 1x: Smudgy / bakery / Boingo | 590 / 923 / 590 ms | 757 / 1140 / 873 ms |
| slowed 4x | 2023 / 590* / 2057 ms | 2390 / 2090 / 2507 ms |
| the screen fully black before the room shows | sometimes not | always |
| the zoom's worst frame | 100–300 ms | 150–283 ms |

(*One run's room lifted before the screen was black.) So the black lasts 0.2 to 0.5 s longer than the zoom at 1x, and 1.5 to 1.9 s
longer slowed 4x. The zoom's worst frame barely changed: on a first visit it is the room's code itself loading and running (one task that
can't be split), not the painting. The zoom and the fade are the browser's own transitions, so they keep moving through it; only the
town's figures pause. Second visits skip the code and art. If the black is too long on Eric's phone, his boss-in-the-black fallback
(above) is the next step.

## Fix round: ghosts and dark patches in Rolling Dough (Nov 11)

**Eric (iPhone 14 Plus, on main):** "floor shading bug when running around, these artifacts keep appearing, and the same in the main
bakery": in the back room, the table and its board ghosted, and dark squares on the floor beside and under him.

- **On main and on this PR alike; not the kept back (#638) nor WebGL (#641).** Reproduced headless on both, and with `?back=2d`.
- **The cause:** the back room's floor tiles were named `bfloor-*` and `rug-*`; room.ts `isFloor` knows `floor-`. So none was baked
  into the floor: all 196 stood up as pieces every frame (130 on screen), and each went see-through (0.35) when you walked behind it,
  showing the bare floor under it: the dark squares. The front room's two door mats likewise. And the see-through rule (a cave's)
  reaches every room with a floor's shape, so at the table's end (his Challenge spot) the whole table and board ghosted.
- **The fix:** the tiles are `floor-back-*`, `floor-rug-*`, `floor-mat-*`. A room can list the only pieces that go see-through
  (`seeThru`): Rolling Dough's doors and near walls, so you're never hidden at a door and the table stays solid. Its rug now lies in
  the floor's perspective (it was stepped). The back room draws 23 pieces a frame where it drew 130 (those on screen).
- **`?report` starting in a room:** works on this PR (Again inside a room, then a walk: "Recording 2 s"); on main it stayed on "walk
  or turn to start", Eric's "won't turn on when I go in".
- **Eric's main report (the before for his phone):** rooms 620 frames, 45 fps median, "Outside our code" 21 ms a frame against ours
  about 0.4: the 2D floor this PR moves to WebGL.
