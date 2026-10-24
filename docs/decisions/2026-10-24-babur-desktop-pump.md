# Babur's pump on a computer: as big as the board's balloons, beside him (Oct 24, 2026)

**Eric, on a computer with a screenshot:** "this boss bar, and his balloon pump are just so tiny… you're not going to have any clue
what's going on. And… remember when I said it needs to end up being the same size? Well, at least on the desktop, it's not… whether
that means we need to put this balloon pump to the left of him… his actual character model at the bottom left there, if we need to
have like a unique thing for the desktop… or maybe just make the boss bar bigger on desktop… the starting point is the… piece needs to
be blown up the same size as it is on the board."

**Why it was small.** On a computer the pump stayed 1 to 1 (34 x 36) in the 49 px boss bar (docs/decisions/2026-10-24-babur-bigger.md,
point 2): a stage-4 queen on it was 20 px tall, against a queen piece of 44 px at 1280 x 800 and 54 px at 1440 x 900.

**What changed (a computer only, 900 px wide and up and 600 px tall and up; the phone is unchanged)**

1. **The size.** The pump is drawn at the scale that makes a stage-4 queen on it as tall as the board's balloon, which is as tall as
   the queen piece (`pumpScale` in `components/Tiger.tsx`: the board balloon's art pixel is `PX` x the board's size). A whole number
   where that is within 8% of it, otherwise the nearest scale within 8% (pixelated). 8% rather than the 10% asked, so the pixels'
   rounding never takes it past 10%. Every shape uses the same scale, as on the board.
2. **Where: beside his figure, Eric's first idea.** The pump stands left of his big figure at the board's bottom left, on his
   baseline (his feet, at the board's bottom; 4 px under it at 1440 x 900, where the board's row is a little taller than the board),
   its drawn right edge 6 px from his drawn left edge, drawn into his `.boss-side` (a portal from the
   bar's slot, which is left empty). `pumpPlace` measures it before the first paint and again when the window, the board or the
   leaderboard changes size: it goes there only if it stays inside the window (4 px from the edge) and over none of the leaderboard
   (`.tower-side`), the eval bar, the board, the dock and the boss bar.
3. **Else in a taller bar.** Where that room isn't there, the pump stands at the left of the boss bar at the same scale, and the bar
   grows to its height, only for Babur, only on a computer. The board gives that room up: its height budget (`--bd-h`, which was the
   six `var(--app-h) - 288px` in the boss screens' sizes) becomes `(app-h - 250px) / 1.1876`, the room for the tallest pump the scale
   can give (`PUMP_BAR_SHARE`, 0.1876 of the board, a unit test ties the two). So nothing scrolls; the board is a little smaller
   where the window's height now limits it (1024 x 768: 464 to 432 px).
4. **The sizes, measured** (Boss alone):

   | Window | Layout | Board | Scale | Queen on the pump | Queen piece |
   | --- | --- | --- | --- | --- | --- |
   | 1920 x 1080 | beside him | 552 | 2.876 | 57.5 px | 53.5 px |
   | 1440 x 900 | beside him | 552 | 2.876 | 57.5 px | 53.5 px |
   | 1366 x 768 | beside him | 480 | 2.131 | 42.6 px | 46.5 px |
   | 1280 x 800 | beside him | 456 | 2.024 | 40.5 px | 44.2 px |
   | 1280 x 600 | beside him | 312 | 1.625 | 32.5 px | 30.2 px |
   | 1099 x 900 | taller bar (112 px) | 536 | 2.793 | 55.9 px | 51.9 px |
   | 1024 x 768 | taller bar (83 px) | 432 (was 464) | 2 | 40 px | 41.9 px |
   | 900 x 600 | taller bar (57 px) | 288 (was 312) | 1.278 | 25.6 px | 27.9 px |

   - **Beside him: from 1100 px wide**, where he's drawn at 2x, whenever the leaderboard is short (Boss alone, a small lobby). In a
     raid whose leaderboard runs down the column beside him, the column is in the way below about 1810 px wide, and the pump goes in
     the taller bar.
   - **The taller bar: from 900 to 1099 px wide**, where he's drawn at 1x by the window's edge (no room left of him), and wherever
     the leaderboard is in the way. A screen without the boss dock keeps the old 1 to 1 pump at the bar's left (its board leaves no
     room for a taller bar).
   - "Above-left if the left runs out" was not built: left of him only the leaderboard's column or the window's edge can be in the
     way, and both reach above him too.
5. **Everything that measured the pump follows it.** `onPump` (and so his limp balloon's landing point and the flight's start, the
   release's knot) reads the pump wherever it is drawn, at its drawn scale. His limp balloon, tossed from his paw, is drawn at the
   pump's scale, so it lands on the nozzle as the balloon it becomes (it was 2x). Beside him the toss is short: from his paw to the
   nozzle about 90 px to his left. The pop's over-swell and the release's lift are inside the pump's frame, which is what is kept
   clear and inside the bar. The pump's sounds are unchanged.
   - On a screen that has just come (his turn's screen and yours swap as his turn starts and ends), the pump beside him is drawn once
     its place is measured, before the first paint. His put (the toss's landing point) waits for that, and the flight's start looks
     again each frame until the pump is there (it takes the old fallback, above the board's top right, only if the flight starts
     without one).

**Judgment calls**
- The leaderboard's own box, not its whole column, is what the pump keeps clear of: in Boss alone the column under its one row is
  empty (he stands over that column already). A raid's long leaderboard fills it, and the bar layout takes over.
- The board shrinks for the taller bar where the window's height sizes it (1024 x 768: 464 to 432 px; 900 x 600: 312 to 288 px), as it grew when the line above
  it went (docs/decisions/2026-10-24-boss-screens.md): what's above the board comes out of its budget. The budget keeps room for the
  tallest pump the scale rule allows, so the bar is up to about 15% shorter than that room; the rest stays under the dock.
- The layout is measured, not a fixed width: whether the leaderboard is in the way depends on the battle (Boss alone or a raid), not
  the window. It's worked out with the bar at its usual size each time, so it never flips back and forth.

**Tests.**
- Unit (`packages/app/test/tiger-wired.test.ts`): the scale over every board from 240 to 1000 px (whole within 8%, else the nearest
  within it; the queen within 10% of her piece); the taller bar's room against styles.css's constant; the place beside him, none with
  a raid's leaderboard or at 1x.
- e2e (`e2e/tiger.spec.ts`, desktop): at 1280 x 800, 1440 x 900, 1920 x 1080 and 1024 x 768, a ready stage-4 queen's drawn height
  within 10% of the board's queen piece (measured at 400 px for precision), beside him (the first three) or in the taller bar
  (1024 x 768), inside the window, over none of the board, the eval bar, the leaderboard and the status, no scrolling; then a landing
  flies from the pump to its square: the flight's own start (its rest box moved by its `--dx`, `--dy`) within 4 px of the pump's
  release knot, and the first frame drawn on its way from there. The 320/1280 test's computer half now checks the pump beside him at 1280 x 800
  and none in the bar. The phone's tests are unchanged.

**Files.** `packages/app/src/components/Tiger.tsx`, `packages/app/src/styles.css`, `packages/app/test/tiger-wired.test.ts`,
`e2e/tiger.spec.ts`, `docs/areas/bosses.md`.
