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
