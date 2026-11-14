# The transformation's review fixes (Nov 14, 2026)

- **The light within a phone's frame budget** (review B1: p95 100 ms, 36% dropped on the slowed phone). Both light canvases are now
  backed at a third of a pixel per CSS pixel. Half wasn't enough: profiling showed the canvases' raster was most of each frame,
  scaling with the area drawn. The full-screen dark and the white-out are opacity layers, and each canvas is left out while idle.
  The beam's motes, the one small sharp thing, have their own small canvas at the screen's pixels, so the look stays the same
  (checked side by side at 14 moments). Result: p95 33 ms, 7 to 10% dropped.
- **His first line** (M2; the director's pick: both): typed at 30 ms a character (`chantLines.firstTypeMs`), held through the visor
  coming down and the crouch until he leaps. That makes it readable whole for 2.8 s (it was 1.2 s). The music fixes the window.
