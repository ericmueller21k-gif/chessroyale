# Town: a frame report (`?report`), and turning without drops (Nov 11, 2026)

Eric (iPhone, Safari): "the biggest drops are when I'm rotating … turning is dropping it to like 40 frames … maybe also loading".

- `/town?report`: every frame of a 30 s run, by part, on one panel to screenshot (docs/areas/town-square.md).
- Cause: a first look round painted hundreds of pictures (other quarters' roofs, walls, shades) as they showed, up to 20 ms a frame.
  Now painted ahead: what a walk shows always; the rest standing still, at 4 ms a frame (`boxBakeStillMs`: a still frame has room).
  All of it while walking cost the walk, so not then. Roof painter 1.8x faster.
- Left: bosses' frames paint as they first show (Folio's 25 to 37 ms headless): a characters-lane follow-up.
