# The transformation's review fixes (Nov 14, 2026)

- **The light within a phone's frame budget, its look kept** (review B1: p95 100 ms, 36% dropped on the slowed phone; Eric: "if the
  light looks worse quality I'll be upset"). It is drawn in a worker (OffscreenCanvas), off the main thread, at 1 pixel per CSS pixel
  (the director's floor), the same drawing code. Each canvas is hidden while it has nothing to draw. Result: p95 16.8 ms, 5% dropped.
  Tried and dropped: a third or half a pixel (the rays at his feet and the motes softer at DPR 3); CSS layers for the dark and the
  white-out (the board then shows through the rays); WebGL (no faster in the test's software browser). Checked at DPR 3 against the
  PR head at the same instants: the same (`light-before-after.png` on `stills/recluse-transform-book`).
- **His first line** (M2; the director's pick: both): typed at 30 ms a character (`chantLines.firstTypeMs`), held through the visor
  coming down and the crouch until he leaps. That makes it readable whole for 2.8 s (it was 1.2 s). The music fixes the window.
