# Taps on the street town, reliable on CI (Nov 13, 2026)

**Context.** PR #676 moved every player onto the street town. On CI's software WebGL, under a full shard, tests that tap a far figure or a
home after a camera glide failed on the first try and often the retry (boss-challenge's Alfil, town-leave's Sawyer, shop's Puddles and
Hollow, town.spec's Folio, the rides and the test player). With 4 workers on one machine they failed locally too, once the local
Chromium matched the project's Playwright.

**What was wrong (several causes, one pattern):**
- **Taps read mid-glide.** Specs read `__townAt` the moment it wasn't null, or after a "camera at rest" check made of reads 100 ms apart. At
  a few frames a second, three reads can fall between two frames, so a camera mid-glide looked still. The point moved before the click
  landed, the click walked you off, the camera followed you, and the target left the screen for good.
- **A separate press and release.** `page.mouse.click` sends them as two messages; a slow frame between them outlasts the street town's hold
  time (`streetHoldMs`, 180 ms) and the tap becomes a run: no card.
- **The test player was put behind you.** `addTestPlayer` took the nearest free square, south of you, which under the chase camera is the
  box's foot, where figures fade out and can't be tapped (every run on a computer).
- **Folio's doorway was covered.** You stop on his door square, so your pawn and tag cover the doorway from the camera behind you. From
  straight on, his rest square beside the door puts his wings over it.
- **The rides test's guard was stricter than its reason.** "No bot within 2 steps" counted Gambit Gus, frozen two columns over on your row
  of the lane, where he covers no square the test taps.

**Decided.**
- One shared helper in `e2e/helpers.ts`. `townTapPoint` waits until the tap point holds still over 3 drawn frames (counted with
  `requestAnimationFrame`, not wall time). `tapInTown` opens a card: it closes any other card, glides once if the target is off the screen
  or covered, waits for the view to land, then sends a `quickTap` (press and release together). boss-challenge, town-leave, shop and
  town.spec use it. The rides test's `squareSettled` also counts frames now, and its taps are quick taps.
- `addTestPlayer` (a test hook) puts the player on your right or left as the town opens. It falls back to the nearest free square.
- Folio's doorway light is read from the corner of his lot, (29, 14). The rides guard now checks only the squares tapped and the squares in
  front of them.
- **Not changed in the game (for the director):** in the street town, Folio resting on his rest square (25, 16) stands in front of his
  own lit doorway from most views. You can still tap the house, so it's cosmetic.

**Review minors (same PR).** m1: a guest's 30 s starts once the town is drawn. m2: `perf.spec` bounds a player's tap to the first frame
under 8 s on the slowed phone. m3: "Back to me" is checked again (glide away, tap, focus within 2 squares of you), and it now eases back a
look round snapped to another quarter. m4: the dead 2D start branch and the far-band softening are deleted. m5: left as is.
