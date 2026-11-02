# Brush Ride: ink drops for its trail, no seat pad (Nov 2, 2026)

Eric (Nov 2, on the Brush Ride): "It should just be a brush", and "the bottom should just be like ink dripping out from it… the ink
dripping from the back of it as you fly around on it should be what the trail is."

## What changed (`components/rides/smudgy-brush.tsx`; the other rides unchanged)

- **No seat pad.** The plum pad is gone from the side view, and from the back and front views. The Nov 1 call "the brush's plum
  seat pad stays" ([2026-11-01-rides-v2.md](2026-11-01-rides-v2.md)) is reversed by Eric's words here. The dark ring at the top of the
  front view's handle was plum; it is dark wood now.
- **Its trail is ink drops** off the bristle end: three small drops in its paint color, falling a little and fading over the same
  700 ms the paint mark had. One mark per square run, as the other rides' trails: composed once, one picture drawn per mark, so no
  new per-frame work and the same size (30 × 24 units). Behind the brush in each view (left of it going right, up the screen going
  down, down the screen going up).
- **The paint streaks** the back and front views drew behind the brush while it ran are gone, so the drops are the one trail. The
  idle wisp on the tuft stays (it is paint on the tuft, not a trail: none comes while it stands).

## Calls made

- The drops replace the paint swipe and dabs as the trail mark; the look of the ride itself is otherwise as drawn.
- `ride-cells.ts`: only the brush's hash changed (re-measured with `scripts/measure-rides.ts`); its cells, times and box are the same.
